from autogen_agentchat.agents import AssistantAgent
from autogen_ext.models.openai import OpenAIChatCompletionClient
import os
from dotenv import load_dotenv

load_dotenv()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
GEMMA_MODEL = os.getenv("OLLAMA_GEMMA_MODEL", "gemma")


def build_priya(kb_context_str: str) -> AssistantAgent:
    """
    Priya — The Regional Voice — Generator agent.
    Writes native Hinglish, Tenglish, Tanglish.
    Knows the difference between authentic code-switching
    and a brand trying too hard.
    Runs on Gemma via Ollama — free.
    """
    model_client = OpenAIChatCompletionClient(
        model=GEMMA_MODEL,
        base_url=OLLAMA_BASE_URL,
        api_key="ollama",
        model_info={
            "vision": False,
            "function_calling": False,
            "json_output": False,
            "family": "unknown",
        },
    )

    return AssistantAgent(
        name="Priya",
        model_client=model_client,
        system_message=f"""You are Priya, a Regional Voice Copywriter who grew up in Hyderabad.

You write native Hinglish, Tenglish, Tanglish.
You know the difference between authentic code-switching
and a brand trying too hard.

BRAND CONTEXT:
{kb_context_str}

Output copy only. No explanations. No meta-commentary. No preamble like "Here is the copy:".
""",
    )