import asyncio
from loguru import logger

from agents.langgraph.single_graph import run_single_generation


async def run_compare_generation(
    brand_id: str,
    user_prompt: str,
    format: str,
    model_a: str,
    model_b: str,
    session_id: str = None,
) -> dict:
    """
    Runs two single generation pipelines in parallel.
    Same brief, same KB context, two different models.
    Returns both outputs side by side for comparison.
    Uses asyncio.gather for true parallel execution.
    """
    logger.info(
        f"Compare generation starting | "
        f"Brand: {brand_id} | "
        f"Model A: {model_a} | Model B: {model_b}"
    )

    # Run both models simultaneously — not sequentially
    # asyncio.gather fires both at the same time
    result_a, result_b = await asyncio.gather(
        run_single_generation(
            brand_id=brand_id,
            user_prompt=user_prompt,
            format=format,
            model=model_a,
            session_id=session_id,
        ),
        run_single_generation(
            brand_id=brand_id,
            user_prompt=user_prompt,
            format=format,
            model=model_b,
            session_id=session_id,
        ),
        # If one model fails — still return the other
        return_exceptions=True,
    )

    # Handle if one model errored
    if isinstance(result_a, Exception):
        logger.error(f"Model A ({model_a}) failed: {result_a}")
        result_a = {
            "copy": f"Generation failed: {str(result_a)}",
            "score": 0,
            "model": model_a,
            "format": format,
            "brand_id": brand_id,
            "error": str(result_a),
        }

    if isinstance(result_b, Exception):
        logger.error(f"Model B ({model_b}) failed: {result_b}")
        result_b = {
            "copy": f"Generation failed: {str(result_b)}",
            "score": 0,
            "model": model_b,
            "format": format,
            "brand_id": brand_id,
            "error": str(result_b),
        }

    logger.info("Compare generation complete")

    return {
        "model_a": result_a,
        "model_b": result_b,
        "brand_id": brand_id,
        "format": format,
    }