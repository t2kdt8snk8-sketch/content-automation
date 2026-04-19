from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import aiofiles

from config.settings import get_settings
from core.models import ResearchGoal, ResearchResult


def _research_dir() -> Path:
    base = Path(get_settings().outputs_dir) / "research"
    base.mkdir(parents=True, exist_ok=True)
    return base


def _goal_dir(goal: ResearchGoal) -> Path:
    path = _research_dir() / ("discovery" if goal == ResearchGoal.DISCOVER else "deep_dive")
    path.mkdir(parents=True, exist_ok=True)
    return path


async def save_research_result(result: ResearchResult) -> Path:
    goal_dir = _goal_dir(result.request.goal)
    history_dir = goal_dir / "history"
    history_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    payload = result.model_dump(mode="json")

    latest_path = goal_dir / "latest.json"
    history_path = history_dir / f"{ts}_{result.request.request_id[:8]}.json"

    async with aiofiles.open(latest_path, "w", encoding="utf-8") as f:
        await f.write(json.dumps(payload, ensure_ascii=False, indent=2))
    async with aiofiles.open(history_path, "w", encoding="utf-8") as f:
        await f.write(json.dumps(payload, ensure_ascii=False, indent=2))
    return history_path


async def list_research_results(limit: int = 20) -> list[dict]:
    base = _research_dir()
    rows: list[dict] = []
    for history_dir in base.glob("*/history"):
        for path in sorted(history_dir.glob("*.json"), reverse=True):
            try:
                async with aiofiles.open(path, encoding="utf-8") as f:
                    payload = json.loads(await f.read())
                rows.append(
                    {
                        "id": path.stem,
                        "path": str(path),
                        "goal": payload["request"]["goal"],
                        "query": payload["request"]["query"],
                        "created_at": payload.get("created_at"),
                        "summary": payload.get("summary", ""),
                        "opportunities": payload.get("opportunities", [])[:3],
                    }
                )
            except Exception:
                continue
    rows.sort(key=lambda row: row.get("created_at") or "", reverse=True)
    return rows[:limit]


async def get_research_result(file_id: str) -> dict | None:
    """파일 stem(id)으로 리서치 결과 단건 조회."""
    base = _research_dir()
    for history_dir in base.glob("*/history"):
        target = history_dir / f"{file_id}.json"
        if target.exists():
            try:
                async with aiofiles.open(target, encoding="utf-8") as f:
                    payload = json.loads(await f.read())
                return {
                    "id": target.stem,
                    "goal": payload["request"]["goal"],
                    "query": payload["request"]["query"],
                    "created_at": payload.get("created_at"),
                    "summary": payload.get("summary", ""),
                    "raw_items": [
                        {
                            "source": item.get("source", ""),
                            "title": item.get("title", ""),
                            "snippet": item.get("snippet", ""),
                            "url": item.get("url", ""),
                            "published_at": item.get("published_at"),
                        }
                        for item in payload.get("raw_items", [])
                    ],
                }
            except Exception:
                return None
    return None


async def delete_research_result(file_id: str) -> bool:
    """주어진 파일 stem(id)에 해당하는 히스토리 파일을 삭제합니다."""
    base = _research_dir()
    for history_dir in base.glob("*/history"):
        target = history_dir / f"{file_id}.json"
        if target.exists():
            target.unlink()
            return True
    return False


async def delete_all_research_results() -> int:
    """히스토리 파일 전체를 삭제하고, 삭제된 파일 수를 반환합니다."""
    base = _research_dir()
    count = 0
    for history_dir in base.glob("*/history"):
        for path in history_dir.glob("*.json"):
            path.unlink()
            count += 1
    return count
