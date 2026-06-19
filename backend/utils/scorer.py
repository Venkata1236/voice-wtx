import re
from loguru import logger
from models.providers.anthropic import generate_with_claude


_JUDGE_SYSTEM = """You are a strict brand-alignment judge for a copywriting tool.
Given a brand profile and a piece of marketing copy, rate from 0 to 100 how well the
copy matches THIS brand — its voice, tone, values, audience, and rules.

Guide:
- 90-100: nails the brand voice, tone, and rules
- 70-89: clearly on-brand, minor gaps
- 50-69: generic or only partially on-brand
- below 50: off-brand, or breaks a stated rule

Respond with ONLY the number (0-100). No words, no % sign, no explanation."""


def _brand_profile(kb: dict) -> str:
    """Condense the KB into a compact brand profile for the judge (keeps tokens low)."""
    parts = []
    if kb.get("brand_name"):
        parts.append(f"Brand: {kb['brand_name']}")
    if kb.get("brand_category"):
        parts.append(f"Category: {kb['brand_category']}")
    if kb.get("tone_tags"):
        parts.append("Tone: " + ", ".join(kb["tone_tags"]))
    if kb.get("rules_do"):
        parts.append("Always: " + "; ".join(kb["rules_do"]))
    if kb.get("rules_dont"):
        parts.append("Never: " + "; ".join(kb["rules_dont"]))
    doc = (kb.get("brand_document") or "").strip()
    if doc:
        # First ~1500 chars carry the brand essence (vision, values, archetype)
        parts.append("Brand document (excerpt):\n" + doc[:1500])
    return "\n".join(parts) if parts else "No brand profile available."


async def score_brand_relevance(copy: str, kb: dict) -> int:
    """
    Returns a 0-100 score for how on-brand the copy is vs the brand document.
    Returns 0 on failure (the UI hides a 0 badge), so scoring never blocks output.
    """
    if not copy or not copy.strip():
        return 0

    try:
        user_prompt = (
            f"BRAND PROFILE:\n{_brand_profile(kb)}\n\n"
            f"COPY:\n{copy}\n\n"
            f"Score (0-100):"
        )

        raw = await generate_with_claude(
            system_prompt=_JUDGE_SYSTEM,
            user_prompt=user_prompt,
            model="claude-haiku-4-5",
            max_tokens=8,
            temperature=0,
        )

        match = re.search(r"\d{1,3}", raw or "")
        if not match:
            logger.warning(f"Scorer returned no number: {raw!r}")
            return 0

        score = max(0, min(100, int(match.group())))
        logger.info(f"Brand relevance score: {score}")
        return score

    except Exception as e:
        logger.warning(f"Brand relevance scoring failed: {e}")
        return 0