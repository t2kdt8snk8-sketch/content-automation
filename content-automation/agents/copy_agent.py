from __future__ import annotations

import time
from typing import Any

from core.llm_client import call_sonnet
from core.models import AgentName, AgentResult, TaskRequest
from prompts import load_prompt


async def run(request: TaskRequest, tool_input: dict[str, Any]) -> AgentResult:
    """Korean/English copywriting for social media content."""
    t0 = time.monotonic()
    content_type = tool_input["content_type"]
    topic = tool_input["topic"]
    language = tool_input.get("language", "both")
    context = tool_input.get("context", "")
    tone = tool_input.get("tone", "casual")

    prompt_parts = [
        f"Write {content_type.replace('_', ' ')} content about: {topic}",
        f"Tone: {tone}",
        f"Language: {language}",
    ]
    if context:
        prompt_parts.append(f"\nResearch context to incorporate:\n{context}")

    try:
        content = await call_sonnet(
            system=load_prompt("copy_agent"),
            messages=[{"role": "user", "content": "\n".join(prompt_parts)}],
        )
    except Exception as e:
        return AgentResult(
            agent_name=AgentName.COPY,
            success=False,
            content="",
            error=str(e),
            duration_ms=(time.monotonic() - t0) * 1000,
        )

    return AgentResult(
        agent_name=AgentName.COPY,
        success=True,
        content=content,
        duration_ms=(time.monotonic() - t0) * 1000,
    )
