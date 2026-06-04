from loguru import logger
from agents.langgraph.state import GraphState


async def score_node(state: GraphState) -> GraphState:
    """
    Node 3 — Scoring Node.
    Scores generated copy against brand rules from KB.
    Returns a compliance score from 0 to 100.
    80+ is good. Below 60 means something is off.
    Skips if generation failed.
    """
    # Skip scoring if previous node failed
    if state.get("error") or not state.get("generated_copy"):
        logger.warning("Score node skipped — no copy to score")
        return {**state, "score": 0}

    logger.info("Score node running")

    try:
        copy = state["generated_copy"]
        kb_context = state.get("kb_context", {})

        score = calculate_brand_score(copy, kb_context)

        logger.info(f"Score node complete | Score: {score}")

        return {
            **state,
            "score": score,
            "error": None,
        }

    except Exception as e:
        logger.error(f"Score node failed: {e}")
        # Return 70 as fallback score — matches VOICE spec
        # "Scores always show 70% — scoring service temporarily unavailable"
        return {**state, "score": 70}


def calculate_brand_score(copy: str, kb_context: dict) -> int:
    """
    Calculates brand compliance score based on:
    - DO rules present in copy (positive score)
    - DONT rules violated in copy (negative score)
    - Tone tags reflected in copy (bonus score)
    Returns integer 0-100.
    """
    score = 70  # Base score
    copy_lower = copy.lower()

    rules_do = kb_context.get("rules_do", [])
    rules_dont = kb_context.get("rules_dont", [])
    tone_tags = kb_context.get("tone_tags", [])

    # No rules defined — return base score
    if not rules_do and not rules_dont:
        return score

    # ── Check DO rules ────────────────────────────────────────────
    # Each DO rule present in copy adds points
    if rules_do:
        do_points = 20 / len(rules_do)
        for rule in rules_do:
            # Extract key phrase from rule for matching
            rule_key = rule.lower().replace("always ", "").replace("use ", "")
            if any(word in copy_lower for word in rule_key.split()[:3]):
                score += do_points

    # ── Check DONT rules ──────────────────────────────────────────
    # Each DONT rule violated in copy subtracts points
    if rules_dont:
        dont_points = 15 / len(rules_dont)
        for rule in rules_dont:
            rule_key = rule.lower().replace("never ", "").replace("avoid ", "")
            if any(word in copy_lower for word in rule_key.split()[:3]):
                score -= dont_points

    # ── Check tone tags ───────────────────────────────────────────
    # Bonus points if copy reflects active tone tags
    if tone_tags:
        tone_bonus = 10 / len(tone_tags)
        tone_indicators = {
            "bold": ["!", "now", "today", "must"],
            "energetic": ["!", "amazing", "incredible", "wow"],
            "conversational": ["you", "your", "we", "let's"],
            "premium": ["exclusive", "finest", "crafted", "luxury"],
            "playful": ["fun", "yay", "love", "awesome"],
        }
        for tag in tone_tags:
            indicators = tone_indicators.get(tag.lower(), [])
            if any(ind in copy_lower for ind in indicators):
                score += tone_bonus

    # Clamp score between 0 and 100
    return max(0, min(100, int(score)))