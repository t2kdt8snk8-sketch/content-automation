from __future__ import annotations

from core.models import ResearchItem
from core.research_pipeline import gather_research_data
from .common import normalize_items


async def collect(query: str) -> list[ResearchItem]:
    bundle = await gather_research_data(query, focus="trends")
    return normalize_items("youtube", bundle.get("youtube", {}))
