from __future__ import annotations

import asyncio
import re
import time
from collections.abc import Awaitable, Callable
from datetime import datetime
from pathlib import Path
from typing import Any

import anthropic
from loguru import logger

from agents.registry import TOOL_DEFINITIONS, get_agent_callable
from core.llm_client import call_opus, call_opus_with_tools
from core.models import AgentResult, ConversationState, TaskRequest, WorkflowRun

MAX_ITERATIONS = 10

_MARKETING_CONTEXT_PATH = Path(".agents/marketing-context.md")


def _load_marketing_context() -> str:
    """`.agents/marketing-context.md`가 있으면 읽어서 반환. 없으면 빈 문자열."""
    try:
        text = _MARKETING_CONTEXT_PATH.read_text(encoding="utf-8").strip()
        # 템플릿만 있고 실제로 채워지지 않은 경우 스킵
        if not text or all(line.startswith("#") or line.startswith("<!--") or not line.strip()
                           for line in text.splitlines()):
            return ""
        return f"\n\n---\n[Marketing Context]\n{text}\n---"
    except FileNotFoundError:
        return ""
    except Exception as e:
        logger.warning(f"marketing-context.md 읽기 실패 (무시): {e}")
        return ""


_ORCHESTRATOR_SYSTEM = """\
You are a content automation orchestrator. Given a user's content request, use the \
available tools (agents) to fulfill it. Each tool represents a specialized agent.

Available agents:
- research_agent: web search and trend analysis — use first when fresh data is needed
- copy_agent: Korean/English copywriting and captions — use for any written content
- image_prompt_agent: Midjourney/Flux image prompts — use when visuals are needed
- script_agent: video/podcast script writing — use when video is the deliverable
- format_agent: formats final output as clean markdown — ALWAYS call this last

Strategy:
1. Analyze the request and decide which agents are needed (skip what isn't relevant)
2. Call agents in logical order: research → content creation → format
3. When calling later agents, pass relevant outputs from earlier agents in the 'context' field
4. Always call format_agent as your final step to produce a polished result
5. Once format_agent is done, respond with a brief summary of what was created

The user may inject feedback between agent steps. Incorporate any feedback into your \
next decisions and pass it in the context field to the relevant agents.

Be efficient: a caption-only request doesn't need image prompts or a script.\
"""


