from fastapi import APIRouter, HTTPException, Depends, status, Request
from loguru import logger

from db.supabase_client import get_supabase, get_supabase_admin
from schemas.brief import BriefPayload
from schemas.variant import VariantResponse, ApproveRequest, RejectRequest, ChatTurn, ChatThread
from api.middleware.auth_guard import get_current_user
from api.middleware.role_guard import require_any
from api.middleware.rate_limiter import limiter
from agents.orchestrator import run_single_three_variants
from fastapi.responses import StreamingResponse
from models.router import stream_from_model
from kb.kb_builder import build_kb_context, format_kb_for_prompt
from utils.titler import generate_session_title
from utils.length_guide import build_length_instruction
from utils.vision import extract_visual_context, extract_visual_context_multi
from utils.scorer import score_brand_relevance
import json
import uuid

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
    Single mode generation (non-streaming).
    Generates 3 copy variants for the given brief.
    """
    supabase_admin = get_supabase_admin()

    user_prompt = build_user_prompt(payload)

    # One turn_id for all 3 variants of this send
    turn_id = payload.turn_id or str(uuid.uuid4())

    # Get or create chat session (unified 'chat' mode)
    session_id = payload.session_id
    if not session_id:
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
        f"Generate request | "
        f"User: {current_user['email']} | "
        f"Brand: {payload.brand_id} | "
        f"Model: {payload.model.value}"
    )

    try:
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
                "turn_id": turn_id,
                "turn_type": "single",
            })
            .execute()
        )
        variant_obj = VariantResponse.from_db(variant_response.data[0])
        variant_obj.keywords = result.get("keywords", [])
        variants.append(variant_obj)

    return variants


# ── POST /api/copy/generate-stream ────────────────────────────────
@router.post("/generate-stream")
@limiter.limit("10/minute")
async def generate_copy_stream(
    request: Request,
    payload: BriefPayload,
    current_user: dict = Depends(require_any),
):
    """
    Streaming Single-mode generation — SSE.
    Sends 3 variants sequentially, each streamed token by token.
    All 3 variants share one turn_id (turn_type = 'single').
    """
    supabase_admin = get_supabase_admin()

    user_prompt = build_user_prompt(payload)

    # One turn_id for all 3 variants of this send
    turn_id = payload.turn_id or str(uuid.uuid4())

    # Verify the session still exists — it may have been deleted
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
        # Send session_id + turn_id first
        yield f"data: {json.dumps({'type': 'session', 'session_id': session_id, 'turn_id': turn_id, 'turn_type': 'single'})}\n\n"

        # Build KB context once for all 3 variants
        kb_context = await build_kb_context(payload.brand_id)
        system_prompt = format_kb_for_prompt(kb_context)
        system_prompt += "\n\n" + build_length_instruction(payload.format.value, user_prompt)

        effective_prompt = user_prompt
        # ── Refine: rewrite an existing response per the instruction ──
        if getattr(payload, 'refine_from', None):
            effective_prompt = (
                "You are refining a piece of existing marketing copy.\n\n"
                f"EXISTING COPY:\n{payload.refine_from}\n\n"
                f"REQUESTED CHANGE:\n{user_prompt}\n\n"
                "Apply the requested change fully \u2014 the result MUST clearly reflect it. "
                "Keep the brand voice and the core message/offer, but follow the requested "
                "change even when it alters the tone, length, or language (e.g. 'make it Tenglish' "
                "means rewrite it in a Hindi/Telugu-English mix). "
                "Do NOT return the original copy unchanged. Return only the revised copy."
            )
        # ── Vision: start extraction in parallel — don't block the stream ──
        elif getattr(payload, 'image_urls', None) or getattr(payload, 'image_url', None):
            import asyncio as _asyncio
            _urls = getattr(payload, 'image_urls', None) or [getattr(payload, 'image_url', None)]
            _urls = [u for u in _urls if u]
            vision_task = _asyncio.create_task(extract_visual_context_multi(_urls))
            yield f"data: {json.dumps({'type': 'vision_reading'})}\n\n"
            visual_context = await vision_task
            if visual_context:
                effective_prompt = (
                    f"VISUAL CONTEXT (extracted from attached image):\n{visual_context}\n\n"
                    f"BRIEF:\n{user_prompt}"
                )
                yield f"data: {json.dumps({'type': 'vision_done', 'context': visual_context})}\n\n"

        # Single mode now returns ONE response (was 3)
        for variant_index in range(1):
            yield f"data: {json.dumps({'type': 'variant_start', 'index': variant_index})}\n\n"

            full_content = ""

            async for chunk in stream_from_model(
                model=payload.model.value,
                system_prompt=system_prompt,
                user_prompt=effective_prompt,
            ):
                full_content += chunk
                if 'KEYWORDS:' not in full_content:
                    yield f"data: {json.dumps({'type': 'token', 'index': variant_index, 'text': chunk})}\n\n"
                else:
                    copy_part = full_content.split('KEYWORDS:')[0]
                    already_sent = full_content.replace(chunk, '')
                    new_copy = copy_part[len(already_sent):]
                    if new_copy:
                        yield f"data: {json.dumps({'type': 'token', 'index': variant_index, 'text': new_copy})}\n\n"

            from agents.langgraph.nodes.format_node import parse_copy_and_keywords
            final_copy, keywords = parse_copy_and_keywords(full_content)

            logger.info(
                f"Stream variant {variant_index} complete | "
                f"Keywords: {keywords} | "
                f"Copy length: {len(final_copy)}"
            )

            # Save to database immediately (score=0 placeholder)
            variant_id = None
            try:
                variant_response = (
                    supabase_admin.table("copy_variants")
                    .insert({
                        "session_id": session_id,
                        "brand_id": payload.brand_id,
                        "model": payload.model.value,
                        "format": payload.format.value,
                        "brief": user_prompt,
                        "content": final_copy,
                        "score": 0,
                        "status": "pending",
                        "keywords": json.dumps(keywords),
                        "turn_id": turn_id,
                        "turn_type": "single",
                        "image_url": (getattr(payload, "image_urls", None) or [getattr(payload, "image_url", None)])[0] if (getattr(payload, "image_urls", None) or getattr(payload, "image_url", None)) else None,
                        "image_urls": (getattr(payload, "image_urls", None) or ([getattr(payload, "image_url", None)] if getattr(payload, "image_url", None) else [])),
                    })
                    .execute()
                )
                variant_id = variant_response.data[0]["id"]
            except Exception as e:
                variant_id = None
                logger.error(f"Failed to save variant {variant_index}: {e}")

            # Emit variant_done immediately so the UI unlocks
            yield f"data: {json.dumps({'type': 'variant_done', 'index': variant_index, 'variant_id': variant_id, 'session_id': session_id, 'turn_id': turn_id, 'turn_type': 'single', 'keywords': keywords, 'model': payload.model.value, 'format': payload.format.value, 'brand_id': payload.brand_id, 'content': final_copy, 'score': 0})}\n\n"

            # Score in background — emits a score_update event when done
            relevance = await score_brand_relevance(final_copy, kb_context)
            if relevance and variant_id:
                try:
                    supabase_admin.table("copy_variants").update({"score": relevance}).eq("id", variant_id).execute()
                except Exception:
                    pass
            yield f"data: {json.dumps({'type': 'score_update', 'index': variant_index, 'variant_id': variant_id, 'score': relevance})}\n\n"

        # Auto-name a brand-new chat with a concise title (ChatGPT-style).
        # Only for newly created sessions — never overwrites a user rename.
        if created_new:
            try:
                new_title = await generate_session_title(user_prompt)
                supabase_admin.table("chat_sessions").update(
                    {"title": new_title}
                ).eq("id", session_id).execute()
                yield f"data: {json.dumps({'type': 'title', 'session_id': session_id, 'title': new_title})}\n\n"
            except Exception as e:
                logger.error(f"Failed to set session title: {e}")

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── POST /api/copy/approve ─────────────────────────────────────────
@router.post("/approve")
async def approve_variant(
    payload: ApproveRequest,
    current_user: dict = Depends(require_any),
):
    """
    Approves a copy variant (toggle).
    """
    supabase_admin = get_supabase_admin()

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
        supabase_admin.table("copy_variants").update(
            {"status": "pending"}
        ).eq("id", payload.variant_id).execute()

        supabase_admin.table("approved_posts").delete().eq(
            "variant_id", payload.variant_id
        ).execute()

        logger.info(f"Variant unapproved: {payload.variant_id}")
        return {"message": "Variant unapproved", "status": "pending"}

    # ── Approve ─────────────────────────────────────────────────────
    supabase_admin.table("copy_variants").update(
        {"status": "approved"}
    ).eq("id", payload.variant_id).execute()

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
    Rejects a copy variant with a reason, then generates a revised
    version. The revised variants form a NEW turn in the same chat.
    """
    supabase_admin = get_supabase_admin()

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

    reason_text = (
        payload.custom_reason
        if payload.reason.value == "client_preference" and payload.custom_reason
        else payload.reason.value.replace("_", " ")
    )

    supabase_admin.table("copy_variants").update({
        "status": "rejected",
        "rejection_reason": reason_text,
    }).eq("id", payload.variant_id).execute()

    logger.info(
        f"Variant rejected: {payload.variant_id} | "
        f"Reason: {reason_text} | By: {current_user['email']}"
    )

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

    # Revised variants form a new turn
    revised_turn_id = str(uuid.uuid4())

    new_variants = []
    # Single mode returns one response — keep one revised variant
    for result in results[:1]:
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
                "turn_id": revised_turn_id,
                "turn_type": "single",
            })
            .execute()
        )
        new_variants.append(VariantResponse.from_db(new_variant_response.data[0]))

    return new_variants


