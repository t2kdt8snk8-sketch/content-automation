from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

import anthropic

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
