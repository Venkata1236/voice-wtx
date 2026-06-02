from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class NoteTag(str, Enum):
    client_feedback = "client_feedback"
    brand_rule = "brand_rule"
    important = "important"
    follow_up = "follow_up"
    research = "research"


class InsightCreate(BaseModel):
    brand_id: str
    content: str
    color: Optional[str] = "yellow"
    tag: Optional[NoteTag] = None
    is_pinned: Optional[bool] = False


class InsightUpdate(BaseModel):
    content: Optional[str] = None
    color: Optional[str] = None
    tag: Optional[NoteTag] = None
    is_pinned: Optional[bool] = None


class InsightResponse(BaseModel):
    id: str
    brand_id: str
    user_id: str
    content: str
    color: str
    tag: Optional[str] = None
    is_pinned: bool
    created_at: datetime

    class Config:
        from_attributes = True