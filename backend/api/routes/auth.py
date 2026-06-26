from fastapi import APIRouter, HTTPException, Depends, status, BackgroundTasks
from fastapi.security import HTTPBearer
from jose import jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from loguru import logger
from api.middleware.rate_limiter import limiter
from fastapi import Request
import os
import hashlib
import secrets
from dotenv import load_dotenv

from db.supabase_client import get_supabase, get_supabase_admin
from schemas.user import (
    UserLogin,
    TokenResponse,
    UserResponse,
    UserCreate,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from api.middleware.auth_guard import get_current_user
from api.middleware.role_guard import require_admin
from utils.email import send_password_reset_email

load_dotenv()

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# ── Password hashing context ──────────────────────────────────────
# bcrypt is the industry standard for password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 480))
RESET_TOKEN_EXPIRE_MINUTES = int(os.getenv("RESET_TOKEN_EXPIRE_MINUTES", 60))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


# ── Helper — hash a reset token for storage ──────────────────────
def _hash_token(raw_token: str) -> str:
    # We store only the SHA-256 of the token, never the raw token itself
    return hashlib.sha256(raw_token.encode()).hexdigest()


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

# ── POST /api/auth/forgot-password ───────────────────────────────
@router.post("/forgot-password")
@limiter.limit("5/hour")
async def forgot_password(
    request: Request,
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
):
    """
    Start the self-service password reset.

    Always returns the same generic message whether or not the email
    exists — this prevents attackers from using it to discover which
    emails have accounts (email enumeration). If the account exists and
    is active, a one-time reset link is emailed in the background.
    """
    generic = {
        "message": "If an account with that email exists, a password reset link has been sent."
    }

    supabase_admin = get_supabase_admin()
    res = (
        supabase_admin.table("users")
        .select("id, email, full_name, is_active")
        .eq("email", payload.email)
        .execute()
    )

    # No account, or deactivated account → return generic (no leak)
    if not res.data or not res.data[0].get("is_active"):
        return generic

    user = res.data[0]

    # Invalidate any prior unused tokens for this user
    supabase_admin.table("password_reset_tokens").update({"used": True}).eq(
        "user_id", user["id"]
    ).eq("used", False).execute()

    # Create a fresh one-time token — raw goes in the link, hash goes in DB
    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw_token)
    expires_at = (
        datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    ).isoformat()

    supabase_admin.table("password_reset_tokens").insert(
        {
            "user_id": user["id"],
            "token_hash": token_hash,
            "expires_at": expires_at,
            "used": False,
        }
    ).execute()

    reset_link = f"{FRONTEND_URL}/reset-password?token={raw_token}"

    # Send the email in the background so the request returns immediately
    background_tasks.add_task(
        send_password_reset_email, user["email"], user.get("full_name", ""), reset_link
    )

    logger.info(f"Password reset requested for: {user['email']}")
    return generic


# ── POST /api/auth/reset-password ────────────────────────────────
@router.post("/reset-password")
@limiter.limit("5/hour")
async def reset_password(request: Request, payload: ResetPasswordRequest):
    """
    Complete the reset: validate the one-time token and set the new password.
    """
    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters",
        )

    token_hash = _hash_token(payload.token)
    supabase_admin = get_supabase_admin()

    res = (
        supabase_admin.table("password_reset_tokens")
        .select("*")
        .eq("token_hash", token_hash)
        .eq("used", False)
        .execute()
    )

    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link. Please request a new one.",
        )

    token_row = res.data[0]

    # Check expiry (handle tz-aware timestamptz from Supabase)
    expires_raw = token_row["expires_at"].replace("Z", "+00:00")
    expires_at = datetime.fromisoformat(expires_raw)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset link has expired. Please request a new one.",
        )

    # Update the password and consume the token
    new_hash = hash_password(payload.new_password)
    supabase_admin.table("users").update({"password_hash": new_hash}).eq(
        "id", token_row["user_id"]
    ).execute()
    supabase_admin.table("password_reset_tokens").update({"used": True}).eq(
        "id", token_row["id"]
    ).execute()

    logger.info(f"Password reset completed for user_id: {token_row['user_id']}")
    return {"message": "Password reset successfully. You can now sign in."}