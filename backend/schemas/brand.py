from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class BrandCreate(BaseModel):
    name: str
    category: str
    color: Optional[str] = "#6366f1"


class BrandUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    color: Optional[str] = None
    is_archived: Optional[bool] = None


class BrandResponse(BaseModel):
    id: str
    name: str
    category: str
    color: str
    is_archived: bool
    created_at: datetime

    class Config:
        from_attributes = True