async def run_workflow(
    request: TaskRequest,
    on_event: Callable[[dict[str, Any]], Awaitable[None]] | None = None,
    approval_queue: asyncio.Queue[dict[str, Any]] | None = None,
) -> WorkflowRun:
    """Execute a content automation workflow.

    Args:
        request: The user's task.
        on_event: Optional async callback — called with progress events for the UI.
        approval_queue: Optional asyncio.Queue — when provided the workflow pauses
            at each step waiting for {"type": "approve"} or {"type": "feedback",
            "message": "..."}. When None (Telegram bot), runs fully automatically.
    """
    marketing_ctx = _load_marketing_context()
    system = _ORCHESTRATOR_SYSTEM + marketing_ctx

    workflow_start = time.monotonic()
    run = WorkflowRun(
        task_id=request.task_id,
        request=request,
        status="running",
        started_at=datetime.utcnow(),
    )

    messages: list[dict[str, Any]] = [
        {"role": "user", "content": request.user_message}
    ]
    accumulated_context: dict[str, str] = {}

    logger.info(f"[{request.task_id}] Starting workflow: {request.user_message[:80]}")

    for iteration in range(MAX_ITERATIONS):
        logger.debug(f"[{request.task_id}] Orchestrator iteration {iteration + 1}")

        try:
            response = await call_opus_with_tools(
                system=system,
                messages=messages,
                tools=TOOL_DEFINITIONS,
            )
        except Exception as e:
            logger.error(f"[{request.task_id}] Opus call failed: {e}")
            await _safe_emit(on_event, {"type": "workflow_failed", "error": str(e)})
            run.status = "failed"
            run.completed_at = datetime.utcnow()
            return run

        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            for block in response.content:
                if isinstance(block, anthropic.types.TextBlock):
                    run.final_output = block.text
                    break
            total_ms = round((time.monotonic() - workflow_start) * 1000)
            await _safe_emit(on_event, {
                "type": "workflow_completed",
                "final_output": run.final_output,
                "total_ms": total_ms,
            })
            logger.info(f"[{request.task_id}] Workflow complete after {iteration + 1} iterations")
            break

        if response.stop_reason != "tool_use":
            logger.warning(f"[{request.task_id}] Unexpected stop_reason: {response.stop_reason}")
            break

        # ── 중단점 A: Opus가 실행할 에이전트 목록 결정 직후 ──────────────────
        planned = [
            b.name for b in response.content
            if isinstance(b, anthropic.types.ToolUseBlock)
        ]
        await _safe_emit(on_event, {"type": "plan_step", "agents": planned})

        if approval_queue is not None:
            user_action = await approval_queue.get()
            if user_action.get("type") == "feedback":
                # 피드백을 대화에 추가하고 Opus 재호출 (에이전트 실행 없이)
                feedback_msg = user_action.get("message", "")
                messages.append({"role": "user", "content": feedback_msg})
                logger.info(f"[{request.task_id}] Plan feedback: {feedback_msg[:60]}")
                continue
            # type == "approve" → 아래로 진행

        # ── 에이전트 실행 ─────────────────────────────────────────────────────
        tool_results: list[dict[str, Any]] = []

        for block in response.content:
            if not isinstance(block, anthropic.types.ToolUseBlock):
                continue

            agent_name = block.name
            tool_input: dict[str, Any] = dict(block.input)  # type: ignore[arg-type]

            if "context" in _get_tool_schema_properties(agent_name):
                # dict를 에이전트가 읽기 쉬운 텍스트로 직렬화해서 주입
                context_str = "\n\n".join(
                    f"--- {k} output ---\n{v}"
                    for k, v in accumulated_context.items()
                )
                tool_input.setdefault("context", context_str)

            await _safe_emit(on_event, {
                "type": "agent_started",
                "agent": agent_name,
            })
            logger.info(f"[{request.task_id}] → {agent_name}({list(tool_input.keys())})")
            t0 = time.monotonic()

            try:
                agent_fn = get_agent_callable(agent_name)
                result: AgentResult = await agent_fn(request, tool_input)
                elapsed = (time.monotonic() - t0) * 1000
                logger.info(
                    f"[{request.task_id}] ← {agent_name} "
                    f"({'ok' if result.success else 'err'}) {elapsed:.0f}ms"
                )
                run.agent_results.append(result)

                if result.success:
                    accumulated_context[agent_name] = result.content

                # ── 중단점 B: 에이전트 완료 직후 ─────────────────────────────
                await _safe_emit(on_event, {
                    "type": "agent_completed",
                    "agent": agent_name,
                    "content": result.content if result.success else None,
                    "error": result.error if not result.success else None,
                    "elapsed_ms": round(elapsed),
                })

                if approval_queue is not None:
                    user_action = await approval_queue.get()
                    if user_action.get("type") == "feedback":
                        feedback_msg = user_action.get("message", "")
                        accumulated_context[f"user_feedback_{agent_name}"] = feedback_msg
                        logger.info(
                            f"[{request.task_id}] Agent feedback ({agent_name}): "
                            f"{feedback_msg[:60]}"
                        )
                    # approve 또는 feedback 모두 다음 에이전트로 진행

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result.content if result.success
                               else f"ERROR: {result.error}",
                })

            except Exception as e:
                logger.error(f"[{request.task_id}] Agent {agent_name} raised: {e}")
                await _safe_emit(on_event, {
                    "type": "agent_completed",
                    "agent": agent_name,
                    "content": None,
                    "error": str(e),
                    "elapsed_ms": round((time.monotonic() - t0) * 1000),
                })
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": f"Agent execution failed: {e}",
                    "is_error": True,
                })
                # 실패해도 approval_queue 소비 (UI가 멈추지 않도록)
                if approval_queue is not None:
                    await approval_queue.get()

        messages.append({"role": "user", "content": tool_results})

    else:
        logger.warning(f"[{request.task_id}] Reached MAX_ITERATIONS ({MAX_ITERATIONS})")

    if not run.final_output:
        for result in reversed(run.agent_results):
            if result.success and result.content:
                run.final_output = result.content
                break

    run.status = "completed" if run.final_output else "failed"
    run.completed_at = datetime.utcnow()
    run.total_tokens = sum(r.tokens_used for r in run.agent_results)
    return run


async def _safe_emit(
    on_event: Callable[[dict[str, Any]], Awaitable[None]] | None,
    payload: dict[str, Any],
) -> None:
    """on_event 콜백을 안전하게 호출 — 실패해도 워크플로우는 계속."""
    if on_event is None:
        return
    try:
        await on_event(payload)
    except Exception as e:
        logger.warning(f"on_event callback failed: {e}")