# ── GET /api/copy/thread/{session_id} ─────────────────────────────
@router.get("/thread/{session_id}", response_model=ChatThread)
async def get_chat_thread(
    session_id: str,
    current_user: dict = Depends(require_any),
):
    """
    Returns the WHOLE chat as an ordered list of turns.
    Each turn carries its type (single/compare) so the frontend can
    render it in the right layout — this is what lets a reopened chat
    replay a mix of Single and Compare turns exactly as they happened.
    """
    supabase = get_supabase()

    response = (
        supabase.table("copy_variants")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )

    rows = response.data or []

    # Group variants into turns (preserving chronological order)
    turns_map = {}      # turn_id -> ChatTurn dict
    order = []          # turn_id order of first appearance

    for row in rows:
        v = VariantResponse.from_db(row)
        # Fallback for any legacy row missing turn data
        tid = v.turn_id or f"legacy-{row['id']}"
        ttype = v.turn_type or "single"

        if tid not in turns_map:
            turns_map[tid] = {
                "turn_id": tid,
                "turn_type": ttype,
                "brief": v.brief,
                "created_at": v.created_at,
                "image_url": v.image_url,   # from first variant in this turn
                "image_urls": getattr(v, "image_urls", None),
                "variants": [],
            }
            order.append(tid)

        turns_map[tid]["variants"].append(v)

    # For compare turns, order panes consistently: claude/gpt/gemini left, sarvam right
    def pane_priority(variant):
        m = variant.model.lower()
        if "claude" in m:
            return 0
        if "gpt" in m:
            return 1
        if "gemini" in m:
            return 2
        if "sarvam" in m:
            return 3
        return 4

    turns = []
    for tid in order:
        t = turns_map[tid]
        if t["turn_type"] == "compare":
            t["variants"].sort(key=pane_priority)
        turns.append(ChatTurn(**t))

    return ChatThread(session_id=session_id, turns=turns)


