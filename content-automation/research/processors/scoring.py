from __future__ import annotations

from core.models import ResearchItem, ResearchOpportunity


def heuristic_scores(topic: str, items: list[ResearchItem]) -> dict[str, int]:
    topic_l = topic.lower()
    matching = [
        item for item in items
        if topic_l in item.title.lower() or topic_l in item.snippet.lower()
    ]
    source_count = len({item.source for item in matching}) or 1
    frequency = len(matching)

    signal_strength = min(100, 35 + frequency * 8 + source_count * 12)
    freshness = min(100, 40 + source_count * 10 + min(frequency, 4) * 8)
    contentability = min(100, 50 + min(frequency, 5) * 7)
    platform_fit = 65 if any(item.source == "youtube" for item in matching) else 50
    searchability = 70 if any(item.source in {"duckduckgo", "pytrends"} for item in matching) else 45
    shareability = 75 if any(item.source == "youtube" for item in matching) else 50
    saturation = max(10, min(85, 20 + max(frequency - 1, 0) * 9))
    confidence = min(100, 30 + source_count * 18 + min(frequency, 4) * 9)

    return {
        "signal_strength": signal_strength,
        "freshness": freshness,
        "contentability": contentability,
        "platform_fit": platform_fit,
        "searchability": searchability,
        "shareability": shareability,
        "saturation": saturation,
        "confidence": confidence,
    }


def sort_opportunities(opportunities: list[ResearchOpportunity]) -> list[ResearchOpportunity]:
    return sorted(
        opportunities,
        key=lambda o: (
            -(o.searchability_score + o.shareability_score + o.platform_fit_score + o.confidence_score),
            o.saturation_score,
        ),
    )


def choose_formats(topic: str, items: list[ResearchItem], mode: str) -> list[str]:
    topic_l = topic.lower()
    matching = [
        item for item in items
        if topic_l in item.title.lower() or topic_l in item.snippet.lower()
    ]
    has_youtube = any(item.source == "youtube" for item in matching)
    has_search = any(item.source in {"duckduckgo", "pytrends"} for item in matching)
    has_news = any(item.source == "newsapi" for item in matching)

    formats: list[str] = []
    if has_youtube:
        formats.extend(["YouTube Shorts", "Instagram Reel"])
    if has_search:
        formats.append("Search-led carousel")
    if has_news:
        formats.append("Commentary post")
    if mode == "deep_dive":
        formats.append("Caption series")
    else:
        formats.append("Trend brief")
    return list(dict.fromkeys(formats))[:3]


def priority_reason(scores: dict[str, int]) -> str:
    if scores["shareability"] >= 72 and scores["saturation"] <= 45:
        return "공유 잠재력은 높은데 아직 과열되지 않았습니다."
    if scores["searchability"] >= 68 and scores["confidence"] >= 65:
        return "검색 수요와 확인 신호가 같이 보여 먼저 잡기 좋은 주제입니다."
    if scores["platform_fit"] >= 65:
        return "현재 수집된 신호가 콘텐츠 포맷과 잘 맞아 빠르게 테스트하기 좋습니다."
    return "약한 신호보다 분명히 앞서 있어 실험 우선순위가 있습니다."


def next_step(best_formats: list[str], mode: str) -> str:
    primary = best_formats[0] if best_formats else "콘텐츠 초안"
    if mode == "discover":
        return f"{primary} 1개를 먼저 테스트해서 반응 데이터를 확인하세요."
    return f"{primary}로 바로 제작하고, 같은 주제로 훅 2개를 추가 테스트하세요."
