from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

from core.llm_client import call_haiku
from core.models import AgentName, ResearchGoal

# 실행 경로 타입
RoutePath = Literal["chat", "agent", "workflow", "research"]

# 명시적 명령어 → 경로 매핑
_COMMAND_MAP: dict[str, tuple[RoutePath, str | None]] = {
    "/chat":     ("chat",     None),
    "/run":      ("workflow", None),
    "/research": ("agent",    AgentName.RESEARCH),
    "/discover": ("research", None),
    "/deepdive": ("research", None),
    "/copy":     ("agent",    AgentName.COPY),
    "/script":   ("agent",    AgentName.SCRIPT),
    "/image":    ("agent",    AgentName.IMAGE_PROMPT),
}

# 작업 요청 키워드 (규칙 기반 판별용)
_WORK_PATTERNS = re.compile(
    r"(만들어|써줘|작성해|생성해|캡션|카피|스크립트|리서치|검색해|프롬프트"
    r"|carousel|caption|script|write|create|generate|research|draft)",
    re.IGNORECASE,
)

_RESEARCH_PATTERNS = re.compile(
    r"(트렌드|리서치|조사|분석|소재|아이디어|분야|요즘 뭐|what.?s trending|trend|topic ideas|angles?)",
    re.IGNORECASE,
)

# 단순 채팅 패턴 — 짧고 인사/질문형
_CHAT_PATTERNS = re.compile(
    r"^(안녕|hi|hello|hey|ㅎㅇ|뭐해|잘돼|어때|괜찮|고마워|감사|ㄱㅅ|ㅇㅋ|ㅇㅇ|넵|넷)[\s\?\!\.]*$",
    re.IGNORECASE,
)

_CLASSIFIER_SYSTEM = """\
You are a message router. Classify the user's message into one of three routes:

- "chat": casual conversation, brainstorming, questions, feedback, greetings
- "agent": a clear request for ONE specific content task (research only, copy only, etc.)
- "workflow": a full content creation request that needs multiple steps
- "research": a research or discovery request about trends, topics, angles, or opportunities

Reply with exactly one word: chat, agent, workflow, or research."""


@dataclass
class RouteResult:
    path: RoutePath
    agent_name: str | None = None   # path == "agent" 일 때만 사용
    source: str = "rule"            # "command" | "rule" | "llm"
    research_goal: ResearchGoal | None = None


async def route(message: str) -> RouteResult:
    """메시지를 받아 실행 경로를 결정한다.

    우선순위: 명시적 명령어 → 규칙 기반 → LLM 분류기
    """
    stripped = message.strip()

    # 1. 명시적 명령어
    for cmd, (path, agent) in _COMMAND_MAP.items():
        if stripped.lower().startswith(cmd):
            research_goal = None
            if cmd == "/discover":
                research_goal = ResearchGoal.DISCOVER
            elif cmd == "/deepdive":
                research_goal = ResearchGoal.DEEP_DIVE
            return RouteResult(
                path=path,
                agent_name=agent,
                source="command",
                research_goal=research_goal,
            )

    # 2. 규칙 기반
    if _CHAT_PATTERNS.match(stripped) or len(stripped) < 10:
        return RouteResult(path="chat", source="rule")

    if _RESEARCH_PATTERNS.search(stripped) and not _WORK_PATTERNS.search(stripped):
        return RouteResult(
            path="research",
            source="rule",
            research_goal=_detect_research_goal(stripped),
        )

    if _WORK_PATTERNS.search(stripped):
        # 단일 에이전트 강제 키워드 체크
        agent = _detect_single_agent(stripped)
        if agent:
            return RouteResult(path="agent", agent_name=agent, source="rule")
        if _RESEARCH_PATTERNS.search(stripped):
            return RouteResult(
                path="research",
                source="rule",
                research_goal=_detect_research_goal(stripped),
            )
        return RouteResult(path="workflow", source="rule")

    # 3. LLM 분류기 (Haiku — 빠르고 저렴)
    try:
        result = await call_haiku(
            system=_CLASSIFIER_SYSTEM,
            messages=[{"role": "user", "content": stripped}],
        )
        path_str = result.strip().lower()
        if path_str not in ("chat", "agent", "workflow", "research"):
            path_str = "workflow"  # 불명확하면 안전하게 workflow
        return RouteResult(
            path=path_str,  # type: ignore[arg-type]
            source="llm",
            research_goal=_detect_research_goal(stripped) if path_str == "research" else None,
        )
    except Exception:
        return RouteResult(path="workflow", source="rule")  # fallback


def _detect_single_agent(message: str) -> str | None:
    """메시지에서 단일 에이전트 강제 실행 의도를 감지한다."""
    msg = message.lower()
    if any(k in msg for k in ("리서치만", "검색만", "research only", "리서치 해줘", "리서치해줘")):
        return AgentName.RESEARCH
    if any(k in msg for k in ("카피만", "캡션만", "copy only", "카피만 써", "캡션만 써")):
        return AgentName.COPY
    if any(k in msg for k in ("스크립트만", "script only", "스크립트만 써")):
        return AgentName.SCRIPT
    if any(k in msg for k in ("이미지 프롬프트만", "image prompt only", "프롬프트만")):
        return AgentName.IMAGE_PROMPT
    return None


def _detect_research_goal(message: str) -> ResearchGoal:
    msg = message.lower()
    if any(
        key in msg
        for key in (
            "분야",
            "뭐가 뜨",
            "what's trending",
            "what is trending",
            "discover",
            "발굴",
            "기회",
        )
    ):
        return ResearchGoal.DISCOVER
    return ResearchGoal.DEEP_DIVE
