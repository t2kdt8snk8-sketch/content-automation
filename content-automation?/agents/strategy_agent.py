"""strategy_agent: 누적된 리서치를 분석해 OpportunityCard를 생성한다.

research_store + trend_store의 최근 데이터를 읽고 Sonnet으로 분석한 뒤,
점수가 기준치 이상인 기회를 OpportunityCard로 만들어 opportunity_store에 저장한다.
"""
from __future__ import annotations

import json
import time
from typing import Any

from loguru import logger

from core.llm_client import call_sonnet
from core.models import AgentName, AgentResult, OpportunityCard, TaskRequest
from core.research_pipeline import now_iso
from prompts import load_prompt
from storage.opportunity_store import save_card
from storage.research_store import list_research_results
from storage.trend_store import load_latest_scan


async def run(request: TaskRequest, tool_input: dict[str, Any]) -> AgentResult:
    t0 = time.monotonic()
    min_score = int(tool_input.get("min_score", 65))
    max_cards = int(tool_input.get("max_cards", 3))
    source_ids = tool_input.get("source_research_ids", [])

    try:
        cards = await synthesize(
            min_score=min_score,
            max_cards=max_cards,
            source_research_ids=source_ids,
        )
    except Exception as exc:
        logger.error(f"strategy_agent failed: {exc}")
        return AgentResult(
            agent_name=AgentName.STRATEGY,
            success=False,
            content="",
            error=str(exc),
            duration_ms=(time.monotonic() - t0) * 1000,
        )

    saved = []
    for card in cards:
        await save_card(card)
        saved.append(card.model_dump(mode="json"))

    return AgentResult(
        agent_name=AgentName.STRATEGY,
        success=True,
        content=json.dumps({"cards": saved}, ensure_ascii=False, indent=2),
        duration_ms=(time.monotonic() - t0) * 1000,
    )


async def synthesize(
    min_score: int = 65,
    max_cards: int = 3,
    source_research_ids: list[str] | None = None,
) -> list[OpportunityCard]:
    """리서치 데이터를 분석해 OpportunityCard 목록을 반환한다."""
    # 최근 리서치 결과 로드 (최대 10개)
    research_items = list_research_results(limit=10)
    trend_scan = await load_latest_scan()

    if not research_items and trend_scan is None:
        logger.info("strategy_agent: no research data available, skipping")
        return []

    # 리서치 데이터 텍스트 직렬화
    research_text = _format_research(research_items)
    trend_text = _format_trends(trend_scan)
    collected_ids = [item.get("path", "") for item in research_items]

    system = load_prompt("strategy_agent")
    raw = await call_sonnet(
        system=system,
        messages=[
            {
                "role": "user",
                "content": (
                    f"분석 시각: {now_iso()}\n"
                    f"최대 {max_cards}개 기회 카드 생성 (opportunity_score {min_score}점 이상만).\n\n"
                    f"## 최근 리서치 데이터\n{research_text}\n\n"
                    f"## 최신 트렌드 스캔\n{trend_text}"
                ),
            }
        ],
    )

    raw_cards = _parse_cards(raw)
    cards: list[OpportunityCard] = []
    for item in raw_cards[:max_cards]:
        score = int(item.get("opportunity_score", 0))
        if score < min_score:
            continue
        cards.append(
            OpportunityCard(
                title=item.get("title", ""),
                summary=item.get("summary", ""),
                evidence=item.get("evidence", []),
                recommended_formats=item.get("recommended_formats", []),
                suggested_angles=item.get("suggested_angles", []),
                opportunity_score=score,
                source_research_ids=source_research_ids or collected_ids,
            )
        )

    logger.info(f"strategy_agent: generated {len(cards)} cards (min_score={min_score})")
    return cards


def _format_research(items: list[dict]) -> str:
    if not items:
        return "(리서치 데이터 없음)"
    parts = []
    for i, item in enumerate(items[:8], 1):
        user_msg = item.get("user_message", "")
        final = item.get("final_output", "")[:800]
        parts.append(f"[리서치 {i}]\n요청: {user_msg}\n결과 요약:\n{final}")
    return "\n\n".join(parts)


def _format_trends(trend_scan: Any) -> str:
    if trend_scan is None:
        return "(트렌드 스캔 없음)"
    try:
        opps = trend_scan.opportunities or []
        parts = []
        for opp in opps:
            parts.append(
                f"- {opp.topic} | 기회점수: {opp.opportunity_score} | 이유: {opp.why_now}"
            )
        return "\n".join(parts) if parts else "(기회 없음)"
    except Exception:
        return str(trend_scan)[:500]


def _parse_cards(raw: str) -> list[dict]:
    text = raw.strip()
    # ```json ... ``` 블록 추출
    if "```" in text:
        parts = text.split("```")
        for part in parts:
            candidate = part.strip()
            if candidate.startswith("json"):
                candidate = candidate[4:].strip()
            try:
                parsed = json.loads(candidate)
                if isinstance(parsed, list):
                    return parsed
                if isinstance(parsed, dict) and "cards" in parsed:
                    return parsed["cards"]
            except json.JSONDecodeError:
                continue
    # 직접 파싱 시도
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict) and "cards" in parsed:
            return parsed["cards"]
    except json.JSONDecodeError:
        pass
    logger.warning("strategy_agent: failed to parse LLM response as JSON")
    return []
