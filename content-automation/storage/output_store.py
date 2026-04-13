from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import aiofiles

from config.settings import get_settings
from core.models import WorkflowRun


async def save_result(run: WorkflowRun) -> Path:
    """Persist a completed workflow run as a timestamped JSON file.

    Returns the path of the written file.
    """
    settings = get_settings()
    outputs_dir = Path(settings.outputs_dir)
    outputs_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    short_id = run.task_id[:8]
    filepath = outputs_dir / f"{ts}_{short_id}.json"

    payload = {
        "task_id": run.task_id,
        "created_at": ts,
        "user_message": run.request.user_message,
        "final_output": run.final_output,
        "status": run.status,
        "total_tokens": run.total_tokens,
        "agent_results": [
            {
                "agent": r.agent_name,
                "success": r.success,
                "content": r.content,
                "error": r.error,
                "tokens_used": r.tokens_used,
                "duration_ms": round(r.duration_ms, 1),
            }
            for r in run.agent_results
        ],
    }

    async with aiofiles.open(filepath, "w", encoding="utf-8") as f:
        await f.write(json.dumps(payload, ensure_ascii=False, indent=2))

    return filepath


async def list_results(limit: int = 20) -> list[dict]:
    settings = get_settings()
    outputs_dir = Path(settings.outputs_dir)
    if not outputs_dir.exists():
        return []

    rows: list[dict] = []
    for path in sorted(outputs_dir.glob("*.json"), reverse=True):
        try:
            async with aiofiles.open(path, encoding="utf-8") as f:
                payload = json.loads(await f.read())
            rows.append(
                {
                    "path": str(path),
                    "task_id": payload.get("task_id"),
                    "created_at": payload.get("created_at"),
                    "user_message": payload.get("user_message"),
                    "final_output": payload.get("final_output"),
                    "status": payload.get("status"),
                }
            )
        except Exception:
            continue
    return rows[:limit]
