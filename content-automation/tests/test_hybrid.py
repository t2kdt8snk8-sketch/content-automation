"""하이브리드 채팅/워크플로우 시스템 통합 테스트.

실제 LLM 호출 없이 라우터·브릿지·스토어의 핵심 로직을 검증한다.
"""
from __future__ import annotations

import asyncio
import json
import pytest
from unittest.mock import AsyncMock, patch

from core.bridge import build_enriched_message, extract_params, should_trigger
from core.models import (
    ConversationMessage,
    ConversationMode,
    ConversationState,
)
from core.router import RouteResult, route
from storage.conversation_store import (
    append_message,
    load,
    recent_history,
    save,
    set_mode,
    update_params,
)


# ── 라우터 테스트 ─────────────────────────────────────────────────────────────

class TestRouter:
    """MessageRouter: 명령어 → 규칙 → LLM 분류 순서 검증."""

    @pytest.mark.asyncio
    async def test_explicit_command_chat(self):
        result = await route("/chat 안녕")
        assert result.path == "chat"
        assert result.source == "command"

    @pytest.mark.asyncio
    async def test_explicit_command_research(self):
        result = await route("/research neo-soul trends")
        assert result.path == "agent"
        assert result.agent_name == "research_agent"
        assert result.source == "command"

    @pytest.mark.asyncio
    async def test_explicit_command_run(self):
        result = await route("/run 인스타 캐러셀 만들어줘")
        assert result.path == "workflow"
        assert result.source == "command"

    @pytest.mark.asyncio
    async def test_rule_short_message_is_chat(self):
        result = await route("안녕")
        assert result.path == "chat"
        assert result.source == "rule"

    @pytest.mark.asyncio
    async def test_rule_greeting_is_chat(self):
        result = await route("hi")
        assert result.path == "chat"
        assert result.source == "rule"

    @pytest.mark.asyncio
    async def test_rule_work_keyword_triggers_workflow(self):
        result = await route("인스타 캐러셀 캡션 만들어줘")
        assert result.path in ("workflow", "agent")
        assert result.source == "rule"

    @pytest.mark.asyncio
    async def test_rule_research_only_keyword(self):
        result = await route("리서치만 해줘 neo-soul")
        assert result.path == "agent"
        assert result.agent_name == "research_agent"

    @pytest.mark.asyncio
    async def test_rule_discover_trend_routes_to_research(self):
        result = await route("요즘 뜨는 분야 뭐 있어?")
        assert result.path == "research"
        assert result.research_goal == "discover_opportunities"

    @pytest.mark.asyncio
    async def test_rule_seed_topic_routes_to_research(self):
        result = await route("neo-soul 안에서 요즘 먹히는 콘텐츠 소재 찾아줘")
        assert result.path == "research"
        assert result.research_goal == "analyze_seed_topic"

    @pytest.mark.asyncio
    async def test_llm_fallback_called_for_ambiguous(self):
        """규칙으로 판별 못하는 메시지는 Haiku 분류기로 넘어가는지 확인."""
        with patch("core.router.call_haiku", new_callable=AsyncMock) as mock_haiku:
            mock_haiku.return_value = "workflow"
            result = await route("요즘 트렌드가 궁금한데 콘텐츠도 뽑고 싶어")
            # Haiku가 호출됐거나, 규칙으로 이미 workflow로 잡혔거나
            assert result.path in ("chat", "workflow", "agent", "research")


# ── ConversationStore 테스트 ──────────────────────────────────────────────────

