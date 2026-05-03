"""In-memory pub/sub for SSE streaming of background pipeline progress.

Single-process only. Multiple workers would need Redis or similar.
"""
from __future__ import annotations

import asyncio
import json
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Any

_LISTENERS: list[asyncio.Queue] = []
_HISTORY: list[dict[str, Any]] = []
_HISTORY_LIMIT = 200
_RUNNING: bool = False
_LOCK = asyncio.Lock() if False else None  # threadsafe-ish via list ops


def _now_str() -> str:
    return time.strftime("%H:%M:%S", time.localtime())


def publish(event: dict[str, Any]) -> None:
    """Broadcast an event to all current SSE subscribers and remember last N."""
    if "at" not in event:
        event["at"] = _now_str()
    _HISTORY.append(event)
    if len(_HISTORY) > _HISTORY_LIMIT:
        del _HISTORY[: len(_HISTORY) - _HISTORY_LIMIT]
    dead: list[asyncio.Queue] = []
    for queue in list(_LISTENERS):
        try:
            queue.put_nowait(event)
        except Exception:
            dead.append(queue)
    for queue in dead:
        if queue in _LISTENERS:
            _LISTENERS.remove(queue)


def mark_running(running: bool) -> None:
    global _RUNNING
    _RUNNING = running


def is_running() -> bool:
    return _RUNNING


def latest_progress() -> list[dict[str, Any]]:
    return list(_HISTORY[-30:])


def reset() -> None:
    _HISTORY.clear()


@dataclass
class StepRecord:
    step: str
    status: str
    message: str = ""
    at: str = field(default_factory=_now_str)


PIPELINE_STEPS = [
    ("universe", "유니버스 갱신"),
    ("collect", "데이터 수집"),
    ("features", "지표 계산"),
    ("candidates", "후보 선별"),
    ("training", "학습 표본 갱신"),
    ("probability", "확률 보정"),
    ("memo", "AI 의견서"),
]


def step_started(step: str, message: str = "") -> None:
    publish({"kind": "step", "step": step, "status": "running", "message": message})


def step_done(step: str, message: str = "") -> None:
    publish({"kind": "step", "step": step, "status": "done", "message": message})


def step_error(step: str, message: str) -> None:
    publish({"kind": "step", "step": step, "status": "error", "message": message})


def pipeline_started() -> None:
    mark_running(True)
    publish({"kind": "pipeline_start", "step": "universe", "status": "running"})


def pipeline_done(message: str = "완료") -> None:
    mark_running(False)
    publish({"kind": "pipeline_done", "step": "memo", "status": "done", "message": message})


def pipeline_failed(message: str) -> None:
    mark_running(False)
    publish({"kind": "pipeline_error", "step": "", "status": "error", "message": message})


@asynccontextmanager
async def subscribe():
    queue: asyncio.Queue = asyncio.Queue()
    _LISTENERS.append(queue)
    try:
        yield queue
    finally:
        if queue in _LISTENERS:
            _LISTENERS.remove(queue)


async def event_stream():
    """Async generator yielding SSE-formatted strings."""
    # send recent history first so reconnecting clients see current state
    for ev in latest_progress():
        yield "data: " + json.dumps(ev, ensure_ascii=False) + "\n\n"
    async with subscribe() as queue:
        while True:
            try:
                ev = await asyncio.wait_for(queue.get(), timeout=15)
                yield "data: " + json.dumps(ev, ensure_ascii=False) + "\n\n"
            except asyncio.TimeoutError:
                # heartbeat
                yield ": ping\n\n"
