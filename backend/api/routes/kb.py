from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, status
from loguru import logger
import tempfile
import os
from datetime import datetime, timezone

from db.supabase_client import get_supabase, get_supabase_admin
from schemas.kb import KBResponse, KBUpdate, KBDocumentResponse, DocType
from api.middleware.auth_guard import get_current_user
from api.middleware.role_guard import require_admin_or_copy_lead, require_any
from kb.parser import extract_text_from_file
from kb.kb_builder import build_kb_context

router = APIRouter(prefix="/api/kb", tags=["Knowledge Base"])


# ── GET /api/kb/{brand_id} ────────────────────────────────────────
@router.get("/{brand_id}", response_model=KBResponse)
async def get_kb(
    brand_id: str,
    current_user: dict = Depends(require_any),
):
    """
    Returns the full Knowledge Base for a brand.
    Used by the frontend to populate the KB panel.
    Also used internally before every generation.
    """
    supabase = get_supabase()

    # Fetch KB settings for this brand
    kb_response = (
        supabase.table("brand_kb")
        .select("*")
        .eq("brand_id", brand_id)
        .single()
        .execute()
    )

    if not kb_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge Base not found for this brand",
        )

    kb = kb_response.data

    # Fetch approved documents for this brand
    docs_response = (
        supabase.table("kb_documents")
        .select("*")
        .eq("brand_id", brand_id)
        .order("created_at", desc=True)
        .execute()
    )

    # Count approved posts for this brand
    posts_response = (
        supabase.table("approved_posts")
        .select("id", count="exact")
        .eq("brand_id", brand_id)
        .execute()
    )

    approved_posts_count = posts_response.count or 0

    return KBResponse(
        brand_id=brand_id,
        tone_tags=kb.get("tone_tags", []),
        brand_rules_do=kb.get("brand_rules_do", []),
        brand_rules_dont=kb.get("brand_rules_dont", []),
        brief_template=kb.get("brief_template", {}),
        approved_posts_count=approved_posts_count,
        documents=[KBDocumentResponse(**doc) for doc in docs_response.data],
    )


# ── PATCH /api/kb/{brand_id} ──────────────────────────────────────
@router.patch("/{brand_id}")
async def update_kb(
    brand_id: str,
    payload: KBUpdate,
    # Only admin or copy lead can update KB settings
    current_user: dict = Depends(require_admin_or_copy_lead),
):
    """
    Updates KB settings — tone tags, brand rules, brief template.
    Strategist updates brief template monthly.
    Copy Lead updates brand rules.
    """
    supabase = get_supabase()

    # Build update dict — only include fields that were actually sent
    update_data = payload.model_dump(exclude_none=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update",
        )

    response = (
        supabase.table("brand_kb")
        .update(update_data)
        .eq("brand_id", brand_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge Base not found for this brand",
        )

    logger.info(f"KB updated for brand: {brand_id} by {current_user['email']}")

    return {"message": "Knowledge Base updated successfully"}


# ── POST /api/kb/{brand_id}/upload ───────────────────────────────
@router.post("/{brand_id}/upload", response_model=KBDocumentResponse)
async def upload_document(
    brand_id: str,
    doc_type: DocType,
    # File upload — accepts PDF or DOCX
    file: UploadFile = File(...),
    current_user: dict = Depends(require_any),
):
    """
    Uploads a brand document (PDF or DOCX) to the KB.
    Document is parsed immediately — extracted text stored in DB.
    Status is set to pending — Copy Lead must approve before AI reads it.
    """
    supabase_admin = get_supabase_admin()

    # Validate file type
    allowed_types = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF and DOCX files are supported",
        )

    # Save uploaded file temporarily to disk for parsing
    with tempfile.NamedTemporaryFile(
        delete=False,
        suffix=os.path.splitext(file.filename)[1]
    ) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # Extract text from the uploaded file
        extracted_text = extract_text_from_file(tmp_path, file.content_type)
        word_count = len(extracted_text.split()) if extracted_text else 0

        # Check if a document of this type already exists for this brand
        # If so replace it — only one brand document and one personas doc allowed
        existing = (
            supabase_admin.table("kb_documents")
            .select("id")
            .eq("brand_id", brand_id)
            .eq("doc_type", doc_type)
            .execute()
        )

        if existing.data:
            # Update existing document
            response = (
                supabase_admin.table("kb_documents")
                .update({
                    "file_name": file.filename,
                    "extracted_text": extracted_text,
                    "word_count": word_count,
                    # Reset to pending — needs re-approval after update
                    "status": "pending",
                    "uploaded_by": current_user["id"],
                    "approved_by": None,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })
                .eq("id", existing.data[0]["id"])
                .execute()
            )
        else:
            # Insert new document
            response = (
                supabase_admin.table("kb_documents")
                .insert({
                    "brand_id": brand_id,
                    "doc_type": doc_type,
                    "file_name": file.filename,
                    "extracted_text": extracted_text,
                    "word_count": word_count,
                    "status": "pending",
                    "uploaded_by": current_user["id"],
                })
                .execute()
            )

        logger.info(
            f"Document uploaded: {file.filename} | Brand: {brand_id} | "
            f"Words: {word_count} | By: {current_user['email']}"
        )

        return KBDocumentResponse(**response.data[0])

    finally:
        # Always clean up the temp file
        os.unlink(tmp_path)


