from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, status
from loguru import logger
from api.middleware.rate_limiter import limiter
from fastapi import Request
from db.supabase_client import get_supabase_admin
from api.middleware.role_guard import require_any
import uuid
import os

router = APIRouter(prefix="/api/image", tags=["Image Upload"])

BUCKET = "voice-images"
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE_MB = 5
MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024


@router.post("/upload")
@limiter.limit("10/minute")
async def upload_image(request: Request,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_any),
):
    """
    Accepts a JPEG / PNG / WebP image, uploads it to Supabase Storage
    bucket 'voice-images', and returns the permanent public URL.

    The URL is stored on the copy_variant row (image_url column) so
    the image can be shown when the chat is reopened.
    """
    # ── Validate MIME type ────────────────────────────────────────
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{file.content_type}'. "
                   f"Allowed: JPEG, PNG, WebP, GIF.",
        )

    # ── Read and validate size ────────────────────────────────────
    data = await file.read()
    if len(data) > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large ({len(data) // 1024} KB). Max {MAX_SIZE_MB} MB.",
        )

    # ── Build a unique path: user_id/uuid.ext ─────────────────────
    ext = file.content_type.split("/")[-1].replace("jpeg", "jpg")
    filename = f"{current_user['id']}/{uuid.uuid4()}.{ext}"

    # ── Upload to Supabase Storage ────────────────────────────────
    supabase_admin = get_supabase_admin()
    try:
        supabase_admin.storage.from_(BUCKET).upload(
            path=filename,
            file=data,
            file_options={"content-type": file.content_type},
        )
    except Exception as e:
        logger.error(f"Supabase Storage upload failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Image upload failed. Please try again.",
        )

    # ── Build public URL ──────────────────────────────────────────
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    public_url = f"{supabase_url}/storage/v1/object/public/{BUCKET}/{filename}"

    logger.info(
        f"Image uploaded | User: {current_user['email']} | "
        f"File: {filename} | Size: {len(data) // 1024} KB"
    )

    return {"url": public_url, "filename": filename}