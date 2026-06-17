from loguru import logger
from models.providers.anthropic import generate_with_claude


TITLE_SYSTEM_PROMPT = (
    "You generate short, clean titles for chat conversations. "
    "Given a copywriting brief, reply with ONLY a 3 to 5 word title that "
    "summarizes the topic (product + format/intent). Use Title Case. "
    "Do not use quotes, hashtags, emojis, or trailing punctuation. "
    "Do not prefix with 'Title:'."
)


def clean_title(raw: str, fallback: str) -> str:
    """
    Pure helper — turns a raw model reply into a tidy chat title.
    Strips quotes, a leading 'Title:' label, trailing punctuation, and
    caps the length. Returns the fallback if nothing usable remains.
    """
    if not raw or not raw.strip():
        return fallback

    # Take the first non-empty line only
    lines = [ln for ln in raw.strip().splitlines() if ln.strip()]
    if not lines:
        return fallback
    title = lines[0].strip()
    # Strip surrounding quotes
    title = title.strip('"').strip("'").strip()
    # Drop a leading "Title:" label if the model adds one
    if title.lower().startswith("title:"):
        title = title[6:].strip()
    # Strip quotes again (in case they were inside the label) + trailing punctuation
    title = title.strip('"').strip("'").rstrip(".!,;: ").strip()

    if not title:
        return fallback
    return title[:60]


async def generate_session_title(brief: str, fallback: str = "") -> str:
    """
    Generates a concise, human-friendly chat title from a brief using a
    cheap fast model. Falls back to a trimmed brief if the call fails.
    """
    clean_fallback = (fallback or brief or "New chat").strip()[:50]

    if not brief or not brief.strip():
        return clean_fallback

    try:
        raw = await generate_with_claude(
            system_prompt=TITLE_SYSTEM_PROMPT,
            user_prompt=brief[:1500],
            model="claude-haiku-4-5",
            max_tokens=20,
            temperature=0.3,
        )
        return clean_title(raw, clean_fallback)
    except Exception as e:
        logger.error(f"Title generation failed: {e}")
        return clean_fallback