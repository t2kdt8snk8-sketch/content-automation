"""OpportunityCard 영속 저장소.

strategy_agent가 생성한 기회 카드를 JSON 파일로 저장·조회·수정한다.
저장 경로: {outputs_dir}/opportunities/{card_id}.json
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from loguru import logger

from config.settings import get_settings
from core.models import ConversationMessage, OpportunityCard, OpportunityStatus


def _opportunities_dir() -> Path:
    settings = get_settings()
    path = Path(settings.outputs_dir) / "opportunities"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _card_path(card_id: str) -> Path:
    return _opportunities_dir() / f"{card_id}.json"


async def save_card(card: OpportunityCard) -> Path:
    """카드를 저장하고 파일 경로를 반환한다."""
    card.updated_at = datetime.utcnow()
    path = _card_path(card.card_id)
    path.write_text(card.model_dump_json(indent=2), encoding="utf-8")
    logger.debug(f"OpportunityCard saved: {card.card_id} ({card.status})")
    return path


async def get_card(card_id: str) -> OpportunityCard | None:
    """card_id로 단일 카드를 로드한다. 없으면 None."""
    path = _card_path(card_id)
    if not path.exists():
        return None
    try:
        return OpportunityCard.model_validate_json(path.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning(f"Failed to load card {card_id}: {e}")
        return None


async def list_cards(
    status: OpportunityStatus | None = None,
    limit: int = 50,
) -> list[OpportunityCard]:
    """카드 목록 반환. status 필터링 + 최신순 정렬."""
    cards: list[OpportunityCard] = []
    for path in sorted(_opportunities_dir().glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            card = OpportunityCard.model_validate_json(path.read_text(encoding="utf-8"))
            if status is None or card.status == status:
                cards.append(card)
            if len(cards) >= limit:
                break
        except Exception as e:
            logger.warning(f"Skipping corrupt card file {path.name}: {e}")
    return cards


async def update_card(card_id: str, **kwargs: Any) -> OpportunityCard | None:
    """카드 필드를 업데이트하고 저장한다."""
    card = await get_card(card_id)
    if card is None:
        return None
    for key, value in kwargs.items():
        if hasattr(card, key):
            setattr(card, key, value)
    await save_card(card)
    return card


async def append_card_message(card_id: str, role: str, content: str) -> OpportunityCard | None:
    """카드의 대화 이력에 메시지를 추가한다."""
    card = await get_card(card_id)
    if card is None:
        return None
    card.conversation.append(ConversationMessage(role=role, content=content))
    await save_card(card)
    return card
