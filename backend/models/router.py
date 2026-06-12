from loguru import logger
from models.providers.anthropic import generate_with_claude
from models.providers.openai import generate_with_openai
from models.providers.gemini import generate_with_gemini
from models.providers.sarvam import generate_with_sarvam
from models.providers.ollama import generate_with_ollama


# ── Model to provider mapping ─────────────────────────────────────
MODEL_PROVIDER_MAP = {
    # Anthropic — cheaper Haiku model
    "claude-haiku-4-5":   generate_with_claude,

    # OpenAI — cheaper mini model
    "gpt-4o-mini":        generate_with_openai,

    # Google — cheaper flash model
    "gemini-1.5-flash":   generate_with_gemini,

    # Sarvam — lighter model
    "sarvam-30b":         generate_with_sarvam,

    # Ollama — Forge mode only — already free
    "mistral":            generate_with_ollama,
    "gemma":              generate_with_ollama,
}


async def route_to_model(
    model: str,
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 1000,
    temperature: float = 0.7,
) -> str:
    """
    Routes generation request to correct provider
    based on model name.
    Single entry point for all model calls.
    """
    provider_fn = MODEL_PROVIDER_MAP.get(model)

    if not provider_fn:
        logger.error(f"Unknown model: {model}")
        raise ValueError(
            f"Model '{model}' is not supported. "
            f"Available models: {list(MODEL_PROVIDER_MAP.keys())}"
        )

    logger.info(f"Routing to model: {model}")

    return await provider_fn(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
    )