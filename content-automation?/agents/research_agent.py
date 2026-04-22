from __future__ import annotations

import time
from typing import Any

from core.llm_client import call_sonnet
from core.models import AgentName, AgentResult, TaskRequest
from core.research_pipeline import gather_research_data, render_research_bundle
from prompts import load_prompt


async def run(request: TaskRequest, tool_input: dict[str, Any]) -> AgentResult:
    """Web search + trend analysis using DuckDuckGo, summarized by Sonnet."""
    t0 = time.monotonic()
    query = tool_input["query"]
    focus = tool_input.get("focus", "general")

    bundle = await gather_research_data(query, focus)
    raw_results = render_research_bundle(bundle)

    try:
        synthesis = await call_sonnet(
            system=load_prompt("research_agent"),
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Research query: {query}\n"
                        f"Focus: {focus}\n\n"
                        f"Search results:\n{raw_results}"
                    ),
                }
            ],
        )
    except Exception as e:
        return AgentResult(
            agent_name=AgentName.RESEARCH,
            success=False,
            content="",
            error=str(e),
            duration_ms=(time.monotonic() - t0) * 1000,
        )

    return AgentResult(
        agent_name=AgentName.RESEARCH,
        success=True,
        content=synthesis,
        duration_ms=(time.monotonic() - t0) * 1000,
    )
