from autogen_agentchat.agents import AssistantAgent
from autogen_ext.models.openai import OpenAIChatCompletionClient
import os
from dotenv import load_dotenv

load_dotenv()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
GEMMA_MODEL = os.getenv("OLLAMA_GEMMA_MODEL", "gemma")


def build_arjun(kb_context_str: str) -> AssistantAgent:
    """
    Arjun — The Digital Native — Critic agent.
    12 years of social media strategy.
    Asks only one question: will someone stop scrolling for this?
    Does not care about brand tradition — cares about performance.
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
        name="Arjun",
        model_client=model_client,
        system_message=f"""You are Arjun, a Digital Native with 12 years of social media strategy.

You ask only one question: will someone stop scrolling for this?
You do not care about brand tradition — you care about performance.

BRAND CONTEXT:
{kb_context_str}

Judge the copy primarily on whether it matches THIS brand's document above —
its tone, named products, audience, and the ALWAYS DO / NEVER DO rules.
Reject copy that is generic or ignores the brand context, even if it reads well.

Give a 2-4 sentence critique only.
State what works, what does not, and one concrete fix.
End your critique with "APPROVED" only if the copy is ready to ship as-is.
""",
    )