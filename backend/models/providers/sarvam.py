import httpx
from loguru import logger
import os
from dotenv import load_dotenv

load_dotenv()

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")
SARVAM_BASE_URL = "https://api.sarvam.ai/v1"


async def generate_with_sarvam(
    system_prompt: str,
    user_prompt: str,
    model: str = "sarvam-30b",
    max_tokens: int = 1000,
    temperature: float = 0.7,
) -> str:
    """
    Calls Sarvam API for Indian language copy.
    Best for Hinglish, Tenglish, Tanglish content.
    Uses OpenAI-compatible chat completions endpoint.
    Returns generated copy as plain string.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{SARVAM_BASE_URL}/chat/completions",
                headers={
                    "api-subscription-key": SARVAM_API_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "max_completion_tokens": max_tokens,
                    "temperature": temperature,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                },
                timeout=60.0,
            )

            if response.status_code != 200:
                logger.error(f"Sarvam API error response: {response.text}")

            response.raise_for_status()
            data = response.json()

            message = data["choices"][0]["message"]
            content = message.get("content")

            # sarvam-30b has hybrid thinking mode — sometimes the actual
            # answer is in 'reasoning_content' if 'content' is empty
            if not content:
                content = message.get("reasoning_content", "")

            if not content:
                logger.error(f"Sarvam returned empty content. Full response: {data}")
                raise ValueError("Sarvam returned empty content")

            logger.info(
                f"Sarvam generation complete | "
                f"Model: {model} | Length: {len(content)}"
            )

            return content

    except Exception as e:
        logger.error(f"Sarvam API error: {e}")
        raise