from loguru import logger
from db.supabase_client import get_supabase


# ── KB static cache ────────────────────────────────────────────────
# Brand documents, personas, tone tags, and rules change rarely, so we
# cache the heavy static part of the KB per brand in memory and reuse it
# instead of re-reading it from the DB on every generation.
# The dynamic learning signals (approved posts, recent rejections) are
# always fetched fresh so they stay current.
# Cache is invalidated on document upload/approve/reject and KB updates.
_kb_static_cache: dict = {}


def invalidate_kb_cache(brand_id: str) -> None:
    """Drop a brand's cached static KB. Call after any KB/document change."""
    if brand_id in _kb_static_cache:
        del _kb_static_cache[brand_id]
        logger.info(f"KB cache invalidated for brand: {brand_id}")


async def _build_static_kb(brand_id: str) -> dict:
    """Builds the static (rarely-changing) part of the KB and caches it."""
    if brand_id in _kb_static_cache:
        logger.info(f"KB static cache HIT for brand: {brand_id}")
        return _kb_static_cache[brand_id]

    logger.info(f"KB static cache MISS for brand: {brand_id} — building")
    supabase = get_supabase()

    kb_response = (
        supabase.table("brand_kb")
        .select("*")
        .eq("brand_id", brand_id)
        .maybe_single()
        .execute()
    )

    if not kb_response or not kb_response.data:
        logger.warning(f"No KB found for brand: {brand_id}")
        static = _empty_kb(brand_id)
        # Don't cache an empty/missing KB — it may appear once set up
        return static

    kb = kb_response.data

    brand_doc = (
        supabase.table("kb_documents")
        .select("extracted_text, file_name, word_count")
        .eq("brand_id", brand_id)
        .eq("doc_type", "brand_document")
        .eq("status", "approved")
        .maybe_single()
        .execute()
    )

    personas_doc = (
        supabase.table("kb_documents")
        .select("extracted_text, file_name, word_count")
        .eq("brand_id", brand_id)
        .eq("doc_type", "audience_personas")
        .eq("status", "approved")
        .maybe_single()
        .execute()
    )

    brand_response = (
        supabase.table("brands")
        .select("name, category")
        .eq("id", brand_id)
        .maybe_single()
        .execute()
    )
    brand_name = brand_response.data.get("name", "Unknown Brand") if brand_response and brand_response.data else "Unknown Brand"
    brand_category = brand_response.data.get("category", "") if brand_response and brand_response.data else ""

    static = {
        "brand_id": brand_id,
        "brand_name": brand_name,
        "brand_category": brand_category,
        "tone_tags": kb.get("tone_tags", []),
        "rules_do": kb.get("brand_rules_do", []),
        "rules_dont": kb.get("brand_rules_dont", []),
        "brief_template": kb.get("brief_template", {}),
        "brand_document": (
            brand_doc.data.get("extracted_text", "")
            if brand_doc and brand_doc.data else ""
        ),
        "audience_personas": (
            personas_doc.data.get("extracted_text", "")
            if personas_doc and personas_doc.data else ""
        ),
    }

    _kb_static_cache[brand_id] = static
    logger.info(
        f"KB static cached for brand: {brand_name} | "
        f"Brand doc: {'yes' if static['brand_document'] else 'no'}"
    )
    return static


async def build_kb_context(brand_id: str) -> dict:
    """
    Assembles the complete Knowledge Base context for a brand.
    Called before every single generation, compare, and forge request.

    The static part (brand document, personas, tone, rules, brief template)
    is cached per brand and reused. The dynamic learning signals (approved
    posts, recent rejections) are always fetched fresh so they stay current.
    """
    supabase = get_supabase()

    # ── Static part — cached, rarely changes ──────────────────────
    static = await _build_static_kb(brand_id)

    # ── Dynamic part — always fresh ───────────────────────────────
    approved_posts = (
        supabase.table("approved_posts")
        .select("content, format, model")
        .eq("brand_id", brand_id)
        .order("created_at", desc=True)
        .limit(30)
        .execute()
    )

    recent_rejections = (
        supabase.table("copy_variants")
        .select("content, rejection_reason, format")
        .eq("brand_id", brand_id)
        .eq("status", "rejected")
        .not_.is_("rejection_reason", "null")
        .order("updated_at", desc=True)
        .limit(5)
        .execute()
    )

    # ── Merge static + dynamic ────────────────────────────────────
    context = {
        **static,
        "approved_posts": approved_posts.data or [],
        "recent_rejections": recent_rejections.data or [],
    }

    logger.info(
        f"KB context built for brand: {context.get('brand_name')} | "
        f"Tone tags: {len(context.get('tone_tags', []))} | "
        f"Approved posts: {len(context['approved_posts'])} | "
        f"Brand doc: {'yes' if context.get('brand_document') else 'no'}"
    )

    return context


