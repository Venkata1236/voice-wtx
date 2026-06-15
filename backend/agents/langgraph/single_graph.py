from langgraph.graph import StateGraph, END
from loguru import logger

from agents.langgraph.state import GraphState
from agents.langgraph.nodes.kb_node import kb_node
from agents.langgraph.nodes.generate_node import generate_node
from agents.langgraph.nodes.score_node import score_node
from agents.langgraph.nodes.format_node import format_node


def build_single_graph():
    """
    Builds the LangGraph for Single generation mode.
    Flow: KB → Generate → Score → Format → END
    Returns a compiled graph ready to invoke.
    """
    # Initialize graph with shared state schema
    graph = StateGraph(GraphState)

    # ── Add nodes ─────────────────────────────────────────────────
    graph.add_node("kb_node", kb_node)
    graph.add_node("generate_node", generate_node)
    graph.add_node("score_node", score_node)
    graph.add_node("format_node", format_node)

    # ── Define edges — order of execution ─────────────────────────
    # Start → KB node first — always fetch context before generating
    graph.set_entry_point("kb_node")

    # KB node → Generate node
    graph.add_edge("kb_node", "generate_node")

    # Generate node → Score node
    graph.add_edge("generate_node", "score_node")

    # Score node → Format node
    graph.add_edge("score_node", "format_node")

    # Format node → END
    graph.add_edge("format_node", END)

    # Compile the graph — validates structure
    compiled = graph.compile()

    logger.info("Single generation graph compiled")

    return compiled


async def run_single_generation(
    brand_id: str,
    user_prompt: str,
    format: str,
    model: str,
    session_id: str = None,
    temperature: float = 0.7,
) -> dict:
    """
    Runs the full single generation pipeline.
    Returns final copy, score, and metadata.
    """
    graph = build_single_graph()

    # Initial state — all outputs start as None
    initial_state: GraphState = {
        "brand_id": brand_id,
        "user_prompt": user_prompt,
        "format": format,
        "model": model,
        "session_id": session_id,
        "temperature": temperature,   # ← add this
        "kb_context": None,
        "system_prompt": None,
        "generated_copy": None,
        "score": None,
        "final_copy": None,
        "error": None,
    }

    logger.info(
        f"Single generation starting | "
        f"Brand: {brand_id} | Model: {model} | Format: {format}"
    )

    # Run graph — executes all nodes in sequence
    final_state = await graph.ainvoke(initial_state)

    if final_state.get("error"):
        logger.error(f"Single generation failed: {final_state['error']}")
        raise Exception(final_state["error"])

    return {
        "copy": final_state["final_copy"],
        "score": final_state["score"],
        "model": model,
        "format": format,
        "brand_id": brand_id,
        "keywords": final_state.get("keywords", []),
    }