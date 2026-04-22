from __future__ import annotations

from core.models import ResearchItem


def normalize_items(source: str, payload: dict) -> list[ResearchItem]:
    items: list[ResearchItem] = []
    for entry in payload.get("items", []):
        items.append(
            ResearchItem(
                source=source,
                title=str(entry.get("title", "")),
                snippet=str(entry.get("snippet", "")),
                url=str(entry.get("url", "")),
                published_at=entry.get("meta") or entry.get("published_at"),
                author_or_channel=entry.get("author_or_channel"),
                metadata={
                    k: v
                    for k, v in entry.items()
                    if k not in {"title", "snippet", "url", "meta", "published_at", "author_or_channel"}
                },
            )
        )
    return items
