from supabase import create_client, Client
from loguru import logger
import os
from dotenv import load_dotenv

load_dotenv()

# ── Supabase Client ───────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env")

# ── Standard client — for user-level operations ───────────────────
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Service role client — for admin/server-side operations ────────
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

logger.info("Supabase clients initialized successfully")


def get_supabase() -> Client:
    """Return standard supabase client — use for regular queries"""
    return supabase


def get_supabase_admin() -> Client:
    """Return admin supabase client — use for server-side privileged operations"""
    return supabase_admin