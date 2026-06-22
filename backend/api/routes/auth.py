from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer
from jose import jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from loguru import logger
from api.middleware.rate_limiter import limiter
from fastapi import Request
import os
from dotenv import load_dotenv

from db.supabase_client import get_supabase, get_supabase_admin
from schemas.user import UserLogin, TokenResponse, UserResponse, UserCreate
from api.middleware.auth_guard import get_current_user
from api.middleware.role_guard import require_admin

load_dotenv()

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# ── Password hashing context ──────────────────────────────────────
# bcrypt is the industry standard for password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 480))


# ── Helper — hash password ────────────────────────────────────────
def hash_password(password: str) -> str:
    # Converts plain text password to bcrypt hash — never store plain passwords
    return pwd_context.hash(password)


# ── Helper — verify password ──────────────────────────────────────
def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Compares plain password against stored hash — returns True or False
    return pwd_context.verify(plain_password, hashed_password)


# ── Helper — create JWT token ─────────────────────────────────────
def create_access_token(user_id: str) -> str:
    # Build the token payload
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,      # subject — who this token belongs to
        "exp": expire,       # expiry — when this token stops working
        "iat": datetime.utcnow(),  # issued at — when token was created
    }
    # Sign the token with our secret key
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# ── POST /api/auth/login ──────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, payload: UserLogin):
    """
    Team member login with email and password.
    Returns a JWT token to use in all subsequent requests.
    """
    supabase = get_supabase()

    # Find user by email in database
    response = (
        supabase.table("users")
        .select("*")
        .eq("email", payload.email)
        .single()
        .execute()
    )

    # If no user found with that email
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user = response.data

    # Check if user account is active
    if not user.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Contact your Admin.",
        )

    # Verify the password against stored hash
    if not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Create JWT token with user ID embedded
    access_token = create_access_token(user["id"])

    logger.info(f"User logged in: {user['email']} | Role: {user['role']}")

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(**user),
    )


# ── POST /api/auth/logout ─────────────────────────────────────────
@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """
    Logout current user.
    JWT is stateless — actual invalidation handled on frontend by deleting token.
    """
    logger.info(f"User logged out: {current_user['email']}")
    return {"message": "Logged out successfully"}


# ── GET /api/auth/me ──────────────────────────────────────────────
@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """
    Returns the currently logged in user's profile.
    Frontend uses this on app load to restore session.
    """
    return UserResponse(**current_user)


# ── POST /api/auth/register ───────────────────────────────────────
@router.post("/register", response_model=UserResponse)
async def register_team_member(
    payload: UserCreate,
    # Only admin can add new team members
    current_user: dict = Depends(require_admin),
):
    """
    Admin creates a new team member account.
    Password is auto-generated and should be shared privately.
    """
    supabase_admin = get_supabase_admin()

    # Check if email already exists
    existing = (
        supabase_admin.table("users")
        .select("id")
        .eq("email", payload.email)
        .execute()
    )

    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists",
        )

    # Generate a temporary password
    import secrets
    temp_password = secrets.token_urlsafe(12)
    password_hash = hash_password(temp_password)

    # Insert new user into database
    new_user = (
        supabase_admin.table("users")
        .insert({
            "email": payload.email,
            "full_name": payload.full_name,
            "role": payload.role,
            "password_hash": password_hash,
            "is_active": True,
        })
        .execute()
    )

    user_data = new_user.data[0]

    # Assign brand access if brand_ids provided
    if payload.brand_ids:
        brand_access = [
            {"user_id": user_data["id"], "brand_id": brand_id}
            for brand_id in payload.brand_ids
        ]
        supabase_admin.table("user_brand_access").insert(brand_access).execute()

    logger.info(
        f"New team member created: {payload.email} | Role: {payload.role} | "
        f"Temp password: {temp_password}"
    )

    return UserResponse(**user_data)


# ── POST /api/auth/change-password ───────────────────────────────
@router.post("/change-password")
async def change_password(
    old_password: str,
    new_password: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Logged in user changes their own password.
    """
    # Verify old password first
    if not verify_password(old_password, current_user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Old password is incorrect",
        )

    # Hash new password and update in database
    new_hash = hash_password(new_password)
    supabase = get_supabase()
    supabase.table("users").update(
        {"password_hash": new_hash}
    ).eq("id", current_user["id"]).execute()

    logger.info(f"Password changed for user: {current_user['email']}")
    return {"message": "Password changed successfully"}