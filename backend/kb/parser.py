from markitdown import MarkItDown
from loguru import logger
from llmlingua import PromptCompressor


# ── markitdown — converts PDF / DOCX / etc. to clean markdown ──────
# Local, free, no API. Preserves headings, lists, and tables as markdown.
_markitdown = MarkItDown()

# ── LLMLingua compressor — initialized once at module load ─────────
# Small local model, compresses long text without an API call.
# device_map="cpu" ensures it works without a GPU.
compressor = PromptCompressor(
    model_name="microsoft/llmlingua-2-xlm-roberta-large-meetingbank",
    use_llmlingua2=True,
    device_map="cpu",
)


def extract_text_from_file(file_path: str, content_type: str) -> str:
    """
    Main entry point. Converts the uploaded document to markdown with
    markitdown, then compresses with LLMLingua if it's long.
    Returns the (possibly compressed) markdown string.

    content_type is kept for signature compatibility; markitdown
    auto-detects the format from the file itself.
    """
    try:
        markdown = convert_to_markdown(file_path)

        if not markdown or not markdown.strip():
            logger.warning(
                f"No content extracted from: {file_path}. "
                "File may be empty or a scanned image."
            )
            return ""

        logger.info(
            f"Markdown extracted: {file_path} | "
            f"Words: {len(markdown.split())}"
        )

        # Compress if over 6000 words — preserve meaning, reduce tokens
        return compress_if_needed(markdown, limit=6000)

    except Exception as e:
        logger.error(f"Text extraction failed for {file_path}: {e}")
        return ""


def convert_to_markdown(file_path: str) -> str:
    """
    Convert a document to markdown using markitdown.
    Light whitespace cleanup on the result.
    """
    result = _markitdown.convert(file_path)
    text = (result.text_content or "").strip()

    # Collapse runs of blank lines to at most one
    lines = text.splitlines()
    cleaned = []
    blank = False
    for line in lines:
        if line.strip():
            cleaned.append(line.rstrip())
            blank = False
        else:
            if not blank:
                cleaned.append("")
            blank = True

    return "\n".join(cleaned).strip()


def compress_if_needed(text: str, limit: int = 6000) -> str:
    """
    If text is within limit — return as is.
    If text exceeds limit — use LLMLingua to compress intelligently.
    LLMLingua preserves key information better than hard truncation.
    """
    words = text.split()

    if len(words) <= limit:
        logger.info(f"Text within limit ({len(words)} words) — no compression needed")
        return text

    logger.info(
        f"Text exceeds limit ({len(words)} words) — compressing with LLMLingua..."
    )

    try:
        target_tokens = int(limit * 1.3)  # 1 word ≈ 1.3 tokens

        result = compressor.compress_prompt(
            text,
            rate=limit / len(words),
            target_token=target_tokens,
            # Preserve markdown structure markers and sentence boundaries
            force_tokens=["\n", "#", "-", "*", ".", "!", "?"],
        )

        compressed = result["compressed_prompt"]

        logger.info(
            f"LLMLingua compression complete | "
            f"Original: {len(words)} words → Compressed: {len(compressed.split())} words"
        )

        return compressed

    except Exception as e:
        logger.warning(f"LLMLingua compression failed: {e} — falling back to truncation")
        return " ".join(words[:limit])


def get_word_count(text: str) -> int:
    """Returns word count of extracted text. Stored in DB and shown in KB panel."""
    if not text:
        return 0
    return len(text.split())