from pdfminer.high_level import extract_text as pdf_extract_text
from docx import Document
from loguru import logger
import os


def extract_text_from_file(file_path: str, content_type: str) -> str:
    """
    Main entry point — detects file type and routes to correct parser.
    Returns extracted plain text string.
    """
    try:
        if content_type == "application/pdf":
            return extract_from_pdf(file_path)

        elif content_type == (
            "application/vnd.openxmlformats-officedocument"
            ".wordprocessingml.document"
        ):
            return extract_from_docx(file_path)

        else:
            logger.warning(f"Unsupported file type: {content_type}")
            return ""

    except Exception as e:
        logger.error(f"Text extraction failed for {file_path}: {e}")
        return ""


def extract_from_pdf(file_path: str) -> str:
    """
    Extracts text from a PDF file using pdfminer.six.
    Works only on text-based PDFs — not scanned image PDFs.
    Scanned PDFs return empty string — user must upload DOCX instead.
    """
    try:
        # pdfminer extracts text page by page automatically
        text = pdf_extract_text(file_path)

        if not text or not text.strip():
            logger.warning(
                f"No text extracted from PDF: {file_path}. "
                "PDF may be a scanned image."
            )
            return ""

        # Clean up excessive whitespace and blank lines
        lines = [line.strip() for line in text.splitlines()]
        cleaned = "\n".join(line for line in lines if line)

        logger.info(
            f"PDF extracted: {file_path} | "
            f"Words: {len(cleaned.split())}"
        )

        # Truncate to 6000 words max — KB limit per VOICE spec
        return truncate_to_word_limit(cleaned, limit=6000)

    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        return ""


def extract_from_docx(file_path: str) -> str:
    """
    Extracts text from a DOCX file using python-docx.
    Reads all paragraphs in order — preserves document structure.
    """
    try:
        doc = Document(file_path)

        # Extract text from every paragraph in the document
        paragraphs = []
        for para in doc.paragraphs:
            text = para.text.strip()
            # Skip empty paragraphs
            if text:
                paragraphs.append(text)

        # Also extract text from tables inside the document
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    cell_text = cell.text.strip()
                    if cell_text and cell_text not in paragraphs:
                        paragraphs.append(cell_text)

        full_text = "\n".join(paragraphs)

        if not full_text.strip():
            logger.warning(f"No text extracted from DOCX: {file_path}")
            return ""

        logger.info(
            f"DOCX extracted: {file_path} | "
            f"Words: {len(full_text.split())}"
        )

        # Truncate to 6000 words max — KB limit per VOICE spec
        return truncate_to_word_limit(full_text, limit=6000)

    except Exception as e:
        logger.error(f"DOCX extraction error: {e}")
        return ""


def truncate_to_word_limit(text: str, limit: int = 6000) -> str:
    """
    Truncates text to a maximum word count.
    VOICE KB limit is 6000 words per document per spec.
    """
    words = text.split()

    if len(words) <= limit:
        return text

    truncated = " ".join(words[:limit])
    logger.info(
        f"Text truncated to {limit} words "
        f"(original: {len(words)} words)"
    )

    return truncated


def get_word_count(text: str) -> int:
    """
    Returns word count of extracted text.
    Stored in DB and shown in the KB panel.
    """
    if not text:
        return 0
    return len(text.split())