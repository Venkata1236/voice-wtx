from fastapi import Depends, HTTPException, status
from api.middleware.auth_guard import get_current_user


def require_role(*allowed_roles: str):
    """
    Role guard factory — use as a dependency on any route.
    Example: Depends(require_role("admin", "copy_lead"))
    """
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {list(allowed_roles)}",
            )
        return current_user
    return role_checker


# ── Pre-built role guards ──────────────────────────────────────────
require_admin = require_role("admin")

require_admin_or_copy_lead = require_role("admin", "copy_lead")

require_admin_or_strategist = require_role("admin", "strategist")

require_any = require_role(
    "admin", "copy_lead", "strategist", "copywriter", "brand_manager"
)