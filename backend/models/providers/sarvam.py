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
    model: str = "sarvam-m",
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
            content = data["choices"][0]["message"]["content"]

            logger.info(
                f"Sarvam generation complete | "
                f"Model: {model}"
            )

            return content

    except Exception as e:
        logger.error(f"Sarvam API error: {e}")
        raise