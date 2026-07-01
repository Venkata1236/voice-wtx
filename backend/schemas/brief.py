from pydantic import BaseModel
from typing import Optional
from enum import Enum


class FormatType(str, Enum):
    reel_hook = "reel_hook"
    caption = "caption"
    carousel = "carousel"
    story = "story"
    linkedin = "linkedin"


class ModelType(str, Enum):
    # Priority models — shown first in UI
    claude_haiku = "claude-haiku-4-5"
    sarvam = "sarvam-30b"

    # Alternative models — available if user switches
    gpt4o_mini = "gpt-4o-mini"
    gemini_flash = "gemini-1.5-flash"

    # Ollama — Forge mode only
    mistral = "mistral"
    gemma = "gemma"


# ── Priority order for UI dropdowns ────────────────────────────────
# Frontend uses this order — Claude and Sarvam shown first
MODEL_PRIORITY_ORDER = [
    ModelType.claude_haiku,
    ModelType.sarvam,
    ModelType.gpt4o_mini,
    ModelType.gemini_flash,
]



class BriefPayload(BaseModel):
    brand_id: str
    platform: Optional[str] = None
    objective: Optional[str] = None
    hero_product: Optional[str] = None
    cta: Optional[str] = None
    tone_override: Optional[str] = None
    length: Optional[str] = None
    notes: Optional[str] = None
    format: FormatType
    # Default to Claude Haiku — priority model
    model: ModelType = ModelType.claude_haiku
    raw_brief: Optional[str] = None
    session_id: Optional[str] = None
    # ── Refinement ─────────────────────────────────────────────────
    # When set, the model rewrites this existing copy per the instruction
    # in raw_brief, instead of generating fresh. Uses the same model.
    refine_from: Optional[str] = None

    # ── "More like this" ───────────────────────────────────────────
    # When set, the model generates a FRESH variation in the same style
    # and spirit as this reference copy (not a rewrite of it).
    more_like: Optional[str] = None

    # ── Image attachment ───────────────────────────────────────────
    # Public Supabase Storage URL(s) of attached image(s) (optional).
    # If provided, the vision model extracts context from them first.
    image_url: Optional[str] = None          # single (back-compat)
    image_urls: Optional[list[str]] = None   # up to 5 images

    # ── Turn tracking ──────────────────────────────────────────────
    # Frontend generates one turn_id per send so all variants in that
    # send (single = 3, compare = 2) are grouped into one chat turn.
    # If omitted, the backend generates one.
    turn_id: Optional[str] = None