def _get_tool_schema_properties(agent_name: str) -> set[str]:
    for tool in TOOL_DEFINITIONS:
        if tool["name"] == agent_name:
            return set(tool["input_schema"].get("properties", {}).keys())
    return set()


# ── Fast-path: 채팅 모드 ──────────────────────────────────────────────────────

_CHAT_SYSTEM = """\
You are a helpful content strategy assistant. Answer conversationally in the same \
language the user writes in (Korean or English). Be concise and practical.
If the user seems to be building toward a content task, note key details \
(topic, platform, tone) but don't ask too many questions at once.\
"""

_CHAT_GREETING_PATTERNS = re.compile(
    r"^(안녕|안녕하세요|hi|hello|hey|ㅎㅇ)[\s\?\!\.]*$",
    re.IGNORECASE,
)


async def run_chat(
    request: TaskRequest,
    state: ConversationState | None = None,
) -> str:
    """LLM이 직접 답변하는 채팅 경로 — 에이전트 파이프라인 없음.

    Args:
        request: 현재 사용자 메시지.
        state: 세션 상태 (이전 대화 이력 포함). None이면 단발성 응답.

    Returns:
        LLM 응답 텍스트.
    """
    from storage.conversation_store import recent_history

    if _CHAT_GREETING_PATTERNS.match(request.user_message.strip()):
        return "안녕하세요. 리서치, 전략, 콘텐츠 제작 중에서 무엇을 같이 해볼까요?"

    messages: list[dict[str, Any]] = []

    if state:
        messages.extend(recent_history(state, n=10))

    # 현재 메시지가 이력에 이미 포함됐으면 중복 방지
    if not messages or messages[-1].get("content") != request.user_message:
        messages.append({"role": "user", "content": request.user_message})

    marketing_ctx = _load_marketing_context()
    system = _CHAT_SYSTEM + marketing_ctx

    logger.info(f"[{request.task_id}] run_chat (history={len(messages)} msgs)")
    return await call_opus(system=system, messages=messages)


# ── Single-agent 실행 경로 ────────────────────────────────────────────────────

async def run_agent(
    request: TaskRequest,
    agent_name: str,
    tool_input: dict[str, Any] | None = None,
    state: ConversationState | None = None,
    on_event: Callable[[dict[str, Any]], Awaitable[None]] | None = None,
) -> AgentResult:
    """단일 에이전트를 직접 실행한다.

    Args:
        request: 현재 사용자 요청.
        agent_name: 실행할 에이전트 이름 (AgentName enum 값).
        tool_input: 에이전트에 넘길 파라미터. None이면 user_message에서 자동 구성.
        state: 세션 상태 (이전 출력을 context로 전달할 때 사용).
        on_event: 진행 이벤트 콜백.

    Returns:
        AgentResult.
    """
    if tool_input is None:
        tool_input = {"query": request.user_message, "topic": request.user_message}

    # marketing-context 주입
    marketing_ctx = _load_marketing_context()
    if marketing_ctx:
        tool_input.setdefault("context", "")
        tool_input["context"] = marketing_ctx.strip() + "\n\n" + tool_input["context"]

    # 세션에서 이전 에이전트 출력을 context로 주입
    if state and state.last_agent_outputs:
        context = "\n\n".join(
            f"--- {k} ---\n{v}" for k, v in state.last_agent_outputs.items()
        )
        tool_input.setdefault("context", context)

    await _safe_emit(on_event, {"type": "agent_started", "agent": agent_name})
    logger.info(f"[{request.task_id}] run_agent → {agent_name}")
    t0 = time.monotonic()

    try:
        agent_fn = get_agent_callable(agent_name)
        result: AgentResult = await agent_fn(request, tool_input)
        elapsed = round((time.monotonic() - t0) * 1000)
        logger.info(f"[{request.task_id}] run_agent ← {agent_name} {elapsed}ms")
        await _safe_emit(on_event, {
            "type": "agent_completed",
            "agent": agent_name,
            "content": result.content if result.success else None,
            "error": result.error if not result.success else None,
            "elapsed_ms": elapsed,
        })
        return result
    except Exception as e:
        elapsed = round((time.monotonic() - t0) * 1000)
        logger.error(f"[{request.task_id}] run_agent error ({agent_name}): {e}")
        await _safe_emit(on_event, {
            "type": "agent_completed",
            "agent": agent_name,
            "content": None,
            "error": str(e),
            "elapsed_ms": elapsed,
        })
        return AgentResult(
            agent_name=agent_name,  # type: ignore[arg-type]
            success=False,
            content="",
            error=str(e),
        )
