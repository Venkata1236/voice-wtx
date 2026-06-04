from anthropic import AsyncAnthropic
from loguru import logger
import os
from dotenv import load_dotenv

load_dotenv()

# ── Client — initialized once at module load ──────────────────────
client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


async def generate_with_claude(
    system_prompt: str,
    user_prompt: str,
    model: str = "claude-sonnet-4-6",
    max_tokens: int = 1000,
    temperature: float = 0.7,
) -> str:
    """
    Calls Claude via Anthropic API.
    Used in Single and Compare mode.
    Returns generated copy as plain string.
    """
    try:
        response = await client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            messages=[
                {"role": "user", "content": user_prompt}
            ],
        )

        # Extract text from response content block
        content = response.content[0].text

        logger.info(
            f"Claude generation complete | "
            f"Model: {model} | "
            f"Input tokens: {response.usage.input_tokens} | "
            f"Output tokens: {response.usage.output_tokens}"
        )

        return content

    except Exception as e:
        logger.error(f"Anthropic API error: {e}")
        raise