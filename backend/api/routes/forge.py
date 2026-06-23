from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.responses import StreamingResponse
from loguru import logger
from autogen_agentchat.messages import TextMessage
from autogen_agentchat.base import TaskResult

from db.supabase_client import get_supabase, get_supabase_admin
from schemas.forge import ForgeStartRequest, ForgeTurnRequest, ForgeResponse
from api.middleware.auth_guard import get_current_user
from api.middleware.role_guard import require_any
from api.middleware.rate_limiter import limiter
from agents.orchestrator import run_forge
from agents.autogen.debate_loop import build_forge_team
from agents.langgraph.nodes.format_node import parse_copy_and_keywords
from utils.scorer import score_brand_relevance
import json
import uuid

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


# ── POST /api/forge/start-stream (SSE) ─────────────────────────────
@router.post("/start-stream")
@limiter.limit("5/minute")
async def start_forge_stream(
    request: Request,
    payload: ForgeStartRequest,
    current_user: dict = Depends(require_any),
):
    """
    Streaming Forge debate. Emits each agent's message live as the
    debate unfolds, then a final saved variant (parsed + brand-scored).
    SSE events: session, debate_message, final, done, error.
    """
    await check_forge_enabled()

    supabase_admin = get_supabase_admin()

    # Create the session up front so it exists even if the stream drops
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

    generator_name = payload.generator.value
    critic_name = payload.critic.value

    async def event_generator():
        try:
            yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"

            team, task, kb_context = await build_forge_team(
                brand_id=payload.brand_id,
                generator_name=generator_name,
                critic_name=critic_name,
                brief=payload.brief,
            )

            final_copy = None
            is_approved = False
            turns = 0

            async for message in team.run_stream(task=task):
                if isinstance(message, TaskResult):
                    continue
                if isinstance(message, TextMessage):
                    turns += 1
                    yield f"data: {json.dumps({'type': 'debate_message', 'agent': message.source, 'content': message.content})}\n\n"
                    if message.source == generator_name:
                        final_copy = message.content
                    if message.source == critic_name and "APPROVED" in message.content:
                        is_approved = True

            # Parse + score + save the final copy as a chat turn
            turn_id = str(uuid.uuid4())
            keywords = []
            score_val = 0
            if final_copy:
                final_copy, keywords = parse_copy_and_keywords(final_copy)
                relevance = await score_brand_relevance(final_copy, kb_context)
                score_val = relevance or (100 if is_approved else 70)
                try:
                    supabase_admin.table("copy_variants").insert({
                        "session_id": session_id,
                        "brand_id": payload.brand_id,
                        "model": "forge",
                        "format": payload.format,
                        "brief": payload.brief,
                        "content": final_copy,
                        "score": score_val,
                        "status": "pending",
                        "keywords": json.dumps(keywords),
                        "turn_id": turn_id,
                        "turn_type": "forge",
                        "agent_generator": generator_name,
                        "agent_critic": critic_name,
                    }).execute()
                except Exception as e:
                    logger.error(f"Failed to save forge variant: {e}")

            yield f"data: {json.dumps({'type': 'final', 'session_id': session_id, 'content': final_copy, 'keywords': keywords, 'score': score_val, 'is_approved': is_approved, 'turn_id': turn_id, 'generator': generator_name, 'critic': critic_name, 'turns': turns})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            logger.error(f"Forge stream failed: {e}")
            yield f"data: {json.dumps({'type': 'error', 'detail': f'{str(e)}. Make sure Ollama is running locally with mistral and gemma models.'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


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

    # Save the resulting variant if final copy was produced — same shape
    # as Single/Compare so it persists and reloads as a chat turn.
    turn_id = str(uuid.uuid4())
    final_copy = result["final_copy"]
    keywords = []
    if final_copy:
        final_copy, keywords = parse_copy_and_keywords(final_copy)
        relevance = await score_brand_relevance(final_copy, result.get("kb_context", {}))
        score_val = relevance or (100 if result["is_approved"] else 70)
        supabase_admin.table("copy_variants").insert({
            "session_id": session_id,
            "brand_id": payload.brand_id,
            "model": "forge",
            "format": payload.format,
            "brief": payload.brief,
            "content": final_copy,
            "score": score_val,
            "status": "pending",
            "keywords": json.dumps(keywords),
            "turn_id": turn_id,
            "turn_type": "forge",
            "agent_generator": result["generator"],
            "agent_critic": result["critic"],
        }).execute()
    else:
        score_val = 0

    return ForgeResponse(
        session_id=session_id,
        generator=result["generator"],
        critic=result["critic"],
        debate_history=result["debate_history"],
        final_copy=final_copy,
        turns=result["turns"],
        is_approved=result["is_approved"],
        keywords=keywords,
        score=score_val,
        turn_id=turn_id,
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
    final_copy = result["final_copy"]
    keywords = []
    score_val = 0
    turn_id = None
    if final_copy:
        final_copy, keywords = parse_copy_and_keywords(final_copy)
        relevance = await score_brand_relevance(final_copy, result.get("kb_context", {}))
        score_val = relevance or (100 if result["is_approved"] else 70)

        existing = (
            supabase_admin.table("copy_variants")
            .select("id, turn_id")
            .eq("session_id", payload.session_id)
            .eq("model", "forge")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )

        if existing.data:
            turn_id = existing.data[0].get("turn_id") or str(uuid.uuid4())
            supabase_admin.table("copy_variants").update({
                "content": final_copy,
                "score": score_val,
                "keywords": json.dumps(keywords),
                "turn_id": turn_id,
                "turn_type": "forge",
                "agent_generator": result["generator"],
                "agent_critic": result["critic"],
            }).eq("id", existing.data[0]["id"]).execute()
        else:
            turn_id = str(uuid.uuid4())
            supabase_admin.table("copy_variants").insert({
                "session_id": payload.session_id,
                "brand_id": payload.brand_id,
                "model": "forge",
                "format": "caption",
                "brief": payload.brief,
                "content": final_copy,
                "score": score_val,
                "status": "pending",
                "keywords": json.dumps(keywords),
                "turn_id": turn_id,
                "turn_type": "forge",
                "agent_generator": result["generator"],
                "agent_critic": result["critic"],
            }).execute()

    return ForgeResponse(
        session_id=payload.session_id,
        generator=result["generator"],
        critic=result["critic"],
        debate_history=result["debate_history"],
        final_copy=final_copy,
        turns=result["turns"],
        is_approved=result["is_approved"],
        keywords=keywords,
        score=score_val,
        turn_id=turn_id,
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


# ── GET /api/forge/result/{session_id} ────────────────────────────
@router.get("/result/{session_id}")
async def get_forge_result(
    session_id: str,
    current_user: dict = Depends(require_any),
):
    """
    Returns the saved Forge result for a session so the Forge tab can
    reload it as a card (same as Single/Compare reloading from the thread).
    """
    supabase = get_supabase()

    response = (
        supabase.table("copy_variants")
        .select("*")
        .eq("session_id", session_id)
        .eq("model", "forge")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not response.data:
        return None

    v = response.data[0]
    keywords = v.get("keywords")
    if isinstance(keywords, str):
        try:
            keywords = json.loads(keywords)
        except Exception:
            keywords = []

    return {
        "session_id": session_id,
        "content": v.get("content", ""),
        "keywords": keywords or [],
        "score": v.get("score", 0),
        "format": v.get("format", "caption"),
        "status": v.get("status", "pending"),
        "generator": v.get("agent_generator"),
        "critic": v.get("agent_critic"),
        "brief": v.get("brief", ""),
    }


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