from __future__ import annotations

import asyncio
from collections.abc import Callable
from datetime import datetime
from typing import Any
from urllib.parse import quote_plus

import httpx
from loguru import logger

from config.settings import get_settings

_HTTP_TIMEOUT_S = 15.0
_MAX_RESULTS = 8


async def gather_research_data(
    query: str,
    focus: str = "general",
    on_progress: Callable[[str], None] | None = None,
) -> dict[str, Any]:
    """Collect research signals from multiple sources in parallel."""
    if on_progress:
        on_progress("YouTube 수집 중")
    tasks = {
        "duckduckgo": asyncio.create_task(_fetch_duckduckgo(query, focus)),
        "newsapi": asyncio.create_task(_fetch_newsapi(query)),
        "reddit": asyncio.create_task(_fetch_reddit(query)),
        "youtube": asyncio.create_task(_fetch_youtube(query)),
        "pytrends": asyncio.create_task(_fetch_pytrends(query)),
    }

    results: dict[str, Any] = {}
    for name, task in tasks.items():
        try:
            results[name] = await task
            if on_progress:
                stage_map = {
                    "youtube": "YouTube 수집 완료",
                    "newsapi": "뉴스 수집 완료",
                    "duckduckgo": "검색 결과 수집 완료",
                    "pytrends": "검색 상승 신호 수집 완료",
                    "reddit": "보조 소스 확인 완료",
                }
                on_progress(stage_map.get(name, f"{name} 수집 완료"))
        except Exception as exc:
            logger.warning(f"{name} research fetch failed: {exc}")
            results[name] = {"status": "error", "items": [], "error": str(exc)}
            if on_progress:
                fail_map = {
                    "youtube": "YouTube 수집 건너뜀",
                    "newsapi": "뉴스 수집 건너뜀",
                    "duckduckgo": "검색 결과 수집 건너뜀",
                    "pytrends": "검색 상승 신호 건너뜀",
                    "reddit": "보조 소스 건너뜀",
                }
                on_progress(fail_map.get(name, f"{name} 수집 건너뜀"))
    return results


def render_research_bundle(bundle: dict[str, Any]) -> str:
    """Render collected source data into a prompt-friendly text block."""
    blocks: list[str] = []
    for source_name, payload in bundle.items():
        status = payload.get("status", "ok")
        items = payload.get("items", [])
        lines = [f"## {source_name} ({status})"]
        if payload.get("note"):
            lines.append(f"Note: {payload['note']}")
        if not items:
            lines.append("No usable results.")
        else:
            for item in items[:_MAX_RESULTS]:
                title = item.get("title", "").strip()
                snippet = item.get("snippet", "").strip()
                url = item.get("url", "").strip()
                meta = item.get("meta", "").strip()
                line = f"- {title}"
                if snippet:
                    line += f": {snippet}"
                if meta:
                    line += f" ({meta})"
                if url:
                    line += f" [{url}]"
                lines.append(line)
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


async def _fetch_duckduckgo(query: str, focus: str) -> dict[str, Any]:
    return await asyncio.to_thread(_duckduckgo_sync, query, focus)


def _duckduckgo_sync(query: str, focus: str) -> dict[str, Any]:
    from duckduckgo_search import DDGS

    ddgs = DDGS()
    try:
        if focus in {"trends", "news"}:
            results = list(ddgs.news(query, max_results=_MAX_RESULTS))
        else:
            results = list(ddgs.text(query, max_results=_MAX_RESULTS))
    except Exception:
        results = list(ddgs.text(query, max_results=5))

    items = [
        {
            "title": r.get("title", ""),
            "snippet": r.get("body", r.get("excerpt", "")),
            "url": r.get("href", r.get("url", "")),
            "meta": r.get("date", ""),
        }
        for r in results
    ]
    return {"status": "ok", "items": items}


