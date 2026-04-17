# Marketing Team Transformation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI 에이전트들이 자의적으로 판단하지 않고 CD(사용자)에게 보고하며, 피드백을 기억해 다음 작업에 반영하는 Human-in-the-Loop 시스템 구축

**Architecture:** 프롬프트 수정(Phase 1), 오케스트레이터 이벤트 강화(Phase 2), 피드백 영구 저장소 신설(Phase 4). 기존 approval_queue/WebSocket 이벤트 구조는 유지하고 확장한다.

**Tech Stack:** Python, aiofiles, pytest-asyncio, 기존 FastAPI/WebSocket 인프라

---

## 파일 목록

| 파일 | 작업 |
|------|------|
| `prompts/strategy_agent.md` | CD 보고 원칙 추가 (이미 부분 적용됨 — 확인 후 완료 처리) |
| `prompts/scanner_agent.md` | CD 보고 원칙 추가 |
| `prompts/copy_agent.md` | CD 보고 원칙 추가 |
| `core/orchestrator.py` | `_ORCHESTRATOR_SYSTEM` 수정, 이벤트에 `cd_message` 추가, 피드백 저장/로드 추가 |
| `storage/feedback_store.py` | 신규 생성 — async JSON 기반 피드백 저장소 |
| `tests/test_feedback_store.py` | 신규 생성 — feedback_store 단위 테스트 |

---

## Task 1: feedback_store.py 생성

**Files:**
- Create: `storage/feedback_store.py`
- Create: `tests/test_feedback_store.py`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/test_feedback_store.py`:
```python
"""feedback_store 단위 테스트."""
from __future__ import annotations

import json
import pytest
from pathlib import Path

import pytest_asyncio


@pytest.fixture
def tmp_feedback_path(tmp_path, monkeypatch):
    """실제 파일 대신 임시 경로 사용."""
    import storage.feedback_store as fs
    monkeypatch.setattr(fs, "_FEEDBACK_PATH", tmp_path / "feedback.json")
    return tmp_path / "feedback.json"


@pytest.mark.asyncio
async def test_save_and_load_card_feedback(tmp_feedback_path):
    from storage.feedback_store import save_feedback, load_feedback

    await save_feedback(card_id="card_abc", agent="copy_agent", feedback="이모지 금지")
    data = await load_feedback(card_id="card_abc")

    assert len(data) == 1
    assert data[0]["agent"] == "copy_agent"
    assert data[0]["feedback"] == "이모지 금지"


@pytest.mark.asyncio
async def test_save_global_feedback(tmp_feedback_path):
    from storage.feedback_store import save_feedback, load_feedback

    await save_feedback(card_id=None, agent="copy_agent", feedback="항상 짧게")
    data = await load_feedback(card_id=None)

    assert len(data) == 1
    assert data[0]["feedback"] == "항상 짧게"


@pytest.mark.asyncio
async def test_load_combined_feedback(tmp_feedback_path):
    from storage.feedback_store import save_feedback, load_combined_feedback

    await save_feedback(card_id=None, agent="copy_agent", feedback="전역룰: 짧게")
    await save_feedback(card_id="card_abc", agent="copy_agent", feedback="카드룰: 이모지 금지")

    combined = await load_combined_feedback(card_id="card_abc")
    feedbacks = [e["feedback"] for e in combined]

    assert "전역룰: 짧게" in feedbacks
    assert "카드룰: 이모지 금지" in feedbacks


@pytest.mark.asyncio
async def test_load_returns_empty_when_no_file(tmp_feedback_path):
    from storage.feedback_store import load_feedback

    data = await load_feedback(card_id="nonexistent")
    assert data == []


@pytest.mark.asyncio
async def test_format_for_prompt_returns_empty_string_when_no_feedback(tmp_feedback_path):
    from storage.feedback_store import format_for_prompt

    result = await format_for_prompt(card_id="no_card")
    assert result == ""


