from loguru import logger
import sys
import os
from dotenv import load_dotenv

load_dotenv()

APP_ENV = os.getenv("APP_ENV", "development")


def setup_logger():
    """
    Configures Loguru logger for the application.
    - Development: colorful console output, DEBUG level
    - Production: structured JSON logs to file + console, INFO level
    Call this once at app startup in main.py.
    """
    # Remove default handler
    logger.remove()

    if APP_ENV == "production":
        # ── Production — structured logs ───────────────────────────
        # Console — INFO and above, no colors (cleaner for log aggregators)
        logger.add(
            sys.stdout,
            level="INFO",
            format=(
                "{time:YYYY-MM-DD HH:mm:ss} | "
                "{level: <8} | "
                "{name}:{function}:{line} | "
                "{message}"
            ),
            serialize=False,
        )

        # File — rotated daily, kept for 30 days
        logger.add(
            "logs/voice_{time:YYYY-MM-DD}.log",
            level="INFO",
            rotation="00:00",
            retention="30 days",
            compression="zip",
            format=(
                "{time:YYYY-MM-DD HH:mm:ss} | "
                "{level: <8} | "
                "{name}:{function}:{line} | "
                "{message}"
            ),
        )

        # Separate error log — errors and above only
        logger.add(
            "logs/voice_errors_{time:YYYY-MM-DD}.log",
            level="ERROR",
            rotation="00:00",
            retention="60 days",
            compression="zip",
        )

    else:
        # ── Development — colorful, verbose ─────────────────────────
        logger.add(
            sys.stdout,
            level="DEBUG",
            colorize=True,
            format=(
                "<green>{time:HH:mm:ss}</green> | "
                "<level>{level: <8}</level> | "
                "<cyan>{name}:{function}:{line}</cyan> | "
                "<level>{message}</level>"
            ),
        )

    logger.info(f"Logger initialized | Environment: {APP_ENV}")

    return logger


# ── Convenience functions for common log patterns ─────────────────

def log_api_request(method: str, path: str, user_email: str = None):
    """Log an incoming API request."""
    user_info = f" | User: {user_email}" if user_email else ""
    logger.info(f"API Request | {method} {path}{user_info}")


def log_model_call(model: str, brand_id: str, tokens_used: int = None):
    """Log an AI model API call — useful for cost tracking."""
    token_info = f" | Tokens: {tokens_used}" if tokens_used else ""
    logger.info(f"Model Call | {model} | Brand: {brand_id}{token_info}")


def log_db_operation(operation: str, table: str, record_id: str = None):
    """Log a database operation."""
    record_info = f" | ID: {record_id}" if record_id else ""
    logger.debug(f"DB Operation | {operation} on {table}{record_info}")