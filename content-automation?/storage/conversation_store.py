from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import aiofiles

from config.settings import get_settings
from core.models import ConversationMessage, ConversationState

# 세션 만료 기준 (마지막 활동 기준)
_SESSION_TTL_HOURS = 24
# 메시지 이력 최대 보관 개수
_MAX_HISTORY = 20


def _store_dir() -> Path:
    settings = get_settings()
    p = Path(settings.outputs_dir) / "sessions"
    p.mkdir(parents=True, exist_ok=True)
    return p


def _session_path(chat_id: str) -> Path:
    safe = chat_id.replace("/", "_")
    return _store_dir() / f"{safe}.json"


async def load(chat_id: str) -> ConversationState:
    """저장된 세션을 불러온다. 없거나 만료됐으면 새 상태 반환."""
    path = _session_path(chat_id)
    if not path.exists():
        return ConversationState(chat_id=chat_id)

    try:
        async with aiofiles.open(path, encoding="utf-8") as f:
            raw = await f.read()
        data: dict[str, Any] = json.loads(raw)
        state = ConversationState.model_validate(data)

        # TTL 체크
        cutoff = datetime.utcnow() - timedelta(hours=_SESSION_TTL_HOURS)
        if state.updated_at < cutoff:
            return ConversationState(chat_id=chat_id)

        return state
    except Exception:
        return ConversationState(chat_id=chat_id)


async def save(state: ConversationState) -> None:
    """세션 상태를 파일에 저장한다."""
    state.updated_at = datetime.utcnow()
    # 이력이 너무 길면 최근 N개만 유지
    if len(state.history) > _MAX_HISTORY:
        state.history = state.history[-_MAX_HISTORY:]

    path = _session_path(state.chat_id)
    async with aiofiles.open(path, "w", encoding="utf-8") as f:
        await f.write(state.model_dump_json(indent=2))


async def append_message(chat_id: str, role: str, content: str) -> ConversationState:
    """메시지 한 개를 이력에 추가하고 저장된 상태를 반환한다."""
    state = await load(chat_id)
    state.history.append(ConversationMessage(role=role, content=content))
    await save(state)
    return state


async def set_mode(chat_id: str, mode: str) -> ConversationState:
    """세션 모드를 변경한다 ('chat' | 'work')."""
    from core.models import ConversationMode
    state = await load(chat_id)
    state.mode = ConversationMode(mode)
    await save(state)
    return state


async def update_params(chat_id: str, params: dict[str, Any]) -> ConversationState:
    """대화 중 확정된 파라미터를 누적 저장한다."""
    state = await load(chat_id)
    state.collected_params.update(params)
    await save(state)
    return state


def recent_history(state: ConversationState, n: int = 10) -> list[dict[str, str]]:
    """LLM messages 형식으로 최근 n개 이력 반환."""
    messages = state.history[-n:]
    return [{"role": m.role, "content": m.content} for m in messages]
