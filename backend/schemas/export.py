from pydantic import BaseModel
from typing import Optional
from enum import Enum


class ExportFormat(str, Enum):
    plain_text = "plain_text"
    csv = "csv"
    kb_archive = "kb_archive"


class ExportFilter(str, Enum):
    approved_only = "approved_only"
    all_variants = "all_variants"


class ExportRequest(BaseModel):
    brand_id: str
    session_id: Optional[str] = None
    format: ExportFormat
    filter: ExportFilter = ExportFilter.approved_only