# ── GET /api/copy/session/{session_id} ────────────────────────────
@router.get("/session/{session_id}", response_model=list[VariantResponse])
async def get_session_variants(
    session_id: str,
    current_user: dict = Depends(require_any),
):
    """
    Returns all variants for a chat session (flat list).
    Kept for backward compatibility.
    """
    supabase = get_supabase()

    response = (
        supabase.table("copy_variants")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )

    return [VariantResponse.from_db(v) for v in response.data]


# ── GET /api/copy/sessions/{brand_id} ─────────────────────────────
@router.get("/sessions/{brand_id}")
async def get_brand_sessions(
    brand_id: str,
    current_user: dict = Depends(require_any),
):
    """
    Returns recent chat sessions for a brand (all modes, unified list).
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


# ── PATCH /api/copy/session/{session_id}/pin ──────────────────────
@router.patch("/session/{session_id}/pin")
async def pin_session(
    session_id: str,
    current_user: dict = Depends(require_any),
):
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


# ── PATCH /api/copy/session/{session_id}/rename ───────────────────
@router.patch("/session/{session_id}/rename")
async def rename_session(
    session_id: str,
    title: str,
    current_user: dict = Depends(require_any),
):
    supabase_admin = get_supabase_admin()
    response = (
        supabase_admin.table("chat_sessions")
        .update({"title": title})
        .eq("id", session_id)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"message": "Renamed successfully"}


# ── DELETE /api/copy/session/{session_id} ─────────────────────────
@router.delete("/session/{session_id}")
async def delete_session(
    session_id: str,
    current_user: dict = Depends(require_any),
):
    supabase_admin = get_supabase_admin()
    supabase_admin.table("chat_sessions").delete().eq("id", session_id).execute()
    supabase_admin.table("copy_variants").delete().eq("session_id", session_id).execute()
    return {"message": "Session deleted"}