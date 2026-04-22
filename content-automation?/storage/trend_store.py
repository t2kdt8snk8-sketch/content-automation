from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import aiofiles

from config.settings import get_settings
from core.models import TrendScan


def _trend_dir() -> Path:
    settings = get_settings()
    path = Path(settings.outputs_dir) / "trends"
    path.mkdir(parents=True, exist_ok=True)
    return path


async def save_scan(scan: TrendScan) -> Path:
    trend_dir = _trend_dir()
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    payload = scan.model_dump(mode="json")

    latest_path = trend_dir / "latest.json"
    history_path = trend_dir / f"{ts}.json"

    async with aiofiles.open(latest_path, "w", encoding="utf-8") as f:
        await f.write(json.dumps(payload, ensure_ascii=False, indent=2))

    async with aiofiles.open(history_path, "w", encoding="utf-8") as f:
        await f.write(json.dumps(payload, ensure_ascii=False, indent=2))

    return latest_path


async def load_latest_scan() -> TrendScan | None:
    latest_path = _trend_dir() / "latest.json"
    if not latest_path.exists():
        return None

    async with aiofiles.open(latest_path, encoding="utf-8") as f:
        raw = await f.read()
    return TrendScan.model_validate_json(raw)
