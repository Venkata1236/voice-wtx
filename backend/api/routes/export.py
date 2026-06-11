from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import PlainTextResponse
from loguru import logger

from db.supabase_client import get_supabase
from schemas.export import ExportRequest, ExportFormat, ExportFilter
from api.middleware.auth_guard import get_current_user
from api.middleware.role_guard import require_any
from kb.kb_builder import build_kb_context
from utils.formatter import (
    format_as_plain_text,
    format_as_csv,
    format_as_kb_archive,
    get_export_filename,
)

router = APIRouter(prefix="/api/export", tags=["Export"])


# ── POST /api/export ───────────────────────────────────────────────
@router.post("/")
async def export_copy(
    payload: ExportRequest,
    current_user: dict = Depends(require_any),
):
    """
    Exports copy variants in one of three formats.

    Formats:
    - plain_text: For Google Docs, WhatsApp, client decks
    - csv: For Buffer, Hootsuite, Google Sheets
    - kb_archive: Full archive with metadata for records

    Filters:
    - approved_only: Safe for client delivery (default)
    - all_variants: Includes rejected/unreviewed — internal use only

    Returns plain text content — frontend handles Copy or Download.
    """
    supabase = get_supabase()

    # ── Fetch brand name ───────────────────────────────────────────
    brand_response = (
        supabase.table("brands")
        .select("name")
        .eq("id", payload.brand_id)
        .single()
        .execute()
    )

    if not brand_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand not found",
        )

    brand_name = brand_response.data["name"]

    # ── Build query for variants ───────────────────────────────────
    query = (
        supabase.table("copy_variants")
        .select("*")
        .eq("brand_id", payload.brand_id)
    )

    # IMPORTANT — Approved Only filter for client safety
    # All Variants includes rejected and unreviewed copy — internal only
    if payload.filter == ExportFilter.approved_only:
        query = query.eq("status", "approved")

    # Filter by session if provided
    if payload.session_id:
        query = query.eq("session_id", payload.session_id)

    query = query.order("created_at", desc=True)

    response = query.execute()
    variants = response.data

    if not variants:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "No copy found to export. "
                + (
                    "Try 'All Variants' filter."
                    if payload.filter == ExportFilter.approved_only
                    else "Generate some copy first."
                )
            ),
        )

    # ── Format based on requested export type ──────────────────────
    if payload.format == ExportFormat.plain_text:
        content = format_as_plain_text(variants, brand_name)
        media_type = "text/plain"

    elif payload.format == ExportFormat.csv:
        content = format_as_csv(variants, brand_name)
        media_type = "text/csv"

    elif payload.format == ExportFormat.kb_archive:
        kb_context = await build_kb_context(payload.brand_id)
        content = format_as_kb_archive(variants, brand_name, kb_context)
        media_type = "text/plain"

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid export format",
        )

    filename = get_export_filename(brand_name, payload.format.value)

    logger.info(
        f"Export generated | "
        f"Brand: {brand_name} | "
        f"Format: {payload.format.value} | "
        f"Filter: {payload.filter.value} | "
        f"Variants: {len(variants)} | "
        f"By: {current_user['email']}"
    )

    return PlainTextResponse(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Filename": filename,
            "X-Variant-Count": str(len(variants)),
        },
    )


# ── GET /api/export/{brand_id}/preview ────────────────────────────
@router.get("/{brand_id}/preview")
async def export_preview(
    brand_id: str,
    filter: ExportFilter = ExportFilter.approved_only,
    current_user: dict = Depends(require_any),
):
    """
    Returns a count preview before export.
    Frontend shows this in the export panel:
    "12 approved variants ready to export"
    """
    supabase = get_supabase()

    query = (
        supabase.table("copy_variants")
        .select("id, format, model", count="exact")
        .eq("brand_id", brand_id)
    )

    if filter == ExportFilter.approved_only:
        query = query.eq("status", "approved")

    response = query.execute()

    # Group by format for preview
    format_counts = {}
    for variant in response.data:
        fmt = variant.get("format", "unknown")
        format_counts[fmt] = format_counts.get(fmt, 0) + 1

    return {
        "total": response.count or 0,
        "by_format": format_counts,
        "filter": filter.value,
    }