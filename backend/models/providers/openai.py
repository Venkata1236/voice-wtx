from openai import AsyncOpenAI
from loguru import logger
import os
from dotenv import load_dotenv

load_dotenv()

# ── Client — initialized once at module load ──────────────────────
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))


async def generate_with_openai(
    system_prompt: str,
    user_prompt: str,
    model: str = "gpt-4o",
    max_tokens: int = 1000,
    temperature: float = 0.7,
) -> str:
    """
    Calls GPT-4o via OpenAI API.
    Used in Single and Compare mode.
    Returns generated copy as plain string.
    """
    try:
        response = await client.chat.completions.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )

        content = response.choices[0].message.content

        logger.info(
            f"OpenAI generation complete | "
            f"Model: {model} | "
            f"Input tokens: {response.usage.prompt_tokens} | "
            f"Output tokens: {response.usage.completion_tokens}"
        )

        return content

    except Exception as e:
        logger.error(f"OpenAI API error: {e}")
        raise