from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class AgentName(str, Enum):
    RESEARCH = "research_agent"
    COPY = "copy_agent"
    IMAGE_PROMPT = "image_prompt_agent"
    SCRIPT = "script_agent"
    FORMAT = "format_agent"
    SCANNER = "scanner_agent"
    STRATEGY = "strategy_agent"


class OpportunityStatus(str, Enum):
    NEW = "new"
    APPROVED = "approved"
    REJECTED = "rejected"
    IN_PROGRESS = "in_progress"
    DONE = "done"


class ConversationMode(str, Enum):
    CHAT = "chat"        # 자유 채팅 — LLM 직접 답변
    WORK = "work"        # 콘텐츠 작업 — 에이전트 파이프라인


class ConversationMessage(BaseModel):
    role: str            # "user" | "assistant"
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ConversationState(BaseModel):
    """한 chat_id(텔레그램 채팅방 또는 웹 세션)의 대화 상태."""
    chat_id: str
    mode: ConversationMode = ConversationMode.CHAT
    history: list[ConversationMessage] = Field(default_factory=list)
    collected_params: dict[str, Any] = Field(default_factory=dict)  # 대화 중 확정된 파라미터
    last_agent_outputs: dict[str, str] = Field(default_factory=dict)  # 마지막 에이전트별 결과
    pending_intent: str | None = None   # 아직 실행 안 된 감지된 의도
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class TaskRequest(BaseModel):
    task_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_message: str
    chat_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: dict[str, Any] = Field(default_factory=dict)


class AgentResult(BaseModel):
    agent_name: AgentName
    success: bool
    content: str
    error: str | None = None
    tokens_used: int = 0
    duration_ms: float = 0.0


class WorkflowRun(BaseModel):
    task_id: str
    request: TaskRequest
    agent_results: list[AgentResult] = Field(default_factory=list)
    final_output: str | None = None
    status: str = "pending"
    started_at: datetime | None = None
    completed_at: datetime | None = None
    total_tokens: int = 0


class TrendOpportunity(BaseModel):
    topic: str
    category: str
    why_now: str
    evidence: list[str] = Field(default_factory=list)
    recommended_format: str
    demand_score: int
    saturation_score: int
    opportunity_score: int


class TrendScan(BaseModel):
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    opportunities: list[TrendOpportunity] = Field(default_factory=list)


class ResearchGoal(str, Enum):
    DISCOVER = "discover_opportunities"
    DEEP_DIVE = "analyze_seed_topic"


class ResearchRequest(BaseModel):
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    chat_id: str
    goal: ResearchGoal
    query: str
    seed_topics: list[str] = Field(default_factory=list)
    platforms: list[str] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)
    time_window: str = "7d"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ResearchItem(BaseModel):
    source: str
    title: str
    snippet: str = ""
    url: str = ""
    published_at: str | None = None
    author_or_channel: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ResearchOpportunity(BaseModel):
    title: str
    topic: str
    why_now: str
    evidence: list[str] = Field(default_factory=list)
    best_formats: list[str] = Field(default_factory=list)
    priority_reason: str = ""
    recommended_next_step: str = ""
    searchability_score: int = 0
    shareability_score: int = 0
    saturation_score: int = 0
    platform_fit_score: int = 0
    confidence_score: int = 0
    suggested_hooks: list[str] = Field(default_factory=list)


class ResearchResult(BaseModel):
    request: ResearchRequest
    summary: str
    opportunities: list[ResearchOpportunity] = Field(default_factory=list)
    raw_items: list[ResearchItem] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class OpportunityCard(BaseModel):
    """strategy_agent가 생성하는 콘텐츠 기회 카드. 웹 피드에 표시됨."""
    card_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    title: str
    summary: str                              # 왜 지금인가 (2-3문장)
    evidence: list[str] = Field(default_factory=list)
    recommended_formats: list[str] = Field(default_factory=list)
    suggested_angles: list[str] = Field(default_factory=list)
    opportunity_score: int = 0                # 0-100
    status: OpportunityStatus = OpportunityStatus.NEW
    conversation: list[ConversationMessage] = Field(default_factory=list)
    source_research_ids: list[str] = Field(default_factory=list)
    updated_at: datetime | None = None
