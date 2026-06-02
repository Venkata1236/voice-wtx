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
    claude_sonnet = "claude-sonnet-4-6"
    claude_haiku = "claude-haiku-4-5"
    gpt4o = "gpt-4o"
    gemini = "gemini-1.5-pro"
    sarvam_30b = "sarvam-30b"
    sarvam_105b = "sarvam-105b"


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
    model: ModelType = ModelType.claude_sonnet
    raw_brief: Optional[str] = None
    session_id: Optional[str] = None