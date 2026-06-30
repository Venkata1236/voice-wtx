from pydantic import BaseModel
from typing import Optional
from enum import Enum
from datetime import datetime


class DocType(str, Enum):
    brand_document = "brand_document"
    audience_personas = "audience_personas"


class KBDocumentResponse(BaseModel):
    id: str
    brand_id: str
    doc_type: DocType
    file_name: str
    word_count: int
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True



class KBUpdate(BaseModel):
    tone_tags: Optional[list[str]] = None
    brand_rules_do: Optional[list[str]] = None
    brand_rules_dont: Optional[list[str]] = None
    brief_template: Optional[dict] = None


class KBResponse(BaseModel):
    brand_id: str
    tone_tags: list[str]
    brand_rules_do: list[str]
    brand_rules_dont: list[str]
    brief_template: dict
    approved_posts_count: int
    documents: list[KBDocumentResponse]