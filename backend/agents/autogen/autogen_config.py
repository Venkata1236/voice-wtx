import os
from dotenv import load_dotenv

load_dotenv()

# ── Ollama base URL — local model server ──────────────────────────
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")

# ── Mistral config — used by Vikram, Maya ─────────────────────────
mistral_config = {
    "config_list": [
        {
            "model": os.getenv("OLLAMA_MISTRAL_MODEL", "mistral"),
            "base_url": OLLAMA_BASE_URL,
            # Ollama does not require a real API key
            "api_key": "ollama",
        }
    ],
    "temperature": 0.7,
    # Disable caching — every debate should be fresh
    "cache_seed": None,
}

# ── Gemma config — used by Priya, Arjun ───────────────────────────
gemma_config = {
    "config_list": [
        {
            "model": os.getenv("OLLAMA_GEMMA_MODEL", "gemma"),
            "base_url": OLLAMA_BASE_URL,
            "api_key": "ollama",
        }
    ],
    "temperature": 0.8,
    "cache_seed": None,
}