async def _fetch_newsapi(query: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.news_api_key:
        return {
            "status": "skipped",
            "items": [],
            "note": "NEWS_API_KEY not configured",
        }

    url = (
        "https://newsapi.org/v2/everything"
        f"?q={quote_plus(query)}&pageSize={_MAX_RESULTS}&sortBy=publishedAt&language=en"
    )
    headers = {"X-Api-Key": settings.news_api_key}
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_S) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()

    items = [
        {
            "title": article.get("title", ""),
            "snippet": article.get("description", ""),
            "url": article.get("url", ""),
            "meta": article.get("publishedAt", ""),
        }
        for article in data.get("articles", [])[:_MAX_RESULTS]
    ]
    return {"status": "ok", "items": items}


async def _fetch_reddit(query: str) -> dict[str, Any]:
    settings = get_settings()
    token = await _get_reddit_token(
        settings.reddit_client_id, settings.reddit_client_secret
    )
    headers = {"User-Agent": "content-automation/0.1"}
    url = (
        "https://www.reddit.com/search.json"
        f"?q={quote_plus(query)}&sort=top&t=week&limit={_MAX_RESULTS}"
    )

    if token:
        headers["Authorization"] = f"Bearer {token}"
        url = (
            "https://oauth.reddit.com/search"
            f"?q={quote_plus(query)}&sort=top&t=week&limit={_MAX_RESULTS}"
        )

    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_S) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()

    children = data.get("data", {}).get("children", [])
    items = []
    for child in children[:_MAX_RESULTS]:
        post = child.get("data", {})
        permalink = post.get("permalink", "")
        items.append(
            {
                "title": post.get("title", ""),
                "snippet": post.get("selftext", "")[:240],
                "url": f"https://reddit.com{permalink}" if permalink else "",
                "meta": f"r/{post.get('subreddit', '')} · score {post.get('score', 0)}",
            }
        )

    note = None if token else "Using public Reddit search"
    return {"status": "ok", "items": items, "note": note}


async def _get_reddit_token(
    client_id: str | None, client_secret: str | None
) -> str | None:
    if not client_id or not client_secret:
        return None

    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_S) as client:
        response = await client.post(
            "https://www.reddit.com/api/v1/access_token",
            auth=(client_id, client_secret),
            data={"grant_type": "client_credentials"},
            headers={"User-Agent": "content-automation/0.1"},
        )
        response.raise_for_status()
        data = response.json()
        return data.get("access_token")


async def _fetch_youtube(query: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.youtube_data_api_key:
        return {
            "status": "skipped",
            "items": [],
            "note": "YOUTUBE_DATA_API_KEY not configured",
        }

    url = (
        "https://www.googleapis.com/youtube/v3/search"
        f"?part=snippet&type=video&order=date&maxResults={_MAX_RESULTS}"
        f"&q={quote_plus(query)}&key={settings.youtube_data_api_key}"
    )
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_S) as client:
        response = await client.get(url)
        response.raise_for_status()
        data = response.json()

    items = []
    for item in data.get("items", [])[:_MAX_RESULTS]:
        snippet = item.get("snippet", {})
        video_id = item.get("id", {}).get("videoId", "")
        items.append(
            {
                "title": snippet.get("title", ""),
                "snippet": snippet.get("description", ""),
                "url": f"https://www.youtube.com/watch?v={video_id}" if video_id else "",
                "meta": snippet.get("publishedAt", ""),
            }
        )
    return {"status": "ok", "items": items}


async def _fetch_pytrends(query: str) -> dict[str, Any]:
    try:
        return await asyncio.to_thread(_pytrends_sync, query)
    except Exception as exc:
        logger.info(f"Pytrends skipped for '{query}': {exc}")
        return {"status": "skipped", "items": [], "note": "Pytrends unavailable"}


def _pytrends_sync(query: str) -> dict[str, Any]:
    from pytrends.request import TrendReq

    pytrends = TrendReq(hl="en-US", tz=0)
    pytrends.build_payload([query], timeframe="today 3-m")
    related = pytrends.related_queries().get(query, {})
    rising = related.get("rising")

    items: list[dict[str, str]] = []
    if rising is not None:
        for _, row in rising.head(_MAX_RESULTS).iterrows():
            items.append(
                {
                    "title": str(row.get("query", "")),
                    "snippet": "Google Trends rising query",
                    "url": "",
                    "meta": f"value {row.get('value', '')}",
                }
            )

    return {"status": "ok", "items": items}


def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
