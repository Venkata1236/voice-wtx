from loguru import logger
from agents.autogen.personas.vikram import build_vikram
from agents.autogen.personas.priya import build_priya
from agents.autogen.personas.maya import build_maya
from agents.autogen.personas.arjun import build_arjun


# ── Agent name to builder function mapping ────────────────────────
GENERATOR_BUILDERS = {
    "Vikram": build_vikram,
    "Priya": build_priya,
}

CRITIC_BUILDERS = {
    "Maya": build_maya,
    "Arjun": build_arjun,
}


def build_forge_agents(
    generator_name: str,
    critic_name: str,
    kb_context_str: str,
):
    """
    Builds the Generator and Critic agent pair for a Forge debate.
    Each agent is initialized fresh with the brand's KB context
    baked into its system message.

    Returns a tuple: (generator_agent, critic_agent)
    """
    generator_builder = GENERATOR_BUILDERS.get(generator_name)
    critic_builder = CRITIC_BUILDERS.get(critic_name)

    if not generator_builder:
        raise ValueError(
            f"Unknown generator agent: {generator_name}. "
            f"Available: {list(GENERATOR_BUILDERS.keys())}"
        )

    if not critic_builder:
        raise ValueError(
            f"Unknown critic agent: {critic_name}. "
            f"Available: {list(CRITIC_BUILDERS.keys())}"
        )

    logger.info(
        f"Building Forge agent pair | "
        f"Generator: {generator_name} | Critic: {critic_name}"
    )

    generator = generator_builder(kb_context_str)
    critic = critic_builder(kb_context_str)

    return generator, critic