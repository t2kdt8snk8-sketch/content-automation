"""스케줄러: 세 개의 자율 루프를 관리한다.

- scanner_loop: 기존 TrendScan 저장 (trend_store용)
- research_loop: 짧은 주기로 리서치 데이터 누적 (research_store)
- strategy_loop: 누적 데이터가 충분하면 strategy_agent 실행 → OpportunityCard 생성
"""
from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

from loguru import logger

from agents.scanner_agent import scan_categories
from agents.strategy_agent import synthesize as strategy_synthesize
from config.settings import get_settings
from core.models import ResearchGoal, ResearchRequest
from core.research_pipeline import gather_research_data, render_research_bundle
from storage.opportunity_store import save_card
from storage.research_store import list_research_results, save_research_result
from storage.trend_store import save_scan

# strategy_loop가 마지막으로 실행됐을 때 본 research item 수
_last_strategy_item_count: int = 0

# WebSocket 브로드캐스트 콜백 (web/app.py에서 주입)
_broadcast_callback: Callable[[dict[str, Any]], Awaitable[None]] | None = None


def set_broadcast_callback(cb: Callable[[dict[str, Any]], Awaitable[None]]) -> None:
    """web/app.py가 시작 시 WebSocket broadcast 함수를 주입한다."""
    global _broadcast_callback
    _broadcast_callback = cb


async def _broadcast(data: dict[str, Any]) -> None:
    if _broadcast_callback is not None:
        try:
            await _broadcast_callback(data)
        except Exception as e:
            logger.warning(f"Broadcast failed: {e}")


# ── 기존 scanner_loop (TrendScan 저장) ────────────────────────────────────────

async def run_trend_scan_once() -> None:
    settings = get_settings()
    categories = [item.strip() for item in settings.scan_categories.split(",")]
    categories = [item for item in categories if item]
    if not categories:
        logger.info("Trend scanner skipped: SCAN_CATEGORIES empty")
        return

    scan = await scan_categories(categories=categories, limit=5)
    await save_scan(scan)
    logger.info(
        f"Trend scan completed with {len(scan.opportunities)} opportunities"
    )


async def scanner_loop() -> None:
    settings = get_settings()
    if settings.scan_interval_minutes is not None:
        interval_s = max(settings.scan_interval_minutes, 1) * 60
    else:
        interval_s = max(settings.scan_interval_hours, 1) * 3600

    # 앱 시작 시 웹 UI가 먼저 응답할 수 있게 초기 대기
    await asyncio.sleep(interval_s)

    while True:
        try:
            await run_trend_scan_once()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning(f"Trend scan run failed: {exc}")
        await asyncio.sleep(interval_s)


# ── research_loop (리서치 데이터 누적) ────────────────────────────────────────

async def run_research_once() -> None:
    """설정된 카테고리들에 대해 리서치를 수행하고 research_store에 저장한다."""
    settings = get_settings()
    categories = [c.strip() for c in settings.scan_categories.split(",") if c.strip()]
    if not categories:
        return

    from core.models import ResearchGoal, ResearchRequest
    from research.orchestrator import run_research

    for category in categories:
        try:
            request = ResearchRequest(
                chat_id="scheduler",
                goal=ResearchGoal.DISCOVER,
                query=f"{category} trend",
            )
            result = await run_research(request)
            await save_research_result(result)
            logger.debug(f"research_loop: saved research for '{category}'")
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning(f"research_loop: failed for '{category}': {exc}")


async def research_loop() -> None:
    settings = get_settings()
    interval_s = max(settings.research_interval_minutes, 5) * 60

    # 첫 실행은 앱 시작 직후 리서치 데이터 확보
    await asyncio.sleep(30)

    while True:
        try:
            await run_research_once()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning(f"research_loop failed: {exc}")
        await asyncio.sleep(interval_s)


# ── strategy_loop (기회 카드 생성 + 브로드캐스트) ─────────────────────────────

async def run_strategy_once() -> None:
    """누적 리서치가 충분하면 strategy_agent를 실행하고 결과를 브로드캐스트한다."""
    global _last_strategy_item_count

    settings = get_settings()
    current_items = list_research_results(limit=200)
    current_count = len(current_items)

    new_items = current_count - _last_strategy_item_count
    if new_items < settings.strategy_min_new_items:
        logger.debug(
            f"strategy_loop: only {new_items} new items "
            f"(need {settings.strategy_min_new_items}), skipping"
        )
        return

    logger.info(f"strategy_loop: {new_items} new items → running strategy_agent")

    cards = await strategy_synthesize(min_score=65, max_cards=3)
    _last_strategy_item_count = current_count

    for card in cards:
        await save_card(card)
        await _broadcast({
            "type": "opportunity_created",
            "card": card.model_dump(mode="json"),
        })
        logger.info(
            f"strategy_loop: created card '{card.title}' "
            f"(score={card.opportunity_score})"
        )

    if not cards:
        logger.info("strategy_loop: no cards above threshold")


async def strategy_loop() -> None:
    settings = get_settings()
    interval_s = max(settings.strategy_interval_minutes, 10) * 60

    # 리서치 데이터가 쌓일 시간을 준 뒤 첫 전략 분석 실행
    await asyncio.sleep(interval_s)

    while True:
        try:
            await run_strategy_once()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning(f"strategy_loop failed: {exc}")
        await asyncio.sleep(interval_s)


# ── 진입점 ────────────────────────────────────────────────────────────────────

def start_scheduler() -> list[asyncio.Task[None]]:
    """세 개의 스케줄러 루프를 시작하고 Task 목록을 반환한다."""
    return [
        asyncio.create_task(scanner_loop(), name="trend-scanner"),
        asyncio.create_task(research_loop(), name="research-accumulator"),
        asyncio.create_task(strategy_loop(), name="strategy-synthesizer"),
    ]
