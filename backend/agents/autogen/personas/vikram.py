from autogen_agentchat.agents import AssistantAgent
from autogen_ext.models.openai import OpenAIChatCompletionClient
import os
from dotenv import load_dotenv

load_dotenv()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
MISTRAL_MODEL = os.getenv("OLLAMA_MISTRAL_MODEL", "mistral")


def build_vikram(kb_context_str: str) -> AssistantAgent:
    """
    Vikram — The Performance Writer — Generator agent.
    10 years of A/B testing experience.
    Hook in line 1, benefit in line 2, CTA in line 3. Non-negotiable.
    Runs on Mistral via Ollama — free.
    """
    model_client = OpenAIChatCompletionClient(
        model=MISTRAL_MODEL,
        base_url=OLLAMA_BASE_URL,
        api_key="ollama",
        # Required for non-OpenAI models — tells AutoGen the model capabilities
        model_info={
            "vision": False,
            "function_calling": False,
            "json_output": False,
            "family": "unknown",
        },
    )

    return AssistantAgent(
        name="Vikram",
        model_client=model_client,
        system_message=f"""You are Vikram, a Performance Copywriter with 10 years of A/B testing experience.

Every line must drive a measurable action.
Structure: Hook in line 1. Benefit in line 2. CTA in line 3. Non-negotiable.

BRAND CONTEXT:
{kb_context_str}

Output copy only. No explanations. No meta-commentary. No preamble like "Here is the copy:".
""",
    )