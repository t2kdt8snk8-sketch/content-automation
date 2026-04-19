"""Async JSON-based feedback memory store.

Stores two kinds of feedback:
- global: applies to all runs (key "global")
- card-specific: applies to a specific card (key = card_id)

JSON structure:
{
    "global": [{"agent": "...", "feedback": "...", "timestamp": "..."}],
    "card_id_abc": [...]
}
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiofiles

_FEEDBACK_PATH = Path("storage/feedback.json")

_GLOBAL_KEY = "global"


async def _load_raw() -> dict[str, list[dict[str, Any]]]:
    if not _FEEDBACK_PATH.exists():
        return {}
    async with aiofiles.open(_FEEDBACK_PATH, "r", encoding="utf-8") as f:
        content = await f.read()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return {}


async def _save_raw(data: dict[str, list[dict[str, Any]]]) -> None:
    _FEEDBACK_PATH.parent.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(_FEEDBACK_PATH, "w", encoding="utf-8") as f:
        await f.write(json.dumps(data, ensure_ascii=False, indent=2))


async def save_feedback(card_id: str | None, agent: str, feedback: str) -> None:
    """Append a feedback entry. card_id=None saves to global."""
    key = card_id if card_id else _GLOBAL_KEY
    data = await _load_raw()
    data.setdefault(key, [])
    data[key].append({
        "agent": agent,
        "feedback": feedback,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    await _save_raw(data)


async def load_feedback(card_id: str | None) -> list[dict[str, Any]]:
    """Load feedback for a specific card or global."""
    key = card_id if card_id else _GLOBAL_KEY
    data = await _load_raw()
    return data.get(key, [])


async def load_combined_feedback(card_id: str) -> list[dict[str, Any]]:
    """Load global + card-specific feedback combined."""
    data = await _load_raw()
    global_entries = data.get(_GLOBAL_KEY, [])
    card_entries = data.get(card_id, [])
    return global_entries + card_entries


async def format_for_prompt(card_id: str | None) -> str:
    """Return a formatted string for injection into system prompts.

    Returns empty string if there is no feedback to inject.
    """
    if card_id:
        entries = await load_combined_feedback(card_id)
    else:
        entries = await load_feedback(None)

    if not entries:
        return ""

    lines = ["## CD 이전 피드백 (참고용)"]
    for entry in entries:
        lines.append(f"- [{entry['agent']}] {entry['feedback']}")
    return "\n".join(lines)
