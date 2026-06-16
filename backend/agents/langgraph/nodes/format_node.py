from loguru import logger
from agents.langgraph.state import GraphState
import re


async def format_node(state: GraphState) -> GraphState:
    """
    Node 4 — Format Node.
    Cleans copy and extracts SEO keywords from AI response.
    AI returns copy + KEYWORDS: line together.
    This node splits them and stores separately.
    """
    if state.get("error") or not state.get("generated_copy"):
        logger.warning("Format node skipped — no copy to format")
        return {**state, "final_copy": None, "keywords": []}

    logger.info("Format node running")

    try:
        raw_copy = state["generated_copy"]
        final_copy, keywords = parse_copy_and_keywords(raw_copy)

        logger.info(
            f"Format node complete | "
            f"Copy length: {len(final_copy)} chars | "
            f"Keywords: {keywords}"
        )

        return {
            **state,
            "final_copy": final_copy,
            "keywords": keywords,
            "error": None,
        }

    except Exception as e:
        logger.error(f"Format node failed: {e}")
        return {
            **state,
            "final_copy": state.get("generated_copy", ""),
            "keywords": [],
            "error": str(e),
        }


def parse_copy_and_keywords(text: str) -> tuple[str, list[str]]:
    """
    Splits AI response into copy and keywords.
    AI returns:
      <copy text>
      KEYWORDS: keyword1, keyword2, keyword3
    Returns (clean_copy, [keyword1, keyword2, keyword3])
    """
    keywords = []
    lines = text.strip().split('\n')

    # Find the KEYWORDS line
    keyword_line_index = None
    for i, line in enumerate(lines):
        if line.strip().upper().startswith('KEYWORDS:'):
            keyword_line_index = i
            raw_keywords = line.strip()[len('KEYWORDS:'):].strip()
            keywords = [k.strip() for k in raw_keywords.split(',') if k.strip()]
            # Cap at 8 keywords max, remove duplicates
            seen = set()
            unique_keywords = []
            for kw in keywords:
                kw_lower = kw.lower()
                if kw_lower not in seen:
                    seen.add(kw_lower)
                    unique_keywords.append(kw)
            keywords = unique_keywords[:8]
            break

    # Copy is everything before the KEYWORDS line
    if keyword_line_index is not None:
        copy_lines = lines[:keyword_line_index]
    else:
        copy_lines = lines

    copy = '\n'.join(copy_lines).strip()

    # Clean preambles from copy
    copy = clean_copy(copy)

    return copy, keywords


def clean_copy(text: str) -> str:
    """
    Removes common AI preamble phrases from generated copy.
    """
    preambles = [
        "here is your copy:",
        "here's your copy:",
        "here is the copy:",
        "here's the copy:",
        "here is a caption:",
        "here's a caption:",
        "here is your caption:",
        "here's your caption:",
        "here is your reel hook:",
        "here's your reel hook:",
        "sure! here",
        "sure, here",
        "of course! here",
        "certainly! here",
    ]

    cleaned = text.strip()
    cleaned_lower = cleaned.lower()

    for preamble in preambles:
        if cleaned_lower.startswith(preamble):
            cleaned = cleaned[len(preamble):].strip()
            break

    # Strip trailing metadata lines
    import re
    cleaned = re.sub(r'\n?-{2,}.*$', '', cleaned, flags=re.DOTALL).strip()
    cleaned = re.sub(r'\n?\*{0,2}word count\*{0,2}:.*$', '', cleaned, flags=re.IGNORECASE | re.DOTALL).strip()
    cleaned = re.sub(r'\n?\*{0,2}character count\*{0,2}:.*$', '', cleaned, flags=re.IGNORECASE | re.DOTALL).strip()
    cleaned = re.sub(r'^#+\s*', '', cleaned)

    return cleaned.strip()