@pytest.mark.asyncio
async def test_format_for_prompt_returns_section(tmp_feedback_path):
    from storage.feedback_store import save_feedback, format_for_prompt

    await save_feedback(card_id="card_abc", agent="copy_agent", feedback="이모지 금지")
    result = await format_for_prompt(card_id="card_abc")

    assert "CD 피드백" in result
    assert "이모지 금지" in result
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/minsoopark/Downloads/바이브코딩/content-automation
pytest tests/test_feedback_store.py -v
```
Expected: `ModuleNotFoundError: No module named 'storage.feedback_store'`

- [ ] **Step 3: feedback_store.py 구현**

`storage/feedback_store.py`:
```python
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiofiles

_FEEDBACK_PATH = Path("storage/feedback.json")


async def _load_raw() -> dict[str, list[dict[str, Any]]]:
    """전체 피드백 JSON 로드. 파일 없으면 빈 dict."""
    if not _FEEDBACK_PATH.exists():
        return {}
    try:
        async with aiofiles.open(_FEEDBACK_PATH, encoding="utf-8") as f:
            return json.loads(await f.read())
    except Exception:
        return {}


async def _save_raw(data: dict[str, list[dict[str, Any]]]) -> None:
    _FEEDBACK_PATH.parent.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(_FEEDBACK_PATH, "w", encoding="utf-8") as f:
        await f.write(json.dumps(data, ensure_ascii=False, indent=2))


