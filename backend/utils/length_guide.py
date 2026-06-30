import re
from typing import Optional


# ── Default length targets per format (from the content spec table) ──
# reel_hook / story / linkedin are not in the table — sensible defaults used.
_FORMAT_SPECS = {
    "reel_hook": "6-12 words — one punchy hook line, max ~80 characters.",
    "carousel": (
        "10-25 words per slide (under 10 words for fun/casual posts), "
        "max 150 characters per slide. One idea per slide, no paragraphs. "
        "Aim for 5-8 slides total."
    ),
    "story": "3-12 words — ultra short, max ~60 characters.",
    "linkedin": "50-150 words — professional, with context and a clear takeaway.",
}

# Caption length depends on the platform named in the brief
_CAPTION_BY_PLATFORM = {
    "instagram": "20-60 words, 125-300 characters. Strong first line — the hook must land before the 'more' cut-off.",
    "twitter": "10-30 words, 50-150 characters. Conversational — feels like a thought, not ad copy.",
    "facebook": "30-100 words, 150-500 characters. More context, storytelling, community tone.",
}
_DEFAULT_CAPTION = _CAPTION_BY_PLATFORM["instagram"]


# Detects an explicit length requirement in the brief (words or characters).
# Matches "under 10 words", "20 words", "max 150 characters", "10-15 words", etc.
# Deliberately ignores "minutes", "mins", and other units.
_USER_LIMIT_RE = re.compile(
    r"((?:under|below|max(?:imum)?|no more than|less than|about|around|approx(?:imately)?|exactly|upto|up to)?\s*"
    r"\d+\s*(?:[-\u2013to]+\s*\d+\s*)?(?:words?|characters?|chars?))\b",
    re.IGNORECASE,
)


def _detect_platform(brief: str) -> Optional[str]:
    b = (brief or "").lower()
    if "facebook" in b:
        return "facebook"
    if "instagram" in b or "insta" in b:
        return "instagram"
    if "twitter" in b or "x tweet" in b or "platform: x" in b or " on x" in b:
        return "twitter"
    return None


def detect_user_length(brief: str) -> Optional[str]:
    """Return the user's stated length phrase if the brief specifies one, else None."""
    if not brief:
        return None
    m = _USER_LIMIT_RE.search(brief)
    return m.group(1).strip() if m else None


def build_length_instruction(format: str, brief: str) -> str:
    """
    Build a LENGTH section for the system prompt.
    A length stated in the brief always overrides the per-format default.
    """
    brief = brief or ""

    user_limit = detect_user_length(brief)
    if user_limit:
        return (
            "LENGTH:\n"
            f'- The brief requests a specific length: "{user_limit}". '
            "Follow it exactly. This overrides any default length.\n"
            "- Do not state the word or character count in the output."
        )

    fmt = (format or "").lower()
    if fmt == "caption":
        platform = _detect_platform(brief)
        spec = _CAPTION_BY_PLATFORM.get(platform, _DEFAULT_CAPTION)
    else:
        spec = _FORMAT_SPECS.get(fmt, _DEFAULT_CAPTION)

    return (
        "LENGTH:\n"
        f"- Target length for this format: {spec}\n"
        "- Stay within this range unless the brief says otherwise.\n"
        "- Do not state the word or character count in the output."
    )