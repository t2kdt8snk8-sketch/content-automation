from __future__ import annotations

import time
from typing import Any

from core.llm_client import call_haiku
from core.models import AgentName, AgentResult, TaskRequest
from prompts import load_prompt


async def run(request: TaskRequest, tool_input: dict[str, Any]) -> AgentResult:
    """Format all collected content into clean markdown or JSON (uses Haiku for speed/cost)."""
    t0 = time.monotonic()
    output_format = tool_input.get("output_format", "markdown")
    content = tool_input["content_to_format"]
    summary = tool_input.get("task_summary", "Content automation result")

    prompt = (
        f"Format the following content as clean {output_format}.\n"
        f"Task summary: {summary}\n\n"
        f"Content:\n{content}"
    )

    try:
        formatted = await call_haiku(
            system=load_prompt("format_agent"),
            messages=[{"role": "user", "content": prompt}],
        )
    except Exception as e:
        # Fallback: return unformatted content rather than failing silently
        return AgentResult(
            agent_name=AgentName.FORMAT,
            success=True,
            content=content,
            error=f"Formatting failed, returning raw: {e}",
            duration_ms=(time.monotonic() - t0) * 1000,
        )

    return AgentResult(
        agent_name=AgentName.FORMAT,
        success=True,
        content=formatted,
        duration_ms=(time.monotonic() - t0) * 1000,
    )
