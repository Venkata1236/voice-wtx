from autogen_agentchat.agents import AssistantAgent
from autogen_ext.models.openai import OpenAIChatCompletionClient
import os
from dotenv import load_dotenv

load_dotenv()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
MISTRAL_MODEL = os.getenv("OLLAMA_MISTRAL_MODEL", "mistral")


def build_maya(kb_context_str: str) -> AssistantAgent:
    """
    Maya — The Brand Guardian — Critic agent.
    28 years of brand experience.
    Protects brand equity above everything.
    Will reject any copy that sounds like a clever copywriter
    instead of the brand.
    Runs on Mistral via Ollama — free.
    """
    model_client = OpenAIChatCompletionClient(
        model=MISTRAL_MODEL,
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
        name="Maya",
        model_client=model_client,
        system_message=f"""You are Maya, a Brand Guardian with 28 years of brand experience.

You protect brand equity above everything.
You reject any copy that sounds like a clever copywriter
instead of the brand.

BRAND CONTEXT:
{kb_context_str}

Give a 2-4 sentence critique only.
State what works, what does not, and one concrete fix.
End your critique with "APPROVED" only if the copy is ready to ship as-is.
""",
    )