from __future__ import annotations

import pytest

from core.models import TrendOpportunity, TrendScan
from prompts.loader import load_prompt
from storage.trend_store import load_latest_scan, save_scan


def test_load_prompt_includes_skill_notes():
    prompt = load_prompt("copy_agent")
    assert "Reference skill notes" in prompt
    assert "social-content" in prompt or "content-humanizer" in prompt


@pytest.mark.asyncio
async def test_trend_store_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setenv("OUTPUTS_DIR", str(tmp_path))
    from config import settings as settings_module

    settings_module.get_settings.cache_clear()

    scan = TrendScan(
        opportunities=[
            TrendOpportunity(
                topic="Neo-soul resurgence",
                category="neo-soul",
                why_now="Artist momentum is climbing across multiple channels.",
                evidence=["YouTube uploads accelerating", "Reddit discussion rising"],
                recommended_format="Instagram carousel",
                demand_score=78,
                saturation_score=42,
                opportunity_score=84,
            )
        ]
    )

    await save_scan(scan)
    loaded = await load_latest_scan()
    assert loaded is not None
    assert loaded.opportunities[0].topic == "Neo-soul resurgence"
