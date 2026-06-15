from loguru import logger

from agents.langgraph.single_graph import run_single_generation
from agents.langgraph.compare_graph import run_compare_generation
from agents.autogen.debate_loop import run_forge_debate


async def run_single(
    brand_id: str,
    user_prompt: str,
    format: str,
    model: str,
    session_id: str = None,
) -> dict:
    """
    Entry point for Single generation mode.
    Routes to LangGraph single graph.
    Returns one variant — copy, score, model, format.
    """
    logger.info(f"Orchestrator → Single mode | Brand: {brand_id}")

    return await run_single_generation(
        brand_id=brand_id,
        user_prompt=user_prompt,
        format=format,
        model=model,
        session_id=session_id,
    )


async def run_single_three_variants(
    brand_id: str,
    user_prompt: str,
    format: str,
    model: str,
    session_id: str = None,
) -> list[dict]:
    """
    Runs Single generation 3 times to produce 3 variants.
    VOICE spec — every brief returns 3 copy variants to choose from.
    Each variant runs independently through the full LangGraph pipeline.
    """
    import asyncio

    logger.info(
        f"Orchestrator → Single mode (3 variants) | "
        f"Brand: {brand_id} | Model: {model}"
    )

    # Run 3 generations in parallel — same brief, same model,
    # but temperature variation in the model produces different outputs
    results = await asyncio.gather(
        run_single_generation(brand_id, user_prompt, format, model, session_id, temperature=0.6),
        run_single_generation(brand_id, user_prompt, format, model, session_id, temperature=0.8),
        run_single_generation(brand_id, user_prompt, format, model, session_id, temperature=1.0),
        return_exceptions=True,
    )

    variants = []
    for i, result in enumerate(results, 1):
        if isinstance(result, Exception):
            logger.error(f"Variant {i} failed: {result}")
            variants.append({
                "copy": f"Generation failed: {str(result)}",
                "score": 0,
                "model": model,
                "format": format,
                "brand_id": brand_id,
                "error": str(result),
            })
        else:
            variants.append(result)

    return variants


async def run_compare(
    brand_id: str,
    user_prompt: str,
    format: str,
    model_a: str,
    model_b: str,
    session_id: str = None,
) -> dict:
    """
    Entry point for Compare mode.
    Routes to LangGraph compare graph.
    Runs two models in parallel, returns both results.
    """
    logger.info(
        f"Orchestrator → Compare mode | "
        f"Brand: {brand_id} | {model_a} vs {model_b}"
    )

    return await run_compare_generation(
        brand_id=brand_id,
        user_prompt=user_prompt,
        format=format,
        model_a=model_a,
        model_b=model_b,
        session_id=session_id,
    )


async def run_forge(
    brand_id: str,
    brief: str,
    generator: str,
    critic: str,
    user_direction: str = None,
    max_turns: int = 6,
) -> dict:
    """
    Entry point for Forge mode.
    Routes to AutoGen debate loop.
    Generator and Critic agents debate until approved or max turns reached.
    """
    logger.info(
        f"Orchestrator → Forge mode | "
        f"Brand: {brand_id} | {generator} vs {critic}"
    )

    return await run_forge_debate(
        brand_id=brand_id,
        brief=brief,
        generator_name=generator,
        critic_name=critic,
        user_direction=user_direction,
        max_turns=max_turns,
    )