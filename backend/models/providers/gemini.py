import google.generativeai as genai
from loguru import logger
import os
from dotenv import load_dotenv

load_dotenv()

# ── Configure Gemini client ───────────────────────────────────────
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))



async def generate_with_gemini(
    system_prompt: str,
    user_prompt: str,
    model: str = "gemini-1.5-pro",
    max_tokens: int = 1000,
    temperature: float = 0.7,
) -> str:
    """
    Calls Gemini via Google AI API.
    Used in Single and Compare mode.
    Best for brands with very long guidelines documents.
    Returns generated copy as plain string.
    """
    try:
        gemini_model = genai.GenerativeModel(
            model_name=model,
            # System instruction is passed at model level in Gemini
            system_instruction=system_prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=max_tokens,
                temperature=temperature,
            ),
        )

        # Gemini uses synchronous generate_content
        # Run in thread pool to avoid blocking async event loop
        import asyncio
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: gemini_model.generate_content(user_prompt)
        )

        content = response.text

        logger.info(
            f"Gemini generation complete | "
            f"Model: {model}"
        )

        return content

    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        raise