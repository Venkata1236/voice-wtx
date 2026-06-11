from loguru import logger
from autogen_agentchat.teams import RoundRobinGroupChat
from autogen_agentchat.conditions import TextMentionTermination, MaxMessageTermination
from autogen_agentchat.messages import TextMessage
from autogen_agentchat.base import TaskResult

from agents.autogen.forge_orchestrator import build_forge_agents
from kb.kb_builder import build_kb_context, format_kb_for_prompt


async def run_forge_debate(
    brand_id: str,
    brief: str,
    generator_name: str,
    critic_name: str,
    user_direction: str = None,
    max_turns: int = 6,
) -> dict:
    """
    Runs a Forge debate between a Generator and Critic agent.

    Flow:
    1. Generator writes copy based on brief + KB context
    2. Critic reviews and gives 2-4 sentence feedback
    3. If critic says APPROVED — debate ends
    4. If user_direction provided — injected as guidance for next round
    5. Otherwise generator revises based on critic feedback

    Returns debate history, final copy, and approval status.
    """
    logger.info(
        f"Forge debate starting | "
        f"Brand: {brand_id} | "
        f"Generator: {generator_name} | Critic: {critic_name}"
    )

    # ── Build KB context for this brand ───────────────────────────
    kb_context = await build_kb_context(brand_id)
    kb_context_str = format_kb_for_prompt(kb_context)

    # ── Build the agent pair fresh for this debate ────────────────
    generator, critic = build_forge_agents(
        generator_name=generator_name,
        critic_name=critic_name,
        kb_context_str=kb_context_str,
    )

    # ── Termination conditions ─────────────────────────────────────
    # Stop if critic says APPROVED, or after max_turns messages
    termination = (
        TextMentionTermination("APPROVED")
        | MaxMessageTermination(max_messages=max_turns)
    )

    # ── Build the team — Generator and Critic alternate turns ──────
    team = RoundRobinGroupChat(
        participants=[generator, critic],
        termination_condition=termination,
    )

    # ── Build the opening task message ─────────────────────────────
    task = f"BRIEF:\n{brief}"

    if user_direction:
        task += f"\n\nUSER DIRECTION:\n{user_direction}"

    # ── Run the debate ───────────────────────────────────────────
    debate_history = []
    final_copy = None
    is_approved = False

    async for message in team.run_stream(task=task):
        # TaskResult is the final summary message — skip it
        if isinstance(message, TaskResult):
            continue

        # Only process actual text messages from agents
        if isinstance(message, TextMessage):
            debate_history.append({
                "agent": message.source,
                "content": message.content,
            })

            # Track the latest copy from the Generator
            if message.source == generator_name:
                final_copy = message.content

            # Check if Critic approved
            if message.source == critic_name and "APPROVED" in message.content:
                is_approved = True

    logger.info(
        f"Forge debate complete | "
        f"Turns: {len(debate_history)} | "
        f"Approved: {is_approved}"
    )

    return {
        "debate_history": debate_history,
        "final_copy": final_copy,
        "generator": generator_name,
        "critic": critic_name,
        "turns": len(debate_history),
        "is_approved": is_approved,
    }