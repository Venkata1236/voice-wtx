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
from utils.titler import generate_session_title
from utils.length_guide import build_length_instruction
from utils.vision import extract_visual_context, extract_visual_context_multi
from utils.scorer import score_brand_relevance
import json as json_lib
import uuid
import asyncio

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
    """
    return {
        "priority": [
            {"value": "claude-haiku-4-5", "label": "Claude Haiku 4.5", "provider": "Anthropic"},
            {"value": "sarvam-30b", "label": "Sarvam 30B", "provider": "Sarvam"},
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
    Compare mode generation (non-streaming).
    Both variants share one turn_id (turn_type = 'compare').
    """
    supabase_admin = get_supabase_admin()

    user_prompt = build_user_prompt(payload)

    # One turn_id for both panes of this send
    turn_id = payload.turn_id or str(uuid.uuid4())

    # Get or create chat session (unified 'chat' mode)
    session_id = payload.session_id

    session_exists = False
    if session_id:
        check = (
            supabase_admin.table("chat_sessions")
            .select("id")
            .eq("id", session_id)
            .limit(1)
            .execute()
        )
        session_exists = bool(check and check.data and len(check.data) > 0)

    if not session_exists:
        session_response = (
            supabase_admin.table("chat_sessions")
            .insert({
                "user_id": current_user["id"],
                "brand_id": payload.brand_id,
                "mode": "chat",
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
            "turn_id": turn_id,
            "turn_type": "compare",
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
            "turn_id": turn_id,
            "turn_type": "compare",
        })
        .execute()
    )

    return CompareResponse(
        session_id=session_id,
        variant_a=VariantResponse.from_db(variant_a_response.data[0]),
        variant_b=VariantResponse.from_db(variant_b_response.data[0]),
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
    Streaming Compare mode — both panes stream sequentially.
    Both variants share one turn_id (turn_type = 'compare') so the
    turn replays as a side-by-side pair when the chat is reopened.
    """
    supabase_admin = get_supabase_admin()
    user_prompt = build_user_prompt(payload)

    # One turn_id for both panes of this send
    turn_id = payload.turn_id or str(uuid.uuid4())

    session_id = payload.session_id

    # Verify the session still exists — it may have been deleted while cached in localStorage
    session_exists = False
    if session_id:
        check = (
            supabase_admin.table("chat_sessions")
            .select("id")
            .eq("id", session_id)
            .limit(1)
            .execute()
        )
        session_exists = bool(check and check.data and len(check.data) > 0)

    # Create new session if none provided OR the provided one was deleted
    created_new = not session_exists
    if created_new:
        session_response = (
            supabase_admin.table("chat_sessions")
            .insert({
                "user_id": current_user["id"],
                "brand_id": payload.brand_id,
                "mode": "chat",
                "title": user_prompt[:50],
            })
            .execute()
        )
        session_id = session_response.data[0]["id"]

    async def event_generator():
        yield f"data: {json_lib.dumps({'type': 'session', 'session_id': session_id, 'turn_id': turn_id, 'turn_type': 'compare'})}\n\n"

        kb_context = await build_kb_context(payload.brand_id)
        system_prompt = format_kb_for_prompt(kb_context)
        system_prompt += "\n\n" + build_length_instruction(payload.format.value, user_prompt)

        # ── Vision: start extraction in parallel — don't block the stream ──
        effective_prompt = user_prompt
        if getattr(payload, 'image_urls', None) or getattr(payload, 'image_url', None):
            _urls = getattr(payload, 'image_urls', None) or [getattr(payload, 'image_url', None)]
            _urls = [u for u in _urls if u]
            vision_task = asyncio.create_task(extract_visual_context_multi(_urls))
            yield f"data: {json_lib.dumps({'type': 'vision_reading'})}\n\n"
            visual_context = await vision_task
            if visual_context:
                effective_prompt = (
                    f"VISUAL CONTEXT (extracted from attached image):\n{visual_context}\n\n"
                    f"BRIEF:\n{user_prompt}"
                )
                yield f"data: {json_lib.dumps({'type': 'vision_done', 'context': visual_context})}\n\n"

        # ── Both panes run CONCURRENTLY ──────────────────────────────
        # Each pane streams its events into a shared queue; the generator
        # drains the queue and interleaves both panes into the one SSE stream.
        queue: asyncio.Queue = asyncio.Queue()
        _SENTINEL = object()

        async def run_pane(pane_index: int, model: str):
            await queue.put(f"data: {json_lib.dumps({'type': 'pane_start', 'index': pane_index, 'model': model})}\n\n")

            full_content = ""
            try:
                async for chunk in stream_from_model(
                    model=model,
                    system_prompt=system_prompt,
                    user_prompt=effective_prompt,
                ):
                    full_content += chunk
                    if 'KEYWORDS:' not in full_content:
                        await queue.put(f"data: {json_lib.dumps({'type': 'token', 'index': pane_index, 'text': chunk})}\n\n")
                    else:
                        copy_part = full_content.split('KEYWORDS:')[0]
                        already_sent = full_content.replace(chunk, '')
                        new_copy = copy_part[len(already_sent):]
                        if new_copy:
                            await queue.put(f"data: {json_lib.dumps({'type': 'token', 'index': pane_index, 'text': new_copy})}\n\n")
            except Exception as e:
                logger.error(f"Streaming error for pane {pane_index} model {model}: {e}")

            final_copy, keywords = parse_copy_and_keywords(full_content)

            logger.info(
                f"Compare stream pane {pane_index} | Model: {model} | "
                f"Final copy length: {len(final_copy)} | Keywords: {keywords}"
            )

            # Save immediately with score=0 placeholder
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
                        "score": 0,
                        "status": "pending",
                        "keywords": keywords,
                        "turn_id": turn_id,
                        "turn_type": "compare",
                        "image_url": (getattr(payload, "image_urls", None) or [getattr(payload, "image_url", None)])[0] if (getattr(payload, "image_urls", None) or getattr(payload, "image_url", None)) else None,
                        "image_urls": (getattr(payload, "image_urls", None) or ([getattr(payload, "image_url", None)] if getattr(payload, "image_url", None) else [])),
                    })
                    .execute()
                )
                variant_id = variant_response.data[0]["id"]
            except Exception as e:
                logger.error(f"Failed to save compare variant {pane_index}: {e}")

            await queue.put(f"data: {json_lib.dumps({'type': 'pane_done', 'index': pane_index, 'variant_id': variant_id, 'session_id': session_id, 'turn_id': turn_id, 'turn_type': 'compare', 'keywords': keywords, 'model': model, 'format': payload.format.value, 'brand_id': payload.brand_id, 'content': final_copy, 'score': 0})}\n\n")

            # Score in background
            relevance = await score_brand_relevance(final_copy, kb_context)
            if relevance and variant_id:
                try:
                    supabase_admin.table("copy_variants").update({"score": relevance}).eq("id", variant_id).execute()
                except Exception:
                    pass
            await queue.put(f"data: {json_lib.dumps({'type': 'score_update', 'index': pane_index, 'variant_id': variant_id, 'score': relevance})}\n\n")

        # Launch both panes at once
        pane_tasks = [
            asyncio.create_task(run_pane(0, payload.model_a.value)),
            asyncio.create_task(run_pane(1, payload.model_b.value)),
        ]

        async def _close_when_done():
            await asyncio.gather(*pane_tasks)
            await queue.put(_SENTINEL)

        closer = asyncio.create_task(_close_when_done())

        # Drain the queue, interleaving both panes' events as they arrive
        while True:
            item = await queue.get()
            if item is _SENTINEL:
                break
            yield item

        await closer

        # Auto-name a brand-new chat with a concise title (ChatGPT-style).
        if created_new:
            try:
                new_title = await generate_session_title(user_prompt)
                supabase_admin.table("chat_sessions").update(
                    {"title": new_title}
                ).eq("id", session_id).execute()
                yield f"data: {json_lib.dumps({'type': 'title', 'session_id': session_id, 'title': new_title})}\n\n"
            except Exception as e:
                logger.error(f"Failed to set session title: {e}")

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
    Returns recent sessions for a brand.
    NOTE: In the unified Chat model the sidebar uses /api/copy/sessions
    instead. Kept for backward compatibility.
    """
    supabase = get_supabase()

    response = (
        supabase.table("chat_sessions")
        .select("*")
        .eq("brand_id", brand_id)
        .eq("user_id", current_user["id"])
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
    Returns the two latest distinct-model variants for a compare session.
    Kept for backward compatibility — the unified Chat view uses
    /api/copy/thread/{session_id} instead.
    """
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