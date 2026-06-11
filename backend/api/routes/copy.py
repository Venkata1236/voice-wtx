from fastapi import APIRouter, HTTPException, Depends, status, Request
from loguru import logger

from db.supabase_client import get_supabase, get_supabase_admin
from schemas.brief import BriefPayload
from schemas.variant import VariantResponse, ApproveRequest, RejectRequest
from api.middleware.auth_guard import get_current_user
from api.middleware.role_guard import require_any
from api.middleware.rate_limiter import limiter
from agents.orchestrator import run_single_three_variants

router = APIRouter(prefix="/api/copy", tags=["Copy Generation"])


# ── Helper — assemble user prompt from brief fields ───────────────
def build_user_prompt(payload: BriefPayload) -> str:
    """
    Converts structured brief fields into a single prompt string.
    If raw_brief is provided (Option B — type directly), use that instead.
    """
    if payload.raw_brief:
        return payload.raw_brief

    lines = [f"Format: {payload.format.value}"]

    if payload.platform:
        lines.append(f"Platform: {payload.platform}")
    if payload.objective:
        lines.append(f"Objective: {payload.objective}")
    if payload.hero_product:
        lines.append(f"Hero Product: {payload.hero_product}")
    if payload.cta:
        lines.append(f"Call to Action: {payload.cta}")
    if payload.tone_override:
        lines.append(f"Tone Override: {payload.tone_override}")
    if payload.length:
        lines.append(f"Length: {payload.length}")
    if payload.notes:
        lines.append(f"Notes: {payload.notes}")

    return "\n".join(lines)


# ── POST /api/copy/generate ───────────────────────────────────────
@router.post("/generate", response_model=list[VariantResponse])
@limiter.limit("10/minute")
async def generate_copy(
    request: Request,
    payload: BriefPayload,
    current_user: dict = Depends(require_any),
):
    """
    Single mode generation.
    Generates 3 copy variants for the given brief.
    Each variant goes through the full LangGraph pipeline:
    KB → Generate → Score → Format
    """
    supabase_admin = get_supabase_admin()

    # Build user prompt from brief fields
    user_prompt = build_user_prompt(payload)

    # Get or create chat session
    session_id = payload.session_id
    if not session_id:
        session_response = (
            supabase_admin.table("chat_sessions")
            .insert({
                "user_id": current_user["id"],
                "brand_id": payload.brand_id,
                "mode": "single",
                "title": user_prompt[:50],
            })
            .execute()
        )
        session_id = session_response.data[0]["id"]

    logger.info(
        f"Generate request | "
        f"User: {current_user['email']} | "
        f"Brand: {payload.brand_id} | "
        f"Model: {payload.model.value}"
    )

    try:
        # Run 3 variants in parallel through LangGraph
        results = await run_single_three_variants(
            brand_id=payload.brand_id,
            user_prompt=user_prompt,
            format=payload.format.value,
            model=payload.model.value,
            session_id=session_id,
        )
    except Exception as e:
        logger.error(f"Generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Copy generation failed: {str(e)}",
        )

    # Save each variant to database
    variants = []
    for result in results:
        variant_response = (
            supabase_admin.table("copy_variants")
            .insert({
                "session_id": session_id,
                "brand_id": payload.brand_id,
                "model": result["model"],
                "format": result["format"],
                "brief": user_prompt,
                "content": result["copy"],
                "score": result["score"],
                "status": "pending",
            })
            .execute()
        )
        variants.append(VariantResponse(**variant_response.data[0]))

    return variants


# ── POST /api/copy/approve ─────────────────────────────────────────
@router.post("/approve")
async def approve_variant(
    payload: ApproveRequest,
    current_user: dict = Depends(require_any),
):
    """
    Approves a copy variant.
    - Marks variant as approved
    - Saves to approved_posts table — AI learns from this
    - If already approved — clicking again unapproves it (toggle)
    """
    supabase_admin = get_supabase_admin()

    # Fetch the variant
    variant_response = (
        supabase_admin.table("copy_variants")
        .select("*")
        .eq("id", payload.variant_id)
        .single()
        .execute()
    )

    if not variant_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Variant not found",
        )

    variant = variant_response.data

    # ── Toggle — if already approved, unapprove ───────────────────
    if variant["status"] == "approved":
        # Update variant status back to pending
        supabase_admin.table("copy_variants").update(
            {"status": "pending"}
        ).eq("id", payload.variant_id).execute()

        # Remove from approved_posts
        supabase_admin.table("approved_posts").delete().eq(
            "variant_id", payload.variant_id
        ).execute()

        logger.info(f"Variant unapproved: {payload.variant_id}")

        return {"message": "Variant unapproved", "status": "pending"}

    # ── Approve ─────────────────────────────────────────────────────
    supabase_admin.table("copy_variants").update(
        {"status": "approved"}
    ).eq("id", payload.variant_id).execute()

    # Save to approved_posts — AI learns from this for future generations
    supabase_admin.table("approved_posts").insert({
        "brand_id": payload.brand_id,
        "variant_id": payload.variant_id,
        "content": variant["content"],
        "format": variant["format"],
        "model": variant["model"],
    }).execute()

    logger.info(
        f"Variant approved: {payload.variant_id} | "
        f"By: {current_user['email']}"
    )

    return {"message": "Variant approved", "status": "approved"}


