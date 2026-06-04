from loguru import logger
from db.supabase_client import get_supabase


async def build_kb_context(brand_id: str) -> dict:
    """
    Assembles the complete Knowledge Base context for a brand.
    Called before every single generation, compare, and forge request.
    Returns a structured dict that gets injected into the AI prompt.
    """
    supabase = get_supabase()

    # ── Fetch KB settings ─────────────────────────────────────────
    kb_response = (
        supabase.table("brand_kb")
        .select("*")
        .eq("brand_id", brand_id)
        .single()
        .execute()
    )

    if not kb_response.data:
        logger.warning(f"No KB found for brand: {brand_id}")
        return _empty_kb(brand_id)

    kb = kb_response.data

    # ── Fetch approved brand document ─────────────────────────────
    brand_doc = (
        supabase.table("kb_documents")
        .select("extracted_text, file_name, word_count")
        .eq("brand_id", brand_id)
        .eq("doc_type", "brand_document")
        .eq("status", "approved")
        .single()
        .execute()
    )

    # ── Fetch approved audience personas document ─────────────────
    personas_doc = (
        supabase.table("kb_documents")
        .select("extracted_text, file_name, word_count")
        .eq("brand_id", brand_id)
        .eq("doc_type", "audience_personas")
        .eq("status", "approved")
        .single()
        .execute()
    )

    # ── Fetch last 30 approved posts ──────────────────────────────
    # These are real approved copy examples the AI learns from
    approved_posts = (
        supabase.table("approved_posts")
        .select("content, format, model")
        .eq("brand_id", brand_id)
        .order("created_at", desc=True)
        .limit(30)
        .execute()
    )

    # ── Fetch last 5 rejected copy reasons ────────────────────────
    # AI uses these to avoid repeating same mistakes
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

    # ── Fetch brand name ──────────────────────────────────────────
    brand_response = (
        supabase.table("brands")
        .select("name, category")
        .eq("id", brand_id)
        .single()
        .execute()
    )

    brand_name = brand_response.data.get("name", "Unknown Brand") if brand_response.data else "Unknown Brand"
    brand_category = brand_response.data.get("category", "") if brand_response.data else ""

    # ── Assemble full KB context dict ─────────────────────────────
    context = {
        "brand_id": brand_id,
        "brand_name": brand_name,
        "brand_category": brand_category,

        # Tone tags — only active ones
        "tone_tags": kb.get("tone_tags", []),

        # Brand rules
        "rules_do": kb.get("brand_rules_do", []),
        "rules_dont": kb.get("brand_rules_dont", []),

        # Monthly campaign focus set by Strategist
        "brief_template": kb.get("brief_template", {}),

        # Uploaded brand guidelines document
        "brand_document": (
            brand_doc.data.get("extracted_text", "")
            if brand_doc.data else ""
        ),

        # Uploaded audience personas document
        "audience_personas": (
            personas_doc.data.get("extracted_text", "")
            if personas_doc.data else ""
        ),

        # Last 30 approved copy examples — AI learns from these
        "approved_posts": approved_posts.data or [],

        # Last 5 rejection reasons — AI avoids repeating these
        "recent_rejections": recent_rejections.data or [],
    }

    logger.info(
        f"KB context built for brand: {brand_name} | "
        f"Tone tags: {len(context['tone_tags'])} | "
        f"Approved posts: {len(context['approved_posts'])} | "
        f"Brand doc: {'yes' if context['brand_document'] else 'no'}"
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