"""Tests for storage/feedback_store.py"""
from __future__ import annotations

import json
import pytest
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from storage.feedback_store import save_feedback, load_feedback, load_combined_feedback, format_for_prompt


@pytest.fixture(autouse=True)
def clean_feedback_file(tmp_path, monkeypatch):
    """Redirect feedback JSON to a temp file for each test."""
    import storage.feedback_store as fs
    monkeypatch.setattr(fs, "_FEEDBACK_PATH", tmp_path / "feedback.json")
    yield


@pytest.mark.asyncio
async def test_save_and_load_card_feedback():
    await save_feedback("card_abc", "copy_agent", "이모지 너무 많음")
    result = await load_feedback("card_abc")
    assert len(result) == 1
    assert result[0]["agent"] == "copy_agent"
    assert result[0]["feedback"] == "이모지 너무 많음"


@pytest.mark.asyncio
async def test_save_and_load_global_feedback():
    await save_feedback(None, "copy_agent", "항상 이모지 금지")
    result = await load_feedback(None)
    assert len(result) == 1
    assert result[0]["feedback"] == "항상 이모지 금지"


@pytest.mark.asyncio
async def test_load_combined_feedback():
    await save_feedback(None, "copy_agent", "항상 이모지 금지")
    await save_feedback("card_abc", "copy_agent", "타겟을 20대 여성으로")
    combined = await load_combined_feedback("card_abc")
    feedbacks = [f["feedback"] for f in combined]
    assert "항상 이모지 금지" in feedbacks
    assert "타겟을 20대 여성으로" in feedbacks


@pytest.mark.asyncio
async def test_load_combined_feedback_empty():
    combined = await load_combined_feedback("card_xyz")
    assert combined == []


@pytest.mark.asyncio
async def test_format_for_prompt_empty():
    result = await format_for_prompt(None)
    assert result == ""


@pytest.mark.asyncio
async def test_format_for_prompt_with_feedback():
    await save_feedback(None, "copy_agent", "항상 이모지 금지")
    await save_feedback("card_abc", "strategy_agent", "타겟을 20대 여성으로")
    result = await format_for_prompt("card_abc")
    assert "항상 이모지 금지" in result
    assert "타겟을 20대 여성으로" in result
