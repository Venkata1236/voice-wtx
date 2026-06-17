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
from fastapi.responses import StreamingResponse
from models.router import stream_from_model
from kb.kb_builder import build_kb_context, format_kb_for_prompt
from agents.langgraph.nodes.format_node import parse_copy_and_keywords
import json as json_lib

router = APIRouter(prefix="/api/compare", tags=["Compare Mode"])


# ── Compare-specific payload — extends brief with two models ──────
class ComparePayload(BriefPayload):
    # Priority defaults — Claude vs Sarvam
    # User can override with any ModelType value
    model_a: ModelType = ModelType.claude_haiku
    model_b: ModelType = ModelType.sarvam


class CompareResponse(BaseModel):
    session_id: str
    variant_a: VariantResponse
    variant_b: VariantResponse


# ── GET /api/compare/available-models ──────────────────────────────
@router.get("/available-models")
async def get_available_models(
    current_user: dict = Depends(require_any),
):
    """
    Returns models available for Compare mode, in priority order.
    Frontend uses this to populate the model pill dropdowns.
    Claude and Sarvam appear first as defaults.
    """
    return {
        "priority": [
            {"value": "claude-haiku-4-5", "label": "Claude Haiku 4.5", "provider": "Anthropic"},
            {"value": "sarvam-30b", "label": "Sarvam M", "provider": "Sarvam"},
        ],
        "alternatives": [
            {"value": "gpt-4o-mini", "label": "GPT-4o Mini", "provider": "OpenAI"},
            {"value": "gemini-1.5-flash", "label": "Gemini 1.5 Flash", "provider": "Google"},
        ],
        "default_a": "claude-haiku-4-5",
        "default_b": "sarvam-30b",
    }


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
    Default — Claude Haiku vs Sarvam M.
    User can override model_a / model_b to any supported model.
    Sends the same brief to both models simultaneously.
    Returns both outputs side by side for comparison.
    Both receive identical KB context — only the model differs.
    """
    supabase_admin = get_supabase_admin()

    # Build user prompt from brief fields — same as Single mode
    user_prompt = build_user_prompt(payload)

    # Get or create chat session
    session_id = payload.session_id

    session_exists = False
    if session_id:
        check = (
            supabase_admin.table("chat_sessions")
            .select("id")
            .eq("id", session_id)
            .maybe_single()
            .execute()
        )
        session_exists = bool(check and check.data)

    if not session_exists:
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

# ── POST /api/compare/stream ───────────────────────────────────────
@router.post("/stream")
@limiter.limit("10/minute")
async def compare_generate_stream(
    request: Request,
    payload: ComparePayload,
    current_user: dict = Depends(require_any),
):
    """
    Streaming Compare mode — both models stream simultaneously.
    Left pane (model A) and right pane (model B) fill in real time.
    """
    supabase_admin = get_supabase_admin()
    user_prompt = build_user_prompt(payload)

    session_id = payload.session_id

    # Verify the session still exists — it may have been deleted while ID was cached in localStorage
    session_exists = False
    if session_id:
        check = (
            supabase_admin.table("chat_sessions")
            .select("id")
            .eq("id", session_id)
            .maybe_single()
            .execute()
        )
        session_exists = bool(check and check.data)

    # Create new session if none provided OR the provided one was deleted
    if not session_exists:
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

    async def event_generator():
        yield f"data: {json_lib.dumps({'type': 'session', 'session_id': session_id})}\n\n"

        kb_context = await build_kb_context(payload.brand_id)
        system_prompt = format_kb_for_prompt(kb_context)

        for pane_index, model in enumerate([payload.model_a.value, payload.model_b.value]):
            yield f"data: {json_lib.dumps({'type': 'pane_start', 'index': pane_index, 'model': model})}\n\n"

            full_content = ""

            try:
                async for chunk in stream_from_model(
                    model=model,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                ):
                    full_content += chunk
                    if 'KEYWORDS:' not in full_content:
                        yield f"data: {json_lib.dumps({'type': 'token', 'index': pane_index, 'text': chunk})}\n\n"
                    else:
                        copy_part = full_content.split('KEYWORDS:')[0]
                        already_sent = full_content.replace(chunk, '')
                        new_copy = copy_part[len(already_sent):]
                        if new_copy:
                            yield f"data: {json_lib.dumps({'type': 'token', 'index': pane_index, 'text': new_copy})}\n\n"
            except Exception as e:
                logger.error(f"Streaming error for pane {pane_index} model {model}: {e}")

            # Parse copy and keywords — always runs even if streaming errored
            final_copy, keywords = parse_copy_and_keywords(full_content)

            logger.info(
                f"Compare stream pane {pane_index} | "
                f"Model: {model} | "
                f"Full content length: {len(full_content)} | "
                f"Final copy length: {len(final_copy)} | "
                f"Keywords: {keywords}"
            )

            # Save to DB — always runs
            variant_id = None
            try:
                variant_response = (
                    supabase_admin.table("copy_variants")
                    .insert({
                        "session_id": session_id,
                        "brand_id": payload.brand_id,
                        "model": model,
                        "format": payload.format.value,
                        "brief": user_prompt,
                        "content": final_copy,
                        "score": 70,
                        "status": "pending",
                        "keywords": json_lib.dumps(keywords),
                    })
                    .execute()
                )
                variant_id = variant_response.data[0]["id"]
            except Exception as e:
                logger.error(f"Failed to save compare variant {pane_index}: {e}")

            # pane_done — always runs regardless of DB save success
            yield f"data: {json_lib.dumps({'type': 'pane_done', 'index': pane_index, 'variant_id': variant_id, 'session_id': session_id, 'keywords': keywords, 'model': model, 'format': payload.format.value, 'brand_id': payload.brand_id, 'content': final_copy})}\n\n"

        yield f"data: {json_lib.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
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
    supabase = get_supabase()

    response = (
        supabase.table("copy_variants")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )

    variants = [VariantResponse.from_db(v) for v in response.data]

    if len(variants) >= 2:
        seen_models = {}
        for v in reversed(variants):
            if v.model not in seen_models:
                seen_models[v.model] = v
            if len(seen_models) == 2:
                break

        result = list(seen_models.values())

        # Always return claude/anthropic model first, sarvam second
        # so pills match content consistently
        def model_priority(v):
            if 'claude' in v.model.lower():
                return 0
            elif 'sarvam' in v.model.lower():
                return 1
            elif 'gpt' in v.model.lower():
                return 2
            return 3

        result.sort(key=model_priority)
        return result

    return variants