def format_kb_for_prompt(kb_context: dict) -> str:
    """
    Converts the KB context dict into a formatted string
    that gets injected into the AI system prompt.
    Structured so the AI can read it clearly.
    """
    sections = []

    # Brand identity
    sections.append(
        f"BRAND: {kb_context['brand_name']} "
        f"({kb_context['brand_category']})"
    )

    # Tone tags
    if kb_context["tone_tags"]:
        sections.append(
            f"TONE: {', '.join(kb_context['tone_tags'])}"
        )

    # Brand rules
    if kb_context["rules_do"]:
        do_rules = "\n".join(f"- {rule}" for rule in kb_context["rules_do"])
        sections.append(f"ALWAYS DO:\n{do_rules}")

    if kb_context["rules_dont"]:
        dont_rules = "\n".join(f"- {rule}" for rule in kb_context["rules_dont"])
        sections.append(f"NEVER DO:\n{dont_rules}")

    # Monthly brief template
    if kb_context["brief_template"]:
        template = kb_context["brief_template"]
        template_lines = []
        if template.get("hero_product"):
            template_lines.append(f"Hero Product: {template['hero_product']}")
        if template.get("cta"):
            template_lines.append(f"CTA: {template['cta']}")
        if template.get("tone_direction"):
            template_lines.append(f"Tone Direction: {template['tone_direction']}")
        if template.get("campaign_theme"):
            template_lines.append(f"Campaign Theme: {template['campaign_theme']}")
        if template_lines:
            sections.append(
                f"THIS MONTH'S CAMPAIGN:\n" + "\n".join(template_lines)
            )

    # Brand guidelines document
    if kb_context["brand_document"]:
        sections.append(
            f"BRAND GUIDELINES:\n{kb_context['brand_document']}"
        )

    # Audience personas
    if kb_context["audience_personas"]:
        sections.append(
            f"TARGET AUDIENCE:\n{kb_context['audience_personas']}"
        )

    # Approved copy examples — show last 5 inline
    if kb_context["approved_posts"]:
        examples = kb_context["approved_posts"][:5]
        example_lines = []
        for i, post in enumerate(examples, 1):
            example_lines.append(
                f"{i}. [{post.get('format', '').upper()}] {post.get('content', '')}"
            )
        sections.append(
            f"APPROVED COPY EXAMPLES (learn from these):\n"
            + "\n".join(example_lines)
        )

    # Recent rejections — what NOT to repeat
    if kb_context["recent_rejections"]:
        rejection_lines = []
        for r in kb_context["recent_rejections"]:
            rejection_lines.append(
                f"- Rejected ({r.get('rejection_reason', 'unknown')}): "
                f"{r.get('content', '')[:80]}..."
            )
        sections.append(
            f"RECENTLY REJECTED (avoid these patterns):\n"
            + "\n".join(rejection_lines)
        )

    # ── Output format instruction — prevent metadata leakage ────────
    sections.append(
        "OUTPUT RULES:\n"
        "- Write the copy first.\n"
        "- No headings, no markdown formatting symbols (no #, no **).\n"
        "- No word count, character count, or any meta-commentary.\n"
        "- No preamble like 'Here is your copy:'.\n"
        "- After the copy, on a NEW LINE write exactly: KEYWORDS: followed by 5-8 unique comma-separated SEO keywords and hashtags relevant to the copy.\n"
        "- Never repeat the same keyword or hashtag.\n"
        "- Stop immediately after the KEYWORDS line. Do not write anything else.\n"
        "- Example format:\n"
        "  Mango season aa gaya! Order karo abhi.\n"
        "  KEYWORDS: Ratnagiri Alphonso, mango season, 10 minute delivery, #MangoSeason, #ZeptoFresh, #FreshFruits\n"
    )

    return "\n\n".join(sections)


def _empty_kb(brand_id: str) -> dict:
    """
    Returns an empty KB context when no KB exists for a brand.
    AI generates without brand context — better than crashing.
    """
    return {
        "brand_id": brand_id,
        "brand_name": "Unknown Brand",
        "brand_category": "",
        "tone_tags": [],
        "rules_do": [],
        "rules_dont": [],
        "brief_template": {},
        "brand_document": "",
        "audience_personas": "",
        "approved_posts": [],
        "recent_rejections": [],
    }