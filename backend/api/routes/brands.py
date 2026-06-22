from fastapi import APIRouter, HTTPException, Depends, status
from loguru import logger
from api.middleware.rate_limiter import limiter
from fastapi import Request

from db.supabase_client import get_supabase, get_supabase_admin
from schemas.brand import BrandCreate, BrandUpdate, BrandResponse
from api.middleware.auth_guard import get_current_user
from api.middleware.role_guard import require_admin, require_any

router = APIRouter(prefix="/api/brands", tags=["Brands"])


# ── GET /api/brands ───────────────────────────────────────────────
@router.get("/", response_model=list[BrandResponse])
async def get_brands(current_user: dict = Depends(require_any)):
    """
    Returns all brands assigned to the currently logged in user.
    Admin sees all brands. Others see only their assigned brands.
    """
    supabase = get_supabase()
    user_id = current_user["id"]
    user_role = current_user["role"]

    # Admin sees all active brands
    if user_role == "admin":
        response = (
            supabase.table("brands")
            .select("*")
            .eq("is_archived", False)
            .order("name")
            .execute()
        )
        return [BrandResponse(**brand) for brand in response.data]

    # Other roles see only their assigned brands
    # First get brand IDs assigned to this user
    access_response = (
        supabase.table("user_brand_access")
        .select("brand_id")
        .eq("user_id", user_id)
        .execute()
    )

    # Extract brand IDs from access response
    brand_ids = [row["brand_id"] for row in access_response.data]

    if not brand_ids:
        return []

    # Fetch the actual brand details for those IDs
    brands_response = (
        supabase.table("brands")
        .select("*")
        .in_("id", brand_ids)
        .eq("is_archived", False)
        .order("name")
        .execute()
    )

    return [BrandResponse(**brand) for brand in brands_response.data]


# ── GET /api/brands/{brand_id} ────────────────────────────────────
@router.get("/{brand_id}", response_model=BrandResponse)
async def get_brand(
    brand_id: str,
    current_user: dict = Depends(require_any),
):
    """
    Returns a single brand by ID.
    Checks that the user has access to this brand.
    """
    supabase = get_supabase()
    user_id = current_user["id"]
    user_role = current_user["role"]

    # Fetch the brand
    response = (
        supabase.table("brands")
        .select("*")
        .eq("id", brand_id)
        .single()
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand not found",
        )

    # Non-admin users — verify they have access to this brand
    if user_role != "admin":
        access = (
            supabase.table("user_brand_access")
            .select("id")
            .eq("user_id", user_id)
            .eq("brand_id", brand_id)
            .execute()
        )
        if not access.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this brand",
            )

    return BrandResponse(**response.data)


# ── POST /api/brands ──────────────────────────────────────────────
@router.post("/", response_model=BrandResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def create_brand(request: Request,
    payload: BrandCreate,
    # Only admin can create brands
    current_user: dict = Depends(require_admin),
):
    """
    Admin creates a new brand.
    Also creates an empty KB record for the brand automatically.
    """
    supabase_admin = get_supabase_admin()

    # Check if brand name already exists
    existing = (
        supabase_admin.table("brands")
        .select("id")
        .eq("name", payload.name)
        .execute()
    )

    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A brand with this name already exists",
        )

    # Insert new brand
    new_brand = (
        supabase_admin.table("brands")
        .insert({
            "name": payload.name,
            "category": payload.category,
            "color": payload.color,
        })
        .execute()
    )

    brand_data = new_brand.data[0]

    # Automatically create an empty KB record for this brand
    supabase_admin.table("brand_kb").insert({
        "brand_id": brand_data["id"],
        "tone_tags": [],
        "brand_rules_do": [],
        "brand_rules_dont": [],
        "brief_template": {},
    }).execute()

    logger.info(f"Brand created: {brand_data['name']} by {current_user['email']}")

    return BrandResponse(**brand_data)


# ── PATCH /api/brands/{brand_id} ──────────────────────────────────
@router.patch("/{brand_id}", response_model=BrandResponse)
async def update_brand(
    brand_id: str,
    payload: BrandUpdate,
    # Only admin can update brands
    current_user: dict = Depends(require_admin),
):
    """
    Admin updates brand details — name, category, color, or archive status.
    """
    supabase_admin = get_supabase_admin()

    # Build update dict — only include fields that were actually sent
    update_data = payload.model_dump(exclude_none=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update",
        )

    # Update brand in database
    response = (
        supabase_admin.table("brands")
        .update(update_data)
        .eq("id", brand_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand not found",
        )

    logger.info(f"Brand updated: {brand_id} by {current_user['email']}")

    return BrandResponse(**response.data[0])


# ── DELETE /api/brands/{brand_id} ────────────────────────────────
@router.delete("/{brand_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_brand(
    brand_id: str,
    # Only admin can delete brands
    current_user: dict = Depends(require_admin),
):
    """
    Permanently deletes a brand and all its data.
    Use archive instead for soft delete.
    """
    supabase_admin = get_supabase_admin()

    # Check brand exists first
    existing = (
        supabase_admin.table("brands")
        .select("id")
        .eq("id", brand_id)
        .execute()
    )

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand not found",
        )

    # Delete brand — cascades to KB, documents, sessions, variants
    supabase_admin.table("brands").delete().eq("id", brand_id).execute()

    logger.info(f"Brand deleted: {brand_id} by {current_user['email']}")


# ── PATCH /api/brands/{brand_id}/archive ─────────────────────────
@router.patch("/{brand_id}/archive", response_model=BrandResponse)
async def archive_brand(
    brand_id: str,
    # Only admin can archive brands
    current_user: dict = Depends(require_admin),
):
    """
    Soft deletes a brand by setting is_archived to True.
    Brand data is preserved — can be unarchived later.
    """
    supabase_admin = get_supabase_admin()

    response = (
        supabase_admin.table("brands")
        .update({"is_archived": True})
        .eq("id", brand_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand not found",
        )

    logger.info(f"Brand archived: {brand_id} by {current_user['email']}")

    return BrandResponse(**response.data[0])


# ── PATCH /api/brands/{brand_id}/unarchive ────────────────────────
@router.patch("/{brand_id}/unarchive", response_model=BrandResponse)
async def unarchive_brand(
    brand_id: str,
    current_user: dict = Depends(require_admin),
):
    """
    Restores an archived brand.
    """
    supabase_admin = get_supabase_admin()

    response = (
        supabase_admin.table("brands")
        .update({"is_archived": False})
        .eq("id", brand_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand not found",
        )

    logger.info(f"Brand unarchived: {brand_id} by {current_user['email']}")

    return BrandResponse(**response.data[0])