from fastapi import APIRouter, HTTPException, Depends, status
from loguru import logger

from db.supabase_client import get_supabase, get_supabase_admin
from schemas.insights import InsightCreate, InsightUpdate, InsightResponse
from api.middleware.auth_guard import get_current_user
from api.middleware.role_guard import require_any

router = APIRouter(prefix="/api/insights", tags=["Insights"])

# VOICE spec — 25 notes maximum per brand
MAX_NOTES_PER_BRAND = 25


# ── GET /api/insights/{brand_id} ──────────────────────────────────
@router.get("/{brand_id}", response_model=list[InsightResponse])
async def get_insights(
    brand_id: str,
    current_user: dict = Depends(require_any),
):
    """
    Returns all insight notes for a brand.
    Pinned notes appear first, then sorted by most recent.
    """
    supabase = get_supabase()

    response = (
        supabase.table("insights")
        .select("*")
        .eq("brand_id", brand_id)
        .order("is_pinned", desc=True)
        .order("created_at", desc=True)
        .execute()
    )

    return [InsightResponse(**note) for note in response.data]


# ── POST /api/insights ─────────────────────────────────────────────
@router.post("/", response_model=InsightResponse, status_code=status.HTTP_201_CREATED)
async def create_insight(
    payload: InsightCreate,
    current_user: dict = Depends(require_any),
):
    """
    Creates a new insight note for a brand.
    Enforces 25-note cap per brand — VOICE spec.
    Returns 400 if brand board is full.
    """
    supabase_admin = get_supabase_admin()

    # ── Check 25-note cap ──────────────────────────────────────────
    count_response = (
        supabase_admin.table("insights")
        .select("id", count="exact")
        .eq("brand_id", payload.brand_id)
        .execute()
    )

    current_count = count_response.count or 0

    if current_count >= MAX_NOTES_PER_BRAND:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"This brand's Insights board is full ({MAX_NOTES_PER_BRAND}/25). "
                "Delete an old note before adding a new one."
            ),
        )

    # Insert new note
    response = (
        supabase_admin.table("insights")
        .insert({
            "brand_id": payload.brand_id,
            "user_id": current_user["id"],
            "content": payload.content,
            "color": payload.color,
            "tag": payload.tag.value if payload.tag else None,
            "is_pinned": payload.is_pinned,
        })
        .execute()
    )

    logger.info(
        f"Insight created | "
        f"Brand: {payload.brand_id} | "
        f"By: {current_user['email']} | "
        f"Count: {current_count + 1}/{MAX_NOTES_PER_BRAND}"
    )

    return InsightResponse(**response.data[0])


# ── PATCH /api/insights/{note_id} ─────────────────────────────────
@router.patch("/{note_id}", response_model=InsightResponse)
async def update_insight(
    note_id: str,
    payload: InsightUpdate,
    current_user: dict = Depends(require_any),
):
    """
    Updates an existing insight note.
    Used for editing content, changing colour, tag, or pin status.
    """
    supabase_admin = get_supabase_admin()

    update_data = payload.model_dump(exclude_none=True)

    # Convert enum to string value if tag is being updated
    if "tag" in update_data and update_data["tag"] is not None:
        update_data["tag"] = update_data["tag"].value if hasattr(update_data["tag"], "value") else update_data["tag"]

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update",
        )

    response = (
        supabase_admin.table("insights")
        .update(update_data)
        .eq("id", note_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found",
        )

    return InsightResponse(**response.data[0])


# ── PATCH /api/insights/{note_id}/pin ─────────────────────────────
@router.patch("/{note_id}/pin", response_model=InsightResponse)
async def toggle_pin(
    note_id: str,
    current_user: dict = Depends(require_any),
):
    """
    Toggles pin status on a note.
    Pinned notes always stay at the top regardless of filters.
    """
    supabase_admin = get_supabase_admin()

    note_response = (
        supabase_admin.table("insights")
        .select("is_pinned")
        .eq("id", note_id)
        .single()
        .execute()
    )

    if not note_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found",
        )

    new_pin_status = not note_response.data["is_pinned"]

    response = (
        supabase_admin.table("insights")
        .update({"is_pinned": new_pin_status})
        .eq("id", note_id)
        .execute()
    )

    return InsightResponse(**response.data[0])


# ── DELETE /api/insights/{note_id} ────────────────────────────────
@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_insight(
    note_id: str,
    current_user: dict = Depends(require_any),
):
    """
    Permanently deletes an insight note.
    Frees up a slot in the 25-note cap.
    """
    supabase_admin = get_supabase_admin()

    existing = (
        supabase_admin.table("insights")
        .select("id")
        .eq("id", note_id)
        .execute()
    )

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found",
        )

    supabase_admin.table("insights").delete().eq("id", note_id).execute()

    logger.info(f"Insight deleted: {note_id} by {current_user['email']}")


# ── GET /api/insights/{brand_id}/count ────────────────────────────
@router.get("/{brand_id}/count")
async def get_insights_count(
    brand_id: str,
    current_user: dict = Depends(require_any),
):
    """
    Returns current note count and cap for a brand.
    Used by frontend to show the progress bar:
    Green (plenty of space) / Orange (getting full) / Red (full).
    """
    supabase = get_supabase()

    count_response = (
        supabase.table("insights")
        .select("id", count="exact")
        .eq("brand_id", brand_id)
        .execute()
    )

    current_count = count_response.count or 0

    # Determine status colour per VOICE spec
    if current_count >= MAX_NOTES_PER_BRAND:
        bar_status = "red"       # Full
    elif current_count >= MAX_NOTES_PER_BRAND - 5:
        bar_status = "orange"    # Getting full
    else:
        bar_status = "green"     # Plenty of space

    return {
        "current": current_count,
        "max": MAX_NOTES_PER_BRAND,
        "status": bar_status,
    }