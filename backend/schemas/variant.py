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

    class Config:
        from_attributes = True


class ApproveRequest(BaseModel):
    variant_id: str
    brand_id: str


class RejectRequest(BaseModel):
    variant_id: str
    brand_id: str
    reason: RejectionReason
    custom_reason: Optional[str] = None