from loguru import logger
from agents.langgraph.state import GraphState


async def format_node(state: GraphState) -> GraphState:
    """
    Node 4 — Format Node.
    Cleans and formats the generated copy for API response.
    Removes any AI meta-commentary or preamble.
    Ensures copy is ready for direct use.
    Skips if generation failed.
    """
    if state.get("error") or not state.get("generated_copy"):
        logger.warning("Format node skipped — no copy to format")
        return {**state, "final_copy": None}

    logger.info("Format node running")

    try:
        raw_copy = state["generated_copy"]

        # Clean the copy — remove AI preamble and commentary
        final_copy = clean_copy(raw_copy)

        logger.info(
            f"Format node complete | "
            f"Final copy length: {len(final_copy)} chars"
        )

        return {
            **state,
            "final_copy": final_copy,
            "error": None,
        }

    except Exception as e:
        logger.error(f"Format node failed: {e}")
        return {
            **state,
            "final_copy": state.get("generated_copy", ""),
            "error": str(e),
        }


def clean_copy(text: str) -> str:
    """
    Removes common AI preamble phrases from generated copy.
    AI sometimes adds "Here is your copy:" before the actual content.
    We strip these so only clean copy reaches the frontend.
    """
    # Common preamble phrases to strip
    preambles = [
        "here is your copy:",
        "here's your copy:",
        "here is the copy:",
        "here's the copy:",
        "here is a caption:",
        "here's a caption:",
        "here is your caption:",
        "here's your caption:",
        "here is your reel hook:",
        "here's your reel hook:",
        "sure! here",
        "sure, here",
        "of course! here",
        "certainly! here",
    ]

    cleaned = text.strip()
    cleaned_lower = cleaned.lower()

    for preamble in preambles:
        if cleaned_lower.startswith(preamble):
            # Remove preamble and any leading whitespace/newlines
            cleaned = cleaned[len(preamble):].strip()
            break

    return cleaned