async def save_feedback(
    card_id: str | None,
    agent: str,
    feedback: str,
) -> None:
    """피드백 저장. card_id=None이면 전역("global") 키에 저장."""
    key = card_id or "global"
    data = await _load_raw()
    entry = {
        "agent": agent,
        "feedback": feedback,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    data.setdefault(key, []).append(entry)
    await _save_raw(data)


async def load_feedback(card_id: str | None) -> list[dict[str, Any]]:
    """특정 card_id(또는 global)의 피드백 목록 반환."""
    key = card_id or "global"
    data = await _load_raw()
    return data.get(key, [])


async def load_combined_feedback(card_id: str) -> list[dict[str, Any]]:
    """전역 룰 + 카드별 피드백을 합쳐서 반환."""
    data = await _load_raw()
    global_entries = data.get("global", [])
    card_entries = data.get(card_id, [])
    return global_entries + card_entries


async def format_for_prompt(card_id: str | None) -> str:
    """에이전트 프롬프트에 주입할 텍스트 생성. 피드백 없으면 빈 문자열."""
    combined = await load_combined_feedback(card_id or "")
    if not combined:
        return ""
    lines = [f"- [{e['agent']}] {e['feedback']}" for e in combined]
    return "\n\n---\n[CD 피드백 — 반드시 참고]\n" + "\n".join(lines) + "\n---"
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pytest tests/test_feedback_store.py -v
```
Expected: 6개 PASS

- [ ] **Step 5: 커밋**

```bash
git add storage/feedback_store.py tests/test_feedback_store.py
git commit -m "feat: add feedback_store for CD feedback memory"
```

---

## Task 2: 프롬프트 CD 보고 원칙 추가

**Files:**
- Modify: `prompts/strategy_agent.md` (이미 수정됨 — 내용 확인만)
- Modify: `prompts/scanner_agent.md`
- Modify: `prompts/copy_agent.md`

> 프롬프트 파일은 텍스트 파일이므로 TDD 불필요. 변경 후 내용 확인으로 검증.

- [ ] **Step 1: strategy_agent.md 확인**

파일 끝에 아래 섹션이 있는지 확인:
```bash
grep -n "CD 보고 원칙\|CD(Creative Director)" content-automation/prompts/strategy_agent.md
```
있으면 이 스텝 완료. 없으면 파일 끝에 추가:
```markdown
## CD(Creative Director) 보고 원칙

**데이터가 부족하거나 점수가 낮아도 혼자 컷하지 않는다.**

- 기회 점수가 65 미만이어도 흥미롭거나 아슬아슬한 경우엔 카드에 포함하고 summary에 명시한다: "오늘 데이터가 다소 약합니다. CD님이 판단해주세요."
- 오늘 스캔 결과가 전반적으로 빈약하면 카드를 억지로 만들지 말고 summary에 상황을 솔직히 적어 CD에게 선택지를 제시한다: "오늘은 괜찮은 기회가 보이지 않습니다. 오늘 쉬거나, 주제를 직접 지정해주시면 진행하겠습니다."
- 확신이 없을 때는 숨기지 말고 그대로 보고한다. 최종 판단은 항상 CD가 내린다.
```

- [ ] **Step 2: scanner_agent.md 끝에 CD 보고 원칙 추가**

```markdown
## CD(Creative Director) 보고 원칙

**데이터가 부족해도 혼자 묻어버리지 않는다.**

- 검색 결과가 빈약하거나 근거가 약해도 결과를 숨기지 않는다. why_now에 "데이터 부족" 이유를 명시하고 opportunity_score를 낮게 매긴다.
- 5개를 채우기 위해 약한 주제를 억지로 넣지 않는다. 대신 opportunities 배열에 실제로 찾은 것만 넣고 왜 적은지 별도 "note" 필드를 추가한다.
- 최종 판단은 항상 CD가 내린다.
```

- [ ] **Step 3: copy_agent.md 끝에 CD 보고 원칙 추가**

```markdown
## CD(Creative Director) 보고 원칙

**가이드라인 이슈가 있어도 혼자 수정하지 않는다.**

- 마케팅 컨텍스트나 이전 피드백과 충돌하는 표현이 있으면 초안에 포함하되, 끝에 한 줄로 명시한다: "[주의] 이모지를 사용했습니다. CD님이 판단해주세요."
- 어떤 표현을 선택할지 확신이 없을 때는 2가지 버전을 제시하고 CD에게 선택을 넘긴다.
- 최종 판단은 항상 CD가 내린다.
```

- [ ] **Step 4: 커밋**

```bash
git add prompts/strategy_agent.md prompts/scanner_agent.md prompts/copy_agent.md
git commit -m "feat: add CD-first reporting principles to agent prompts"
```

---

## Task 3: _ORCHESTRATOR_SYSTEM에 CD 역할 명시

**Files:**
- Modify: `core/orchestrator.py` (라인 51-73, `_ORCHESTRATOR_SYSTEM`)

- [ ] **Step 1: `_ORCHESTRATOR_SYSTEM` 수정**

`core/orchestrator.py`의 `_ORCHESTRATOR_SYSTEM`을 아래로 교체:
```python
_ORCHESTRATOR_SYSTEM = """\
You are a content automation PM (Project Manager) working under a Creative Director (CD).
Your job is to plan agent execution and report progress to the CD at every checkpoint.

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

CD Authority Rules (CRITICAL):
- The CD has absolute decision-making power. Never make autonomous cuts or final decisions.
- At every checkpoint, summarize what happened and ask the CD how to proceed.
- If an agent result seems problematic, flag it — do NOT silently discard or redo it.
- Incorporate any CD feedback immediately into your next decisions.

Be efficient: a caption-only request doesn't need image prompts or a script.\
"""
```

- [ ] **Step 2: 커밋**

```bash
git add core/orchestrator.py
git commit -m "feat: reframe orchestrator as CD-reporting PM"
```

---

## Task 4: 이벤트에 cd_message 필드 추가

**Files:**
- Modify: `core/orchestrator.py` (중단점 A: 라인 151, 중단점 B: 라인 202-208)

- [ ] **Step 1: 중단점 A `plan_step` 이벤트에 `cd_message` 추가**

`core/orchestrator.py` 라인 151 부근의 `_safe_emit` 호출을 수정:
```python
agent_list = " → ".join(planned)
await _safe_emit(on_event, {
    "type": "plan_step",
    "agents": planned,
    "cd_message": (
        f"PM 보고: {agent_list} 순서로 진행하겠습니다. "
        f"방향을 바꾸려면 피드백을 남겨주세요."
    ),
})
```

- [ ] **Step 2: 중단점 B `agent_completed` 이벤트에 `cd_message` 추가**

중단점 B의 성공 케이스 `_safe_emit` 호출을 수정:
```python
await _safe_emit(on_event, {
    "type": "agent_completed",
    "agent": agent_name,
    "content": result.content if result.success else None,
    "error": result.error if not result.success else None,
    "elapsed_ms": round(elapsed),
    "cd_message": (
        f"{agent_name} 완료 ({round(elapsed)}ms). "
        f"결과를 확인하고 계속할지, 방향을 바꿀지 알려주세요."
        if result.success else
        f"{agent_name} 오류 발생. 재시도하거나 다른 방향을 지시해주세요."
    ),
})
```

- [ ] **Step 3: 에러 케이스 `agent_completed` 이벤트에도 `cd_message` 추가**

except 블록 안의 `_safe_emit` 호출 수정:
```python
await _safe_emit(on_event, {
    "type": "agent_completed",
    "agent": agent_name,
    "content": None,
    "error": str(e),
    "elapsed_ms": round((time.monotonic() - t0) * 1000),
    "cd_message": f"{agent_name} 실행 중 오류가 발생했습니다. 재시도하거나 다른 방향을 지시해주세요.",
})
```

- [ ] **Step 4: 커밋**

```bash
git add core/orchestrator.py
git commit -m "feat: add cd_message to plan_step and agent_completed events"
```

---

## Task 5: orchestrator에 피드백 저장 + 메모리 주입

**Files:**
- Modify: `core/models.py` (`TaskRequest`에 `card_id` 추가)
- Modify: `core/orchestrator.py` (상단 import, `run_workflow` 함수)

- [ ] **Step 1: TaskRequest에 card_id 필드 추가**

`core/models.py`에서 `TaskRequest` 클래스 확인:
```bash
grep -n "card_id\|TaskRequest" content-automation/core/models.py
```
`card_id` 필드가 없으면 `TaskRequest`에 추가:
```python
class TaskRequest(BaseModel):
    task_id: str = Field(default_factory=lambda: str(uuid4()))
    user_message: str
    chat_id: str | None = None
    card_id: str | None = None  # 이 줄 추가
```

- [ ] **Step 2: import 추가**

`core/orchestrator.py` 상단 import에 추가:
```python
from storage.feedback_store import format_for_prompt, save_feedback
```

- [ ] **Step 3: `run_workflow` 시작 시 피드백 로드 및 시스템 프롬프트 주입**

`run_workflow` 함수 안, `marketing_ctx = _load_marketing_context()` 라인을 찾아 그 다음 줄을 수정:
```python
marketing_ctx = _load_marketing_context()
feedback_ctx = await format_for_prompt(card_id=request.card_id)
system = _ORCHESTRATOR_SYSTEM + marketing_ctx + feedback_ctx
```

기존의 `system = _ORCHESTRATOR_SYSTEM + marketing_ctx` 라인을 위 코드로 대체.

- [ ] **Step 4: 중단점 B에서 feedback 수신 시 영구 저장**

중단점 B의 approval_queue 처리 블록을 수정:
```python
if approval_queue is not None:
    user_action = await approval_queue.get()
    if user_action.get("type") == "feedback":
        feedback_msg = user_action.get("message", "")
        accumulated_context[f"user_feedback_{agent_name}"] = feedback_msg
        await save_feedback(
            card_id=request.card_id,
            agent=agent_name,
            feedback=feedback_msg,
        )
        logger.info(
            f"[{request.task_id}] Agent feedback ({agent_name}): "
            f"{feedback_msg[:60]}"
        )
    # approve 또는 feedback 모두 다음 에이전트로 진행
```

- [ ] **Step 5: 통합 동작 확인**

```bash
cd /Users/minsoopark/Downloads/바이브코딩/content-automation
pytest tests/ -v
```
Expected: 기존 테스트 + test_feedback_store 모두 PASS

- [ ] **Step 6: 커밋**

```bash
git add core/models.py core/orchestrator.py
git commit -m "feat: persist CD feedback and inject into orchestrator system prompt"
```

---

## 최종 검증

- [ ] 웹 UI에서 워크플로우 실행 → WebSocket 로그에서 `plan_step` 이벤트에 `cd_message` 필드 확인
- [ ] 중단점 B에서 피드백 입력 → `storage/feedback.json` 파일 생성 및 내용 확인
- [ ] 동일 card_id로 재실행 → orchestrator 로그에 피드백 컨텍스트 포함 확인 (`logger.debug`)
- [ ] `pytest tests/ -v` 전체 통과 확인
