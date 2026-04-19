from __future__ import annotations

import re

from core.models import ResearchItem

_STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "from",
    "this",
    "that",
    "into",
    "about",
    "your",
    "what",
    "when",
    "how",
    "trend",
    "trends",
    "2025",
    "2026",
}


def extract_topic_candidates(items: list[ResearchItem]) -> list[str]:
    counts: dict[str, int] = {}
    for item in items:
        text = f"{item.title} {item.snippet}".lower()
        words = re.findall(r"[a-z0-9가-힣][a-z0-9\-\+가-힣]{1,}", text)
        phrases = _make_phrases(words)
        for phrase in phrases:
            if phrase in _STOPWORDS or len(phrase) < 4:
                continue
            counts[phrase] = counts.get(phrase, 0) + 1
    ranked = sorted(counts.items(), key=lambda x: (-x[1], x[0]))
    return [phrase for phrase, _ in ranked[:20]]


def _make_phrases(words: list[str]) -> list[str]:
    phrases: list[str] = []
    filtered = [w for w in words if w not in _STOPWORDS]
    for word in filtered:
        phrases.append(word)
    for i in range(len(filtered) - 1):
        phrases.append(f"{filtered[i]} {filtered[i + 1]}")
    return phrases
