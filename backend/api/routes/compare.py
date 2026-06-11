from fastapi import APIRouter, HTTPException, Depends, status, Request
from loguru import logger
from pydantic import BaseModel
from typing import Optional

from db.supabase_client import get_supabase, get_supabase_admin
from schemas.brief import BriefPayload, ModelType
from schemas.variant import VariantResponse
from api.middleware.auth_guard import get_current_user
from api.middleware.role_guard import require_any
from api.middleware.rate_limiter import limiter
from agents.orchestrator import run_compare
from api.routes.copy import build_user_prompt

router = APIRouter(prefix="/api/compare", tags=["Compare Mode"])


# ── Compare-specific payload — extends brief with two models ──────
class ComparePayload(BriefPayload):
    model_a: ModelType = ModelType.claude_haiku
    model_b: ModelType = ModelType.gemini_flash


class CompareResponse(BaseModel):
    session_id: str
    variant_a: VariantResponse
    variant_b: VariantResponse


# ── POST /api/compare ──────────────────────────────────────────────
@router.post("/", response_model=CompareResponse)
@limiter.limit("10/minute")
async def compare_generate(
    request: Request,
    payload: ComparePayload,
    current_user: dict = Depends(require_any),
):
    """
    Compare mode generation.
    Sends the same brief to two different models simultaneously.
    Returns both outputs side by side for comparison.
    Both receive identical KB context — only the model differs.
    """
    supabase_admin = get_supabase_admin()

    # Build user prompt from brief fields — same as Single mode
    user_prompt = build_user_prompt(payload)

    # Get or create chat session
    session_id = payload.session_id
    if not session_id:
        session_response = (    
            supabase_admin.table("chat_sessions")
            .insert({
                "user_id": current_user["id"],
                "brand_id": payload.brand_id,
                "mode": "compare",
                "title": user_prompt[:50],
            })
            .execute()
        )
        session_id = session_response.data[0]["id"]

    logger.info(
        f"Compare request | "
        f"User: {current_user['email']} | "
        f"Brand: {payload.brand_id} | "
        f"{payload.model_a.value} vs {payload.model_b.value}"
    )

    try:
        result = await run_compare(
            brand_id=payload.brand_id,
            user_prompt=user_prompt,
            format=payload.format.value,
            model_a=payload.model_a.value,
            model_b=payload.model_b.value,
            session_id=session_id,
        )
    except Exception as e:
        logger.error(f"Compare generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Compare generation failed: {str(e)}",
        )

    # Save both variants to database
    variant_a_response = (
        supabase_admin.table("copy_variants")
        .insert({
            "session_id": session_id,
            "brand_id": payload.brand_id,
            "model": result["model_a"]["model"],
            "format": result["model_a"]["format"],
            "brief": user_prompt,
            "content": result["model_a"]["copy"],
            "score": result["model_a"]["score"],
            "status": "pending",
        })
        .execute()
    )

    variant_b_response = (
        supabase_admin.table("copy_variants")
        .insert({
            "session_id": session_id,
            "brand_id": payload.brand_id,
            "model": result["model_b"]["model"],
            "format": result["model_b"]["format"],
            "brief": user_prompt,
            "content": result["model_b"]["copy"],
            "score": result["model_b"]["score"],
            "status": "pending",
        })
        .execute()
    )

    return CompareResponse(
        session_id=session_id,
        variant_a=VariantResponse(**variant_a_response.data[0]),
        variant_b=VariantResponse(**variant_b_response.data[0]),
    )


# ── GET /api/compare/sessions/{brand_id} ──────────────────────────
@router.get("/sessions/{brand_id}")
async def get_compare_sessions(
    brand_id: str,
    current_user: dict = Depends(require_any),
):
    """
    Returns recent Compare mode sessions for a brand.
    """
    supabase = get_supabase()

    response = (
        supabase.table("chat_sessions")
        .select("*")
        .eq("brand_id", brand_id)
        .eq("user_id", current_user["id"])
        .eq("mode", "compare")
        .order("is_pinned", desc=True)
        .order("updated_at", desc=True)
        .execute()
    )

    return response.data


# ── GET /api/compare/session/{session_id} ─────────────────────────
@router.get("/session/{session_id}")
async def get_compare_session_variants(
    session_id: str,
    current_user: dict = Depends(require_any),
):
    """
    Returns all variants for a Compare session.
    Used to restore a previous comparison when user clicks a session.
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