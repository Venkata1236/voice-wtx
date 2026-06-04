import httpx
from loguru import logger
import os
from dotenv import load_dotenv

load_dotenv()

# Ollama runs locally — default port 11434
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")


async def generate_with_ollama(
    system_prompt: str,
    user_prompt: str,
    model: str = "mistral",
    max_tokens: int = 1000,
    temperature: float = 0.7,
) -> str:
    """
    Calls local Ollama server for free model inference.
    Used exclusively in Forge mode — zero API cost.
    Supports mistral and gemma models.
    Returns generated copy as plain string.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/chat/completions",
                headers={"Content-Type": "application/json"},
                json={
                    "model": model,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                },
                # Longer timeout — local models are slower than APIs
                timeout=120.0,
            )

            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]

            logger.info(
                f"Ollama generation complete | "
                f"Model: {model}"
            )

            return content

    except httpx.ConnectError:
        logger.error(
            "Ollama server not running. "
            "Start it with: ollama serve"
        )
        raise Exception(
            "Forge mode requires Ollama running locally. "
            "Run: ollama serve"
        )

    except Exception as e:
        logger.error(f"Ollama error: {e}")
        raise