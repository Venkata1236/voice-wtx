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
    # Anthropic — default
    claude_haiku = "claude-haiku-4-5"

    # OpenAI
    gpt4o_mini = "gpt-4o-mini"

    # Google
    gemini_flash = "gemini-1.5-flash"

    # Sarvam — Indian languages
    sarvam = "sarvam-m"

    # Ollama — Forge only
    mistral = "mistral"
    gemma = "gemma"


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
    # Default to cheapest Anthropic model
    model: ModelType = ModelType.claude_haiku
    raw_brief: Optional[str] = None
    session_id: Optional[str] = None