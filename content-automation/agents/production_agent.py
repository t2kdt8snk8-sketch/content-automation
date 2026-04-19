"""production_agent: Gemini로 콘텐츠 제작, DuckDuckGo로 이미지 검색.

OpportunityCard를 받아 포맷을 자율 판단하고 제작한다.
대화 기반으로 사용자와 방향을 조율할 수 있다.
"""
from __future__ import annotations

import asyncio
from typing import Any

from loguru import logger

from core.llm_client import call_gemini
from core.models import OpportunityCard

_SYSTEM_DECIDE = """당신은 마케팅 콘텐츠 전문가입니다.
주어진 콘텐츠 기회 카드를 보고 최적의 제작 방식을 판단하세요.

판단 기준:
- 카드뉴스: 시각적으로 설명하기 좋은 트렌드, 통계, 비교
- 카피라이팅: 광고 문구, 소셜미디어 포스트, 캡션
- 스크립트: 영상·릴스·쇼츠 대본
- 아티클: 블로그·뉴스레터용 심층 글

응답 형식 (JSON):
{
  "format": "카드뉴스|카피라이팅|스크립트|아티클",
  "reason": "선택 이유 1문장",
  "outline": ["섹션1", "섹션2", ...],
  "image_queries": ["검색어1", "검색어2"]
}"""

_SYSTEM_PRODUCE = """당신은 마케팅 콘텐츠 전문가입니다.
주어진 기회 카드와 포맷을 바탕으로 실제 사용 가능한 콘텐츠를 제작하세요.
한국어로 작성하며, 흑인 음악/문화 씬에 맞는 톤을 유지하세요.
이미지 참고 URL이 있으면 콘텐츠 어느 섹션에 어울리는지 언급하세요."""

_SYSTEM_CHAT = """당신은 마케팅 콘텐츠 전문가입니다.
사용자와 콘텐츠 제작 방향을 대화로 조율하고 있습니다.
친절하고 구체적으로 답변하세요. 필요하면 수정안을 바로 제시하세요."""


async def decide_format(card: OpportunityCard) -> dict[str, Any]:
    """카드를 분석해 제작 포맷과 이미지 검색어를 결정한다."""
    import json

    prompt = f"""제목: {card.title}
요약: {card.summary}
근거: {', '.join(card.evidence)}
추천 포맷: {', '.join(card.recommended_formats)}
추천 각도: {', '.join(card.suggested_angles)}"""

    raw = await call_gemini(
        system=_SYSTEM_DECIDE,
        messages=[{"role": "user", "content": prompt}],
        fast=True,
    )

    # JSON 블록 파싱
    text = raw.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]

    try:
        return json.loads(text.strip())
    except Exception:
        # 파싱 실패 시 기본값
        return {
            "format": card.recommended_formats[0] if card.recommended_formats else "카피라이팅",
            "reason": "기본 포맷 선택",
            "outline": [],
            "image_queries": [card.title],
        }


async def search_images(queries: list[str], max_per_query: int = 3) -> list[dict[str, str]]:
    """DuckDuckGo 이미지 검색으로 관련 이미지 URL을 수집한다."""
    results: list[dict[str, str]] = []
    try:
        images = await asyncio.to_thread(_ddg_images_sync, queries, max_per_query)
        results = images
    except Exception as exc:
        logger.warning(f"이미지 검색 실패: {exc}")
    return results


def _ddg_images_sync(queries: list[str], max_per_query: int) -> list[dict[str, str]]:
    from ddgs import DDGS

    ddgs = DDGS()
    results: list[dict[str, str]] = []
    for query in queries[:2]:  # 최대 2개 쿼리
        try:
            items = list(ddgs.images(query, max_results=max_per_query))
            for item in items:
                url = item.get("image", "")
                if url:
                    results.append({"url": url, "title": item.get("title", ""), "query": query})
        except Exception:
            continue
    return results


async def produce_content(
    card: OpportunityCard,
    fmt: str,
    outline: list[str],
    images: list[dict[str, str]],
    user_direction: str = "",
) -> str:
    """실제 콘텐츠를 Gemini Pro로 제작한다."""
    image_block = ""
    if images:
        image_block = "\n참고 이미지:\n" + "\n".join(
            f"- {img['title']} ({img['url']})" for img in images[:5]
        )

    direction_block = f"\n사용자 요청: {user_direction}" if user_direction else ""

    prompt = f"""기회 카드:
제목: {card.title}
요약: {card.summary}
근거: {chr(10).join(f'- {e}' for e in card.evidence)}

제작 포맷: {fmt}
구성 아웃라인: {', '.join(outline) if outline else '자유롭게'}
{image_block}{direction_block}

위 내용을 바탕으로 실제 사용 가능한 {fmt} 콘텐츠를 제작해주세요."""

    return await call_gemini(
        system=_SYSTEM_PRODUCE,
        messages=[{"role": "user", "content": prompt}],
        fast=False,
    )


async def chat_about_production(
    card: OpportunityCard,
    conversation: list[dict[str, str]],
    user_message: str,
) -> str:
    """제작 과정에서 사용자와 대화한다."""
    context = f"[기회 카드: {card.title}]\n{card.summary}\n\n"
    messages = [{"role": "user", "content": context + "이 카드로 콘텐츠를 제작하려고 합니다."}]
    messages.append({"role": "assistant", "content": "네, 도와드릴게요!"})

    for msg in conversation:
        messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": user_message})

    return await call_gemini(
        system=_SYSTEM_CHAT,
        messages=messages,
        fast=True,
    )
