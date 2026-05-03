from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Protocol

import httpx

from app.config import Settings, get_settings
from app.ai.prompts import build_memo_prompt


@dataclass(frozen=True)
class ProviderResult:
    provider: str
    model: str
    enabled: bool
    ok: bool
    content: str
    error: str = ""


class AIProvider(Protocol):
    name: str
    model: str

    def enabled(self) -> bool:
        ...

    async def generate(self, context: dict) -> ProviderResult:
        ...


class MockProvider:
    name = "mock"
    model = "mock-v1"

    def enabled(self) -> bool:
        return True

    async def generate(self, context: dict) -> ProviderResult:
        close = float(context.get("latest_close") or 100)
        score = min(95, max(45, int(context.get("baseline_score") or 60) + 20))
        payload = {
            "recommendation": "buy" if score >= 70 else "watch",
            "confidence": score,
            "holding_period": "5~20 trading days",
            "entry_price": round(close, 2),
            "stop_price": round(close * 0.94, 2),
            "review_price": round(close * 1.08, 2),
            "max_weight": 0.03,
            "key_reasons": [
                "기본 후보 점수가 기준을 통과했다.",
                "최근 가격 흐름이 벤치마크 대비 나쁘지 않다.",
                "손절 기준 대비 재평가 가격의 보상 비율이 양호하다.",
            ],
            "counter_reasons": [
                "무료 데이터 기반이라 데이터 품질 한계가 있다.",
                "뉴스와 공시 근거가 아직 충분하지 않다.",
                "단기 변동성 확대 시 손절 가능성이 있다.",
            ],
            "bull_case": "상대강도와 거래량 증가가 유지되면 단기 추세가 이어질 수 있다.",
            "bear_case": "벤치마크가 약해지거나 거래량이 줄면 신호 신뢰도가 떨어진다.",
            "do_not_trade_if": [
                "다음 거래일 시초가가 진입 기준보다 5% 이상 갭 상승",
                "거래량이 20일 평균의 절반 이하",
                "같은 섹터 노출이 25% 초과",
            ],
        }
        return ProviderResult(self.name, self.model, True, True, json.dumps(payload, ensure_ascii=False))


class OpenAIProvider:
    name = "openai"

    def __init__(self, settings: Settings):
        self.settings = settings
        self.model = settings.openai_model

    def enabled(self) -> bool:
        return bool(self.settings.openai_api_key)

    async def generate(self, context: dict) -> ProviderResult:
        if not self.enabled():
            return ProviderResult(self.name, self.model, False, False, "", "missing OPENAI_API_KEY")
        prompt = build_memo_prompt(context)
        headers = {"Authorization": f"Bearer {self.settings.openai_api_key}", "Content-Type": "application/json"}
        body = {"model": self.model, "input": prompt, "text": {"format": {"type": "json_object"}}}
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post("https://api.openai.com/v1/responses", headers=headers, json=body)
                response.raise_for_status()
            data = response.json()
            content = data.get("output_text") or json.dumps(data)
            return ProviderResult(self.name, self.model, True, True, content)
        except Exception as exc:
            return ProviderResult(self.name, self.model, True, False, "", str(exc))


class AnthropicProvider:
    name = "anthropic"

    def __init__(self, settings: Settings):
        self.settings = settings
        self.model = settings.anthropic_model

    def enabled(self) -> bool:
        return bool(self.settings.anthropic_api_key)

    async def generate(self, context: dict) -> ProviderResult:
        if not self.enabled():
            return ProviderResult(self.name, self.model, False, False, "", "missing ANTHROPIC_API_KEY")
        prompt = build_memo_prompt(context)
        headers = {
            "x-api-key": self.settings.anthropic_api_key or "",
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        body = {
            "model": self.model,
            "max_tokens": 2000,
            "messages": [{"role": "user", "content": prompt}],
        }
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=body)
                response.raise_for_status()
            data = response.json()
            content = "".join(part.get("text", "") for part in data.get("content", []) if part.get("type") == "text")
            return ProviderResult(self.name, self.model, True, True, content)
        except Exception as exc:
            return ProviderResult(self.name, self.model, True, False, "", str(exc))


class GeminiProvider:
    name = "gemini"

    def __init__(self, settings: Settings):
        self.settings = settings
        self.model = settings.gemini_model

    def enabled(self) -> bool:
        return bool(self.settings.gemini_api_key)

    async def generate(self, context: dict) -> ProviderResult:
        if not self.enabled():
            return ProviderResult(self.name, self.model, False, False, "", "missing GEMINI_API_KEY")
        prompt = build_memo_prompt(context)
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={self.settings.gemini_api_key}"
        )
        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json"},
        }
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post(url, json=body)
                response.raise_for_status()
            data = response.json()
            content = data["candidates"][0]["content"]["parts"][0]["text"]
            return ProviderResult(self.name, self.model, True, True, content)
        except Exception as exc:
            return ProviderResult(self.name, self.model, True, False, "", str(exc))


def default_providers(include_mock_when_empty: bool = True) -> list[AIProvider]:
    settings = get_settings()
    providers: list[AIProvider] = [
        GeminiProvider(settings),
        AnthropicProvider(settings),
        OpenAIProvider(settings),
    ]
    if include_mock_when_empty and not any(provider.enabled() for provider in providers):
        providers.append(MockProvider())
    return providers