# ── POST /api/kb/{brand_id}/approve/{doc_id} ─────────────────────
@router.post("/{brand_id}/approve/{doc_id}")
async def approve_document(
    brand_id: str,
    doc_id: str,
    # Only admin or copy lead can approve documents
    current_user: dict = Depends(require_admin_or_copy_lead),
):
    """
    Copy Lead or Admin approves a pending KB document.
    Only approved documents are read by the AI during generation.
    """
    supabase_admin = get_supabase_admin()

    response = (
        supabase_admin.table("kb_documents")
        .update({
            "status": "approved",
            "approved_by": current_user["id"],
        })
        .eq("id", doc_id)
        .eq("brand_id", brand_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    logger.info(
        f"Document approved: {doc_id} | Brand: {brand_id} | "
        f"By: {current_user['email']}"
    )

    return {"message": "Document approved — AI will now use this document"}


# ── POST /api/kb/{brand_id}/reject/{doc_id} ──────────────────────
@router.post("/{brand_id}/reject/{doc_id}")
async def reject_document(
    brand_id: str,
    doc_id: str,
    current_user: dict = Depends(require_admin_or_copy_lead),
):
    """
    Copy Lead or Admin rejects a pending KB document.
    """
    supabase_admin = get_supabase_admin()

    response = (
        supabase_admin.table("kb_documents")
        .update({"status": "rejected"})
        .eq("id", doc_id)
        .eq("brand_id", brand_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    logger.info(f"Document rejected: {doc_id} by {current_user['email']}")

    return {"message": "Document rejected"}


# ── GET /api/kb/approval-queue ────────────────────────────────────
@router.get("/approval-queue/all")
async def get_approval_queue(
    current_user: dict = Depends(require_admin_or_copy_lead),
):
    """
    Returns all pending documents across all brands.
    Used in Settings > KB Approval Queue.
    """
    supabase = get_supabase()

    response = (
        supabase.table("kb_documents")
        .select("*, brands(name)")
        .eq("status", "pending")
        .order("created_at", desc=True)
        .execute()
    )

    return response.data

# ── Feature Flags ───────────────────────────────────────────────────
from schemas.feature_flags import FeatureFlagUpdate, FeatureFlagResponse
from api.middleware.role_guard import require_admin


feature_flags_router = APIRouter(prefix="/api/settings", tags=["Feature Flags"])


# ── GET /api/settings/feature-flags ───────────────────────────────────
@feature_flags_router.get("/feature-flags", response_model=list[FeatureFlagResponse])
async def get_feature_flags(
    current_user: dict = Depends(require_any),
):
    """
    Returns all feature flags.
    Used by frontend to check if Forge mode tab should be visible.
    """
    supabase = get_supabase()

    response = supabase.table("feature_flags").select("*").execute()

    return [FeatureFlagResponse(**flag) for flag in response.data]


# ── PATCH /api/settings/feature-flags/{flag_name} ─────────────────────
@feature_flags_router.patch("/feature-flags/{flag_name}", response_model=FeatureFlagResponse)
async def update_feature_flag(
    flag_name: str,
    payload: FeatureFlagUpdate,
    # Only admin can toggle feature flags
    current_user: dict = Depends(require_admin),
):
    """
    Admin toggles a feature flag — e.g. forge_mode.
    Forge tab appears/disappears immediately for all users.
    """
    supabase_admin = get_supabase_admin()

    response = (
        supabase_admin.table("feature_flags")
        .update({"is_enabled": payload.is_enabled})
        .eq("flag_name", flag_name)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feature flag not found",
        )

    logger.info(
        f"Feature flag updated: {flag_name} = {payload.is_enabled} | "
        f"By: {current_user['email']}"
    )

    return FeatureFlagResponse(**response.data[0])