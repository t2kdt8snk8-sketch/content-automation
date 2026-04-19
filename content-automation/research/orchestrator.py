from __future__ import annotations

from collections.abc import Callable

from core.models import ResearchGoal, ResearchRequest, ResearchResult
from core.research_pipeline import gather_research_data
from research.analyzers import deep_dive, discovery
from research.collectors.common import normalize_items
from research.processors.scoring import sort_opportunities


async def run_research(
    request: ResearchRequest,
    on_progress: Callable[[str], None] | None = None,
) -> ResearchResult:
    query = request.query
    if request.goal == ResearchGoal.DEEP_DIVE and request.seed_topics:
        query = request.seed_topics[0]

    focus = "trends" if request.goal == ResearchGoal.DISCOVER else "general"
    if on_progress:
        on_progress("리서치 신호 수집 준비 중")
    bundle = await gather_research_data(query, focus=focus, on_progress=on_progress)
    raw_items = []
    raw_items.extend(normalize_items("youtube", bundle.get("youtube", {})))
    raw_items.extend(normalize_items("newsapi", bundle.get("newsapi", {})))
    raw_items.extend(normalize_items("duckduckgo", bundle.get("duckduckgo", {})))
    raw_items.extend(normalize_items("pytrends", bundle.get("pytrends", {})))
    raw_items.extend(normalize_items("reddit", bundle.get("reddit", {})))

    if on_progress:
        on_progress("트렌드 기회 정리 중")
    if request.goal == ResearchGoal.DISCOVER:
        summary, opportunities = await discovery.analyze(query, raw_items)
    else:
        summary, opportunities = await deep_dive.analyze(query, raw_items)

    return ResearchResult(
        request=request,
        summary=summary,
        opportunities=sort_opportunities(opportunities)[:5],
        raw_items=raw_items,
    )
