from __future__ import annotations

import json
import time
from typing import Any

from core.llm_client import call_sonnet
from core.models import AgentName, AgentResult, TaskRequest, TrendOpportunity, TrendScan
from core.research_pipeline import gather_research_data, now_iso, render_research_bundle
from prompts import load_prompt


async def run(request: TaskRequest, tool_input: dict[str, Any]) -> AgentResult:
    t0 = time.monotonic()
    categories = tool_input.get("categories") or []
    limit = int(tool_input.get("limit", 5))

    try:
        scan = await scan_categories(categories=categories, limit=limit)
    except Exception as exc:
        return AgentResult(
            agent_name=AgentName.SCANNER,
            success=False,
            content="",
            error=str(exc),
            duration_ms=(time.monotonic() - t0) * 1000,
        )

    return AgentResult(
        agent_name=AgentName.SCANNER,
        success=True,
        content=scan.model_dump_json(indent=2, ensure_ascii=False),
        duration_ms=(time.monotonic() - t0) * 1000,
    )


async def scan_categories(categories: list[str], limit: int = 5) -> TrendScan:
    categories = [c.strip() for c in categories if c.strip()]
    if not categories:
        return TrendScan(opportunities=[])

    category_reports: list[str] = []
    for category in categories:
        bundle = await gather_research_data(f"{category} trend", focus="trends")
        category_reports.append(
            f"# Category: {category}\n{render_research_bundle(bundle)}"
        )

    system = load_prompt("scanner_agent")
    raw = await call_sonnet(
        system=system,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Generate exactly {limit} opportunities.\n"
                    f"Generated at: {now_iso()}\n\n"
                    f"{'\n\n'.join(category_reports)}"
                ),
            }
        ],
    )

    payload = json.loads(_extract_json(raw))
    opportunities = [
        TrendOpportunity.model_validate(item)
        for item in payload.get("opportunities", [])[:limit]
    ]
    generated_at = payload.get("generated_at")
    if generated_at:
        return TrendScan.model_validate(
            {"generated_at": generated_at, "opportunities": opportunities}
        )
    return TrendScan(opportunities=opportunities)


def _extract_json(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        parts = text.split("```")
        if len(parts) >= 3:
            text = parts[1]
            if text.startswith("json"):
                text = text[4:]
    return text.strip()
