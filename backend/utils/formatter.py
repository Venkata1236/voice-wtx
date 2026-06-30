import csv
import io
from datetime import datetime
from loguru import logger


def format_as_plain_text(variants: list[dict], brand_name: str) -> str:
    """
    Formats approved copy as plain text.
    Use for: Paste into Google Docs, WhatsApp, or client decks.
    Clean copy with brand name, date, model, and variant number.
    """
    lines = []

    for i, variant in enumerate(variants, 1):
        created_date = variant.get("created_at", "")
        if isinstance(created_date, str) and created_date:
            try:
                created_date = datetime.fromisoformat(
                    created_date.replace("Z", "+00:00")
                ).strftime("%d %b %Y")
            except ValueError:
                created_date = created_date[:10]


        lines.append(f"--- {brand_name} | Variant {i} ---")
        lines.append(f"Date: {created_date}")
        lines.append(f"Model: {variant.get('model', '')}")
        lines.append(f"Format: {variant.get('format', '')}")
        lines.append("")
        lines.append(variant.get("content", ""))
        lines.append("")
        lines.append("")

    return "\n".join(lines)


def format_as_csv(variants: list[dict], brand_name: str) -> str:
    """
    Formats copy as CSV.
    Use for: Import into Buffer, Hootsuite, or Google Sheets.
    Columns: Brand, Date, Model, Format, Status, Copy, Score.
    """
    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow(["Brand", "Date", "Model", "Format", "Status", "Copy", "Score"])

    for variant in variants:
        created_date = variant.get("created_at", "")
        if isinstance(created_date, str) and created_date:
            try:
                created_date = datetime.fromisoformat(
                    created_date.replace("Z", "+00:00")
                ).strftime("%Y-%m-%d")
            except ValueError:
                created_date = created_date[:10]

        writer.writerow([
            brand_name,
            created_date,
            variant.get("model", ""),
            variant.get("format", ""),
            variant.get("status", ""),
            variant.get("content", ""),
            variant.get("score", ""),
        ])

    return output.getvalue()


def format_as_kb_archive(
    variants: list[dict],
    brand_name: str,
    kb_context: dict = None,
) -> str:
    """
    Formats full archive with metadata.
    Use for: Save for records or next month seed data,
    handover if a team member changes, or client copy audits.
    Includes everything — brand context, all variants, full metadata.
    """
    lines = []

    lines.append("=" * 60)
    lines.append(f"VOICE — KB ARCHIVE EXPORT")
    lines.append(f"Brand: {brand_name}")
    lines.append(f"Exported: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")
    lines.append(f"Total Variants: {len(variants)}")
    lines.append("=" * 60)
    lines.append("")

    # Include KB context summary if provided
    if kb_context:
        lines.append("--- BRAND CONTEXT AT TIME OF EXPORT ---")
        if kb_context.get("tone_tags"):
            lines.append(f"Tone Tags: {', '.join(kb_context['tone_tags'])}")
        if kb_context.get("rules_do"):
            lines.append("DO Rules:")
            for rule in kb_context["rules_do"]:
                lines.append(f"  - {rule}")
        if kb_context.get("rules_dont"):
            lines.append("DON'T Rules:")
            for rule in kb_context["rules_dont"]:
                lines.append(f"  - {rule}")
        lines.append("")

    lines.append("--- VARIANTS ---")
    lines.append("")

    for i, variant in enumerate(variants, 1):
        created_date = variant.get("created_at", "")
        if isinstance(created_date, str) and created_date:
            try:
                created_date = datetime.fromisoformat(
                    created_date.replace("Z", "+00:00")
                ).strftime("%d %b %Y, %H:%M")
            except ValueError:
                created_date = created_date[:16]

        lines.append(f"[{i}] ID: {variant.get('id', '')}")
        lines.append(f"    Date: {created_date}")
        lines.append(f"    Model: {variant.get('model', '')}")
        lines.append(f"    Format: {variant.get('format', '')}")
        lines.append(f"    Status: {variant.get('status', '')}")
        lines.append(f"    Score: {variant.get('score', '')}")

        if variant.get("agent_generator"):
            lines.append(
                f"    Forge Agents: {variant['agent_generator']} + {variant.get('agent_critic', '')}"
            )

        if variant.get("rejection_reason"):
            lines.append(f"    Rejection Reason: {variant['rejection_reason']}")

        lines.append(f"    Brief: {variant.get('brief', '')}")
        lines.append(f"    Copy:")
        lines.append(f"    {variant.get('content', '')}")
        lines.append("")
        lines.append("-" * 40)
        lines.append("")

    return "\n".join(lines)


def get_export_filename(brand_name: str, export_format: str) -> str:
    """
    Generates a clean filename for export downloads.
    Example: zepto-fresh-export-2026-06-11.csv
    """
    safe_brand_name = brand_name.lower().replace(" ", "-")
    date_str = datetime.utcnow().strftime("%Y-%m-%d")

    extension_map = {
        "plain_text": "txt",
        "csv": "csv",
        "kb_archive": "txt",
    }

    extension = extension_map.get(export_format, "txt")

    return f"{safe_brand_name}-export-{date_str}.{extension}"