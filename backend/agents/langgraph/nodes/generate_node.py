from loguru import logger
from models.router import route_to_model
from agents.langgraph.state import GraphState


async def generate_node(state: GraphState) -> GraphState:
    """
    Node 2 — Generation Node.
    Calls the selected AI model with system prompt + user prompt.
    Returns raw generated copy.
    Skips if KB node raised an error.
    """
    # Skip generation if previous node failed
    if state.get("error"):
        logger.warning("Generate node skipped — error in previous node")
        return state

    logger.info(
        f"Generate node running | "
        f"Model: {state['model']} | "
        f"Format: {state['format']}"
    )

    try:
        # Call the model router with system + user prompts
        # Router picks the right provider automatically
        generated_copy = await route_to_model(
            model=state["model"],
            system_prompt=state["system_prompt"],
            user_prompt=state["user_prompt"],
            temperature=state.get("temperature", 0.7),   
        )

        logger.info(
            f"Generate node complete | "
            f"Copy length: {len(generated_copy)} chars"
        )

        return {
            **state,
            "generated_copy": generated_copy,
            "error": None,
        }

    except Exception as e:
        logger.error(f"Generate node failed: {e}")
        return {
            **state,
            "generated_copy": None,
            "error": str(e),
        }