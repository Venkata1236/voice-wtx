from anthropic import AsyncAnthropic
from loguru import logger
import os
from dotenv import load_dotenv

load_dotenv()

client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


async def generate_with_claude(
    system_prompt: str,
    user_prompt: str,
    model: str = "claude-haiku-4-5",
    max_tokens: int = 1000,
    temperature: float = 0.7,
) -> str:
    """
    Calls Claude via Anthropic API — non-streaming.
    Used for score node and internal calls.
    """
    try:
        response = await client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )

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



async def stream_with_claude(
    system_prompt: str,
    user_prompt: str,
    model: str = "claude-haiku-4-5",
    max_tokens: int = 1000,
    temperature: float = 0.7,
):
    """
    Streams Claude response token by token.
    Yields each text chunk as it arrives.
    """
    try:
        async with client.messages.stream(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        ) as stream:
            async for text in stream.text_stream:
                yield text

    except Exception as e:
        logger.error(f"Anthropic streaming error: {e}")
        raise