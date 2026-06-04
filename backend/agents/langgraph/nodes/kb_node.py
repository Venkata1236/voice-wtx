from loguru import logger
from kb.kb_builder import build_kb_context, format_kb_for_prompt
from agents.langgraph.state import GraphState


async def kb_node(state: GraphState) -> GraphState:
    """
    Node 1 — Knowledge Base Node.
    Fetches and assembles full KB context for the brand.
    Converts KB context into a formatted system prompt string.
    Runs before every generation — no exceptions.
    """
    logger.info(f"KB node running for brand: {state['brand_id']}")

    try:
        # Fetch full KB context from Supabase
        # Includes tone tags, rules, approved posts, documents
        kb_context = await build_kb_context(state["brand_id"])

        # Convert KB dict into formatted system prompt string
        # This is what the AI actually reads
        system_prompt = format_kb_for_prompt(kb_context)

        logger.info(
            f"KB node complete | "
            f"System prompt length: {len(system_prompt)} chars"
        )

        # Write KB context and system prompt into shared state
        return {
            **state,
            "kb_context": kb_context,
            "system_prompt": system_prompt,
            "error": None,
        }

    except Exception as e:
        logger.error(f"KB node failed: {e}")
        return {
            **state,
            "kb_context": {},
            "system_prompt": "",
            "error": str(e),
        }