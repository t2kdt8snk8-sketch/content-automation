from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

import anthropic
import httpx

from config.settings import get_settings


@lru_cache
def get_client() -> anthropic.AsyncAnthropic:
    settings = get_settings()
    return anthropic.AsyncAnthropic(
        api_key=settings.anthropic_api_key,
        base_url=settings.llm_base_url,
        max_retries=2,
        timeout=120.0,
    )


def _extract_text(response: Any) -> str:
    """Normalize Anthropic/proxy responses into plain text."""
    if isinstance(response, str):
        return _extract_sse_text(response)

    content = getattr(response, "content", None)
    if isinstance(content, str):
        return content

    if isinstance(content, list) and content:
        first = content[0]
        text = getattr(first, "text", None)
        if isinstance(text, str):
            return text
        if isinstance(first, dict) and isinstance(first.get("text"), str):
            return first["text"]

    if isinstance(response, dict):
        content = response.get("content")
        if isinstance(content, str):
            return content
        if isinstance(content, list) and content:
            first = content[0]
            if isinstance(first, dict) and isinstance(first.get("text"), str):
                return first["text"]
        if isinstance(response.get("text"), str):
            return response["text"]

    return _extract_sse_text(str(response))


def _extract_sse_text(raw: str) -> str:
    """Extract visible assistant text from an SSE transcript if needed."""
    text = raw.strip()
    if "event:" not in text and "data:" not in text:
        return text

    chunks: list[str] = []
    data_lines: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            if data_lines:
                _consume_sse_payload(data_lines, chunks)
                data_lines = []
            continue
        if stripped.startswith("data:"):
            data_lines.append(stripped[5:].strip())

    if data_lines:
        _consume_sse_payload(data_lines, chunks)

    cleaned = "".join(chunks).strip()
    return cleaned or text


def _consume_sse_payload(lines: list[str], chunks: list[str]) -> None:
    payload = "\n".join(lines).strip()
    if not payload or payload == "[DONE]":
        return

    try:
        data = json.loads(payload)
    except Exception:
        return

    if not isinstance(data, dict):
        return

    if data.get("type") == "content_block_delta":
        delta = data.get("delta", {})
        if isinstance(delta, dict) and delta.get("type") == "text_delta":
            text = delta.get("text")
            if isinstance(text, str):
                chunks.append(text)
        return

    if data.get("type") == "content_block_start":
        block = data.get("content_block", {})
        if isinstance(block, dict) and block.get("type") == "text":
            text = block.get("text")
            if isinstance(text, str):
                chunks.append(text)


async def call_opus(system: str, messages: list[dict[str, Any]]) -> str:
    """Call Opus for high-reasoning generation tasks without tools. Returns text content."""
    settings = get_settings()
    client = get_client()
    response = await client.messages.create(
        model=settings.model_opus,
        max_tokens=4096,
        system=system,
        messages=messages,
    )
    return _extract_text(response)

async def call_sonnet(system: str, messages: list[dict[str, Any]]) -> str:
    """Call Sonnet for generation tasks. Returns text content."""
    settings = get_settings()
    client = get_client()
    response = await client.messages.create(
        model=settings.model_sonnet,
        max_tokens=4096,
        system=system,
        messages=messages,
    )
    return _extract_text(response)


async def call_haiku(system: str, messages: list[dict[str, Any]]) -> str:
    """Call Haiku for cheap formatting tasks."""
    settings = get_settings()
    client = get_client()
    response = await client.messages.create(
        model=settings.model_haiku,
        max_tokens=2048,
        system=system,
        messages=messages,
    )
    return _extract_text(response)


async def call_gemini(
    system: str,
    messages: list[dict[str, Any]],
    fast: bool = False,
) -> str:
    """Gemini API로 콘텐츠 제작. fast=True면 flash-lite 모델 사용."""
    settings = get_settings()
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY가 설정되지 않았습니다.")

    model = settings.model_production_fast if fast else settings.model_production
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        f"?key={settings.gemini_api_key}"
    )

    # Anthropic 형식 → Gemini 형식 변환
    gemini_contents: list[dict[str, Any]] = []
    if system:
        gemini_contents.append({"role": "user", "parts": [{"text": f"[System]\n{system}"}]})
        gemini_contents.append({"role": "model", "parts": [{"text": "네, 이해했습니다."}]})

    for msg in messages:
        role = "model" if msg.get("role") == "assistant" else "user"
        content = msg.get("content", "")
        if isinstance(content, str):
            gemini_contents.append({"role": role, "parts": [{"text": content}]})
        elif isinstance(content, list):
            parts = [{"text": b.get("text", "")} for b in content if b.get("type") == "text"]
            if parts:
                gemini_contents.append({"role": role, "parts": parts})

    payload = {
        "contents": gemini_contents,
        "generationConfig": {"maxOutputTokens": 8192, "temperature": 0.8},
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()

    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as exc:
        raise RuntimeError(f"Gemini 응답 파싱 실패: {data}") from exc


async def call_opus_with_tools(
    system: str,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]],
) -> anthropic.types.Message:
    """Call Opus with tool definitions for orchestration. Returns raw Message."""
    settings = get_settings()
    client = get_client()
    return await client.messages.create(
        model=settings.model_opus,
        max_tokens=4096,
        system=system,
        messages=messages,
        tools=tools,  # type: ignore[arg-type]
    )
