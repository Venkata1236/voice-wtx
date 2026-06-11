from fastapi import APIRouter, HTTPException, Depends, status, Request
from loguru import logger

from db.supabase_client import get_supabase, get_supabase_admin
from schemas.forge import ForgeStartRequest, ForgeTurnRequest, ForgeResponse
from api.middleware.auth_guard import get_current_user
from api.middleware.role_guard import require_any
from api.middleware.rate_limiter import limiter
from agents.orchestrator import run_forge

router = APIRouter(prefix="/api/forge", tags=["Forge Mode"])


# ── Helper — check if Forge mode is enabled ───────────────────────
async def check_forge_enabled():
    """
    Checks the feature_flags table for forge_mode status.
    Forge tab is hidden on frontend if disabled — this is the
    backend safeguard in case someone calls the API directly.
    """
    supabase = get_supabase()

    response = (
        supabase.table("feature_flags")
        .select("is_enabled")
        .eq("flag_name", "forge_mode")
        .single()
        .execute()
    )

    if not response.data or not response.data.get("is_enabled"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forge mode is not enabled. Ask your Admin to enable it in Settings > Feature Flags.",
        )


# ── POST /api/forge/start ──────────────────────────────────────────
@router.post("/start", response_model=ForgeResponse)
@limiter.limit("5/minute")
async def start_forge(
    request: Request,
    payload: ForgeStartRequest,
    current_user: dict = Depends(require_any),
):
    """
    Starts a new Forge debate.
    Generator agent writes copy, Critic agent reviews it.
    Free models (Mistral/Gemma via Ollama) — zero API cost.
    Returns the debate history and final copy.
    """
    await check_forge_enabled()

    supabase_admin = get_supabase_admin()

    # Create new chat session for this Forge debate
    session_id = payload.session_id
    if not session_id:
        session_response = (
            supabase_admin.table("chat_sessions")
            .insert({
                "user_id": current_user["id"],
                "brand_id": payload.brand_id,
                "mode": "forge",
                "title": payload.brief[:50],
            })
            .execute()
        )
        session_id = session_response.data[0]["id"]

    logger.info(
        f"Forge start | "
        f"User: {current_user['email']} | "
        f"Brand: {payload.brand_id} | "
        f"{payload.generator.value} vs {payload.critic.value}"
    )

    try:
        result = await run_forge(
            brand_id=payload.brand_id,
            brief=payload.brief,
            generator=payload.generator.value,
            critic=payload.critic.value,
        )
    except Exception as e:
        logger.error(f"Forge debate failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                f"Forge debate failed: {str(e)}. "
                "Make sure Ollama is running locally with mistral and gemma models."
            ),
        )

    # Save the resulting variant if final copy was produced
    if result["final_copy"]:
        supabase_admin.table("copy_variants").insert({
            "session_id": session_id,
            "brand_id": payload.brand_id,
            "model": "forge",
            "format": payload.format,
            "brief": payload.brief,
            "content": result["final_copy"],
            "score": 100 if result["is_approved"] else 70,
            "status": "pending",
            "agent_generator": result["generator"],
            "agent_critic": result["critic"],
        }).execute()

    return ForgeResponse(
        session_id=session_id,
        generator=result["generator"],
        critic=result["critic"],
        debate_history=result["debate_history"],
        final_copy=result["final_copy"],
        turns=result["turns"],
        is_approved=result["is_approved"],
    )


# ── POST /api/forge/turn ───────────────────────────────────────────
@router.post("/turn", response_model=ForgeResponse)
@limiter.limit("5/minute")
async def forge_turn(
    request: Request,
    payload: ForgeTurnRequest,
    current_user: dict = Depends(require_any),
):
    """
    Continues a Forge debate with user direction.
    Used when user clicks "Agree" (direction=None passes critic
    feedback through) or "My Direction" (custom guidance).
    Runs another debate round and returns updated history.
    """
    await check_forge_enabled()

    supabase_admin = get_supabase_admin()

    logger.info(
        f"Forge turn | "
        f"Session: {payload.session_id} | "
        f"Direction: {'Agree' if not payload.direction else 'Custom'}"
    )

    try:
        result = await run_forge(
            brand_id=payload.brand_id,
            brief=payload.brief,
            generator=payload.generator.value,
            critic=payload.critic.value,
            user_direction=payload.direction,
        )
    except Exception as e:
        logger.error(f"Forge turn failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Forge turn failed: {str(e)}",
        )

    # Update or insert the resulting variant
    if result["final_copy"]:
        existing = (
            supabase_admin.table("copy_variants")
            .select("id")
            .eq("session_id", payload.session_id)
            .eq("model", "forge")
            .execute()
        )

        if existing.data:
            supabase_admin.table("copy_variants").update({
                "content": result["final_copy"],
                "score": 100 if result["is_approved"] else 70,
                "agent_generator": result["generator"],
                "agent_critic": result["critic"],
            }).eq("id", existing.data[0]["id"]).execute()
        else:
            supabase_admin.table("copy_variants").insert({
                "session_id": payload.session_id,
                "brand_id": payload.brand_id,
                "model": "forge",
                "format": "caption",
                "brief": payload.brief,
                "content": result["final_copy"],
                "score": 100 if result["is_approved"] else 70,
                "status": "pending",
                "agent_generator": result["generator"],
                "agent_critic": result["critic"],
            }).execute()

    return ForgeResponse(
        session_id=payload.session_id,
        generator=result["generator"],
        critic=result["critic"],
        debate_history=result["debate_history"],
        final_copy=result["final_copy"],
        turns=result["turns"],
        is_approved=result["is_approved"],
    )


# ── POST /api/forge/approve/{session_id} ──────────────────────────
@router.post("/approve/{session_id}")
async def approve_forge_copy(
    session_id: str,
    brand_id: str,
    current_user: dict = Depends(require_any),
):
    """
    Approves the final Forge copy.
    Saves to approved_posts — tagged with the agent pair
    that produced it (e.g. Vikram + Maya).
    """
    supabase_admin = get_supabase_admin()

    variant_response = (
        supabase_admin.table("copy_variants")
        .select("*")
        .eq("session_id", session_id)
        .eq("model", "forge")
        .single()
        .execute()
    )

    if not variant_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Forge copy found for this session",
        )

    variant = variant_response.data

    # Mark as approved
    supabase_admin.table("copy_variants").update(
        {"status": "approved"}
    ).eq("id", variant["id"]).execute()

    # Save to approved_posts with agent tags
    supabase_admin.table("approved_posts").insert({
        "brand_id": brand_id,
        "variant_id": variant["id"],
        "content": variant["content"],
        "format": variant["format"],
        "model": f"forge ({variant['agent_generator']} + {variant['agent_critic']})",
    }).execute()

    logger.info(
        f"Forge copy approved | "
        f"Session: {session_id} | "
        f"Agents: {variant['agent_generator']} + {variant['agent_critic']} | "
        f"By: {current_user['email']}"
    )

    return {"message": "Forge copy approved and saved to Knowledge Base"}


# ── GET /api/forge/sessions/{brand_id} ────────────────────────────
@router.get("/sessions/{brand_id}")
async def get_forge_sessions(
    brand_id: str,
    current_user: dict = Depends(require_any),
):
    """
    Returns recent Forge sessions for a brand.
    """
    supabase = get_supabase()

    response = (
        supabase.table("chat_sessions")
        .select("*")
        .eq("brand_id", brand_id)
        .eq("user_id", current_user["id"])
        .eq("mode", "forge")
        .order("is_pinned", desc=True)
        .order("updated_at", desc=True)
        .execute()
    )

    return response.data