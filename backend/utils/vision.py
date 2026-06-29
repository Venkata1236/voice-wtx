import httpx
import base64
import asyncio
from loguru import logger
import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

VISION_SYSTEM_PROMPT = """You are a visual brief extractor for a copywriting platform.
When given an image of a product, ad, moodboard, or creative, extract:
- Product / subject (what it is)
- Brand cues (colors, style, logo text if visible)
- Setting / context (where or how the product is shown)
- Mood and tone (energetic, calm, premium, playful, etc.)
- Any visible text or taglines
- Target audience signals (if discernible)

Return ONLY a concise structured brief paragraph (3-5 sentences) that a copywriter can
use directly. Do not use bullet points. Do not add preamble like 'The image shows...'.
Start directly with the product/subject."""


async def _fetch_as_base64(url: str) -> tuple[str, str]:
    """Download an image URL and return (base64_data, mime_type)."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
        b64 = base64.b64encode(resp.content).decode()
        return b64, content_type


async def extract_visual_context(image_url: str) -> str:
    """
    Given a Supabase Storage public URL, fetch the image and use
    Gemini 2.5 Flash (vision) to extract a structured visual brief.
    Returns a plain-text paragraph the copy model can use as context.
    """
    try:
        b64_data, mime_type = await _fetch_as_base64(image_url)

        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=VISION_SYSTEM_PROMPT,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=300,
                temperature=0.2,
            ),
        )

        image_part = {
            "inline_data": {
                "mime_type": mime_type,
                "data": b64_data,
            }
        }

        response = await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(
                None,
                lambda: model.generate_content([image_part])
            ),
            timeout=20.0,   # cap Gemini at 20s — emits vision_error if exceeded
        )

        context = response.text.strip()
        logger.info(f"Vision extraction complete | {len(context)} chars")
        return context

    except asyncio.TimeoutError:
        logger.warning("Vision extraction timed out after 20s — generating without image")
        return ""
    except Exception as e:
        logger.error(f"Vision extraction failed: {e}")
        # Return empty string — copy generation still works, just without image context
        return ""


async def extract_visual_context_multi(image_urls: list[str]) -> str:
    """
    Extract visual context from multiple images (up to a sensible cap) and
    combine into one brief. Each image's context is labelled so the copy
    model can tell them apart.
    """
    if not image_urls:
        return ""

    urls = [u for u in image_urls if u][:5]   # cap at 5
    if not urls:
        return ""
    if len(urls) == 1:
        return await extract_visual_context(urls[0])

    results = await asyncio.gather(*[extract_visual_context(u) for u in urls])
    parts = []
    for i, ctx in enumerate(results, 1):
        if ctx:
            parts.append(f"Image {i}: {ctx}")
    return "\n\n".join(parts)