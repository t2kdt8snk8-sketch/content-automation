from __future__ import annotations

from core.llm_client import call_sonnet
from core.models import ResearchItem, ResearchOpportunity
from prompts import load_prompt
from research.processors.normalize import extract_topic_candidates
from research.processors.scoring import (
    choose_formats,
    heuristic_scores,
    next_step,
    priority_reason,
)


async def analyze(query: str, items: list[ResearchItem]) -> tuple[str, list[ResearchOpportunity]]:
    candidates = extract_topic_candidates(items)
    opportunities: list[ResearchOpportunity] = []
    for candidate in candidates[:8]:
        scores = heuristic_scores(candidate, items)
        evidence = [
            f"{item.source}: {item.title}"
            for item in items
            if candidate.lower() in item.title.lower() or candidate.lower() in item.snippet.lower()
        ][:3]
        opportunities.append(
            ResearchOpportunity(
                title=candidate.title(),
                topic=candidate,
                why_now=_why_now(candidate, evidence),
                evidence=evidence,
                best_formats=choose_formats(candidate, items, mode="discover"),
                priority_reason=priority_reason(scores),
                recommended_next_step=next_step(
                    choose_formats(candidate, items, mode="discover"),
                    mode="discover",
                ),
                searchability_score=scores["searchability"],
                shareability_score=scores["shareability"],
                saturation_score=scores["saturation"],
                platform_fit_score=scores["platform_fit"],
                confidence_score=scores["confidence"],
                suggested_hooks=[
                    f"Why {candidate} is suddenly everywhere",
                    f"The real shift behind {candidate}",
                ],
            )
        )

    summary = await call_sonnet(
        system=load_prompt("research_agent"),
        messages=[
            {
                "role": "user",
                "content": (
                    f"Research goal: discover opportunities\n"
                    f"User query: {query}\n\n"
                    f"Topic candidates: {', '.join(candidates[:10])}\n\n"
                    f"Summarize the strongest emerging areas and why they matter for a marketing team."
                ),
            }
        ],
    )
    return summary, opportunities[:5]


def _why_now(candidate: str, evidence: list[str]) -> str:
    if evidence:
        return f"{candidate} 관련 신호가 여러 소스에서 반복되고 있어 지금 실험 가치가 있습니다."
    return f"{candidate}가 막 형성되는 흐름으로 보여 빠르게 선점할 수 있습니다."
