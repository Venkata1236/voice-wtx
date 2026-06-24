from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class VariantStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class RejectionReason(str, Enum):
    off_brand_tone = "off_brand_tone"
    wrong_format = "wrong_format"
    too_long = "too_long"
    too_short = "too_short"
    cta_missing = "cta_missing"
    rule_violation = "rule_violation"
    wrong_language_mix = "wrong_language_mix"
    client_preference = "client_preference"


class VariantResponse(BaseModel):
    id: str
    session_id: str
    brand_id: str
    model: str
    format: str
    brief: str
    content: str
    score: int
    status: VariantStatus
    rejection_reason: Optional[str] = None
    agent_generator: Optional[str] = None
    agent_critic: Optional[str] = None
    created_at: datetime
    keywords: Optional[list] = []
    # ── Image attachment ──────────────────────────────────────────────
    image_url: Optional[str] = None
    image_urls: Optional[list] = None

    # ── Turn tracking — groups variants into conversation turns ────────
    turn_id: Optional[str] = None
    turn_type: Optional[str] = None  # 'single' | 'compare'

    @classmethod
    def from_db(cls, data: dict):
        import json
        if isinstance(data.get('keywords'), str):
            try:
                data['keywords'] = json.loads(data['keywords'])
            except Exception:
                data['keywords'] = []
        # turn_id comes from DB as uuid — cast to str for the response
        if data.get('turn_id') is not None:
            data['turn_id'] = str(data['turn_id'])
        return cls(**data)

    class Config:
        from_attributes = True


# ── A single conversation turn (one "send") ────────────────────────
class ChatTurn(BaseModel):
    turn_id: str
    turn_type: str           # 'single' | 'compare'
    brief: str
    created_at: datetime
    image_url: Optional[str] = None   # Supabase Storage URL of the attached image
    variants: list[VariantResponse]


# ── Full chat thread — ordered list of turns ───────────────────────
class ChatThread(BaseModel):
    session_id: str
    turns: list[ChatTurn]


class ApproveRequest(BaseModel):
    variant_id: str
    brand_id: str


class RejectRequest(BaseModel):
    variant_id: str
    brand_id: str
    reason: RejectionReason
    custom_reason: Optional[str] = None