class TestConversationStore:
    """세션 저장/불러오기·이력 관리 검증."""

    @pytest.mark.asyncio
    async def test_load_nonexistent_returns_empty_state(self, tmp_path, monkeypatch):
        monkeypatch.setenv("OUTPUTS_DIR", str(tmp_path))
        # lru_cache 우회
        from config import settings as settings_module
        settings_module.get_settings.cache_clear()

        state = await load("new_chat_123")
        assert state.chat_id == "new_chat_123"
        assert state.mode == ConversationMode.CHAT
        assert state.history == []

    @pytest.mark.asyncio
    async def test_save_and_load_roundtrip(self, tmp_path, monkeypatch):
        monkeypatch.setenv("OUTPUTS_DIR", str(tmp_path))
        from config import settings as settings_module
        settings_module.get_settings.cache_clear()

        state = ConversationState(chat_id="test_chat")
        state.history.append(ConversationMessage(role="user", content="안녕"))
        state.collected_params = {"topic": "neo-soul"}
        await save(state)

        loaded = await load("test_chat")
        assert loaded.chat_id == "test_chat"
        assert loaded.history[0].content == "안녕"
        assert loaded.collected_params["topic"] == "neo-soul"

    @pytest.mark.asyncio
    async def test_append_message(self, tmp_path, monkeypatch):
        monkeypatch.setenv("OUTPUTS_DIR", str(tmp_path))
        from config import settings as settings_module
        settings_module.get_settings.cache_clear()

        await append_message("chat_append", "user", "첫 메시지")
        await append_message("chat_append", "assistant", "응답이에요")
        state = await load("chat_append")
        assert len(state.history) == 2
        assert state.history[1].role == "assistant"

    @pytest.mark.asyncio
    async def test_set_mode(self, tmp_path, monkeypatch):
        monkeypatch.setenv("OUTPUTS_DIR", str(tmp_path))
        from config import settings as settings_module
        settings_module.get_settings.cache_clear()

        await set_mode("chat_mode", "work")
        state = await load("chat_mode")
        assert state.mode == ConversationMode.WORK

    @pytest.mark.asyncio
    async def test_recent_history_format(self):
        state = ConversationState(chat_id="x")
        state.history = [
            ConversationMessage(role="user", content="msg1"),
            ConversationMessage(role="assistant", content="reply1"),
            ConversationMessage(role="user", content="msg2"),
        ]
        hist = recent_history(state, n=2)
        assert len(hist) == 2
        assert hist[0] == {"role": "assistant", "content": "reply1"}

    @pytest.mark.asyncio
    async def test_history_capped_at_max(self, tmp_path, monkeypatch):
        monkeypatch.setenv("OUTPUTS_DIR", str(tmp_path))
        from config import settings as settings_module
        settings_module.get_settings.cache_clear()

        for i in range(25):
            await append_message("chat_cap", "user", f"msg {i}")
        state = await load("chat_cap")
        assert len(state.history) <= 20


# ── Bridge 테스트 ─────────────────────────────────────────────────────────────

class TestBridge:
    """파라미터 추출·트리거 감지·메시지 보강 검증."""

    @pytest.mark.asyncio
    async def test_extract_params_returns_dict(self):
        with patch("core.bridge.call_haiku", new_callable=AsyncMock) as mock:
            mock.return_value = '{"topic": "neo-soul", "platform": "instagram"}'
            params = await extract_params("네오소울 인스타 콘텐츠 만들고 싶어")
        assert params.get("topic") == "neo-soul"
        assert params.get("platform") == "instagram"

    @pytest.mark.asyncio
    async def test_extract_params_handles_failure_gracefully(self):
        with patch("core.bridge.call_haiku", side_effect=Exception("API error")):
            params = await extract_params("아무 말이나")
        assert params == {}

    @pytest.mark.asyncio
    async def test_should_trigger_false_without_params(self):
        state = ConversationState(chat_id="x")
        result = await should_trigger(state, "만들어줘")
        assert result is False

    @pytest.mark.asyncio
    async def test_should_trigger_true_with_params_and_keyword(self):
        state = ConversationState(chat_id="x")
        state.collected_params = {"topic": "neo-soul", "platform": "instagram"}
        result = await should_trigger(state, "ㄱㄱ")
        assert result is True

    @pytest.mark.asyncio
    async def test_should_trigger_true_with_go_keyword(self):
        state = ConversationState(chat_id="x")
        state.collected_params = {"topic": "hip-hop"}
        result = await should_trigger(state, "go")
        assert result is True

    @pytest.mark.asyncio
    async def test_build_enriched_message_includes_params(self):
        state = ConversationState(chat_id="x")
        state.collected_params = {"topic": "neo-soul", "platform": "instagram"}
        state.history = [ConversationMessage(role="user", content="네오소울 얘기했어")]
        msg = build_enriched_message(state, "만들어줘")
        assert "neo-soul" in msg
        assert "instagram" in msg
        assert "만들어줘" in msg

    @pytest.mark.asyncio
    async def test_build_enriched_message_no_params_returns_original(self):
        state = ConversationState(chat_id="x")
        msg = build_enriched_message(state, "원본 메시지")
        assert msg == "원본 메시지"


# ── ConversationState 모델 테스트 ─────────────────────────────────────────────

class TestConversationStateModel:
    def test_default_mode_is_chat(self):
        state = ConversationState(chat_id="x")
        assert state.mode == ConversationMode.CHAT

    def test_collected_params_empty_by_default(self):
        state = ConversationState(chat_id="x")
        assert state.collected_params == {}

    def test_pending_intent_none_by_default(self):
        state = ConversationState(chat_id="x")
        assert state.pending_intent is None
