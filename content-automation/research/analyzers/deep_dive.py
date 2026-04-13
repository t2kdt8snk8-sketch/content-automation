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


async def analyze(seed_topic: str, items: list[ResearchItem]) -> tuple[str, list[ResearchOpportunity]]:
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
                title=f"{seed_topic} / {candidate}".title(),
                topic=candidate,
                why_now=_why_now(seed_topic, candidate, evidence),
                evidence=evidence,
                best_formats=choose_formats(candidate, items, mode="deep_dive"),
                priority_reason=priority_reason(scores),
                recommended_next_step=next_step(
                    choose_formats(candidate, items, mode="deep_dive"),
                    mode="deep_dive",
                ),
                searchability_score=scores["searchability"],
                shareability_score=scores["shareability"],
                saturation_score=scores["saturation"],
                platform_fit_score=scores["platform_fit"],
                confidence_score=scores["confidence"],
                suggested_hooks=[
                    f"What people are missing about {candidate}",
                    f"The easiest entry point into {candidate}",
                ],
            )
        )

    summary = await call_sonnet(
        system=load_prompt("research_agent"),
        messages=[
            {
                "role": "user",
                "content": (
                    f"Research goal: analyze a seed topic\n"
                    f"Seed topic: {seed_topic}\n\n"
                    f"Candidate subtopics: {', '.join(candidates[:10])}\n\n"
                    f"Explain what angles look promising now, which ones are more searchable vs shareable, "
                    f"and how a content team should act on them."
                ),
            }
        ],
    )
    return summary, opportunities[:5]


def _why_now(seed_topic: str, candidate: str, evidence: list[str]) -> str:
    if evidence:
        return f"{seed_topic} 안에서 {candidate} 관련 서브토픽이 반복적으로 보이고 있어 지금 꺼내기 좋은 각도입니다."
    return f"{seed_topic} 안에서 {candidate}가 새 훅으로 발전할 가능성이 있습니다."
