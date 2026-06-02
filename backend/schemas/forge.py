from pydantic import BaseModel
from typing import Optional
from enum import Enum


class GeneratorAgent(str, Enum):
    vikram = "Vikram"
    priya = "Priya"


class CriticAgent(str, Enum):
    maya = "Maya"
    arjun = "Arjun"


class ForgeStartRequest(BaseModel):
    brand_id: str
    brief: str
    generator: GeneratorAgent
    critic: CriticAgent
    format: str
    kb_context: Optional[dict] = {}
    session_id: Optional[str] = None


class ForgeTurnRequest(BaseModel):
    brand_id: str
    session_id: str
    brief: str
    generator: GeneratorAgent
    critic: CriticAgent
    direction: Optional[str] = None
    kb_context: Optional[dict] = {}


class ForgeResponse(BaseModel):
    session_id: str
    generator: str
    critic: str
    debate_history: list[dict]
    final_copy: Optional[str] = None
    turns: int
    is_approved: bool = False