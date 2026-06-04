from typing import TypedDict, Optional, List


class GraphState(TypedDict):
    """
    Shared state that flows through every node in the LangGraph.
    Each node reads from this state and writes back to it.
    Think of it as a baton passed between nodes.
    """

    # ── Input ─────────────────────────────────────────────────────
    # Brand ID for this generation
    brand_id: str

    # Assembled brief from user input
    user_prompt: str

    # Copy format — caption, reel_hook, carousel, story, linkedin
    format: str

    # Model to use — claude-sonnet-4-6, gpt-4o, etc.
    model: str

    # Session ID for persistence
    session_id: Optional[str]

    # ── KB Node output ────────────────────────────────────────────
    # Full KB context dict built by kb_builder
    kb_context: Optional[dict]

    # Formatted system prompt string built from KB context
    system_prompt: Optional[str]

    # ── Generate Node output ──────────────────────────────────────
    # Raw generated copy from AI model
    generated_copy: Optional[str]

    # ── Score Node output ─────────────────────────────────────────
    # Brand compliance score 0-100
    score: Optional[int]

    # ── Format Node output ────────────────────────────────────────
    # Final cleaned copy ready for API response
    final_copy: Optional[str]

    # ── Error handling ────────────────────────────────────────────
    # Error message if any node fails
    error: Optional[str]