# ── POST /api/copy/reject ──────────────────────────────────────────
@router.post("/reject", response_model=list[VariantResponse])
async def reject_variant(
    payload: RejectRequest,
    current_user: dict = Depends(require_any),
):
    """
    Rejects a copy variant with a reason.
    Immediately generates a revised version using the rejection
    reason as additional guidance.
    Rejected card stays visible but dimmed on frontend.
    Returns the new revised variants.
    """
    supabase_admin = get_supabase_admin()

    # Fetch the variant being rejected
    variant_response = (
        supabase_admin.table("copy_variants")
        .select("*")
        .eq("id", payload.variant_id)
        .single()
        .execute()
    )

    if not variant_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Variant not found",
        )

    variant = variant_response.data

    # Determine final rejection reason text
    reason_text = (
        payload.custom_reason
        if payload.reason.value == "client_preference" and payload.custom_reason
        else payload.reason.value.replace("_", " ")
    )

    # Mark variant as rejected
    supabase_admin.table("copy_variants").update({
        "status": "rejected",
        "rejection_reason": reason_text,
    }).eq("id", payload.variant_id).execute()

    logger.info(
        f"Variant rejected: {payload.variant_id} | "
        f"Reason: {reason_text} | By: {current_user['email']}"
    )

    # ── Generate revised version using rejection reason as guidance ──
    revised_prompt = (
        f"{variant['brief']}\n\n"
        f"IMPORTANT — Previous attempt was rejected for: {reason_text}.\n"
        f"Previous attempt: {variant['content']}\n"
        f"Fix this issue in the new version."
    )

    try:
        results = await run_single_three_variants(
            brand_id=payload.brand_id,
            user_prompt=revised_prompt,
            format=variant["format"],
            model=variant["model"],
            session_id=variant["session_id"],
        )
    except Exception as e:
        logger.error(f"Revision generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Revision generation failed: {str(e)}",
        )

    # Save revised variants
    new_variants = []
    for result in results:
        new_variant_response = (
            supabase_admin.table("copy_variants")
            .insert({
                "session_id": variant["session_id"],
                "brand_id": payload.brand_id,
                "model": result["model"],
                "format": result["format"],
                "brief": variant["brief"],
                "content": result["copy"],
                "score": result["score"],
                "status": "pending",
            })
            .execute()
        )
        new_variants.append(VariantResponse(**new_variant_response.data[0]))

    return new_variants


# ── GET /api/copy/session/{session_id} ────────────────────────────
@router.get("/session/{session_id}", response_model=list[VariantResponse])
async def get_session_variants(
    session_id: str,
    current_user: dict = Depends(require_any),
):
    """
    Returns all variants for a chat session.
    Used when user clicks a recent session to restore the conversation.
    """
    supabase = get_supabase()

    response = (
        supabase.table("copy_variants")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )

    return [VariantResponse(**v) for v in response.data]


# ── GET /api/copy/sessions/{brand_id} ─────────────────────────────
@router.get("/sessions/{brand_id}")
async def get_brand_sessions(
    brand_id: str,
    current_user: dict = Depends(require_any),
):
    """
    Returns recent chat sessions for a brand.
    Shown below brand name in sidebar.
    Sessions older than 90 days are automatically excluded.
    """
    supabase = get_supabase()

    response = (
        supabase.table("chat_sessions")
        .select("*")
        .eq("brand_id", brand_id)
        .eq("user_id", current_user["id"])
        .eq("mode", "single")
        .order("is_pinned", desc=True)
        .order("updated_at", desc=True)
        .execute()
    )

    return response.data


# ── PATCH /api/copy/session/{session_id}/pin ──────────────────────
@router.patch("/session/{session_id}/pin")
async def pin_session(
    session_id: str,
    current_user: dict = Depends(require_any),
):
    """
    Toggles pin status on a chat session.
    Pinned sessions are kept indefinitely and shown at top of sidebar.
    """
    supabase_admin = get_supabase_admin()

    session_response = (
        supabase_admin.table("chat_sessions")
        .select("is_pinned")
        .eq("id", session_id)
        .single()
        .execute()
    )

    if not session_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    new_pin_status = not session_response.data["is_pinned"]

    supabase_admin.table("chat_sessions").update(
        {"is_pinned": new_pin_status}
    ).eq("id", session_id).execute()

    return {"is_pinned": new_pin_status}