# Marketing Team Transformation — Design Spec
Date: 2026-04-16
Source: PLAN_MARKETING_TEAM.md (V3, Human-in-the-Loop 중심)

---

## Context

현재 content-automation은 "수집 → 요약 → 생성" 파이프라인이지만, 에이전트가 자의적으로 판단하고 CD(사용자)에게 아무것도 보여주지 않는 문제가 있다.

목표: AI를 "디렉팅이 필요한 주니어~미들급 직원"처럼 동작하게 만들고, 최종 판단권은 항상 CD에게 있도록 한다.

Phase 3(Reviewer 에이전트)는 Kimi K2.5 + Gemini Pro 조합이 이미 충분한 검수 능력을 제공하므로 드롭. 3개 Phase만 구현한다.

---

## Phase 1 — 프롬프트 CD 우선 원칙

### 대상 파일
- `prompts/strategy_agent.md`
- `prompts/scanner_agent.md`
- `prompts/copy_agent.md`
- `core/orchestrator.py` (`_ORCHESTRATOR_SYSTEM` 인라인)

### 원칙
각 에이전트 프롬프트 끝에 "CD 보고 원칙" 섹션 추가:

1. **strategy_agent** — 점수가 낮거나 데이터가 약해도 혼자 컷하지 않는다. summary에 상황을 솔직히 적고 CD에게 선택지를 제시한다.
2. **scanner_agent** — 데이터가 부족해도 묻어버리지 않는다. 부족한 이유를 적고 CD에게 방향을 넘긴다.
3. **copy_agent** — 가이드라인 이슈가 있어도 직접 수정하지 않는다. 이슈를 명시하고 선택지를 제안한다.
4. **_ORCHESTRATOR_SYSTEM** — CD는 절대적 의사결정권자. 중단점마다 현황 요약 + 선택지를 적극적으로 제시한다.

---

## Phase 2 — HitL 이벤트에 에이전트 결과 노출

### 문제
현재 `agent_completed` 이벤트는 `content` 필드를 이미 포함하지만, 프론트엔드가 시간(`elapsed_ms`)만 표시하고 내용을 버린다. CD가 결과를 보지 못하고 승인 버튼을 누른다.

### 백엔드 변경 (이번 범위)
`core/orchestrator.py`의 `plan_step` 이벤트에 `cd_message` 필드 추가:

```python
await _safe_emit(on_event, {
    "type": "plan_step",
    "agents": planned,
    "cd_message": f"PM 계획: {' → '.join(planned)} 순서로 진행하겠습니다. 방향을 바꾸려면 피드백을 남겨주세요.",
})
```

`agent_completed` 이벤트에 `cd_message` 필드 추가:

```python
await _safe_emit(on_event, {
    "type": "agent_completed",
    "agent": agent_name,
    "content": result.content if result.success else None,
    "error": result.error if not result.success else None,
    "elapsed_ms": round(elapsed),
    "cd_message": f"{agent_name} 완료. 결과를 확인하고 계속할지 방향을 바꿀지 알려주세요.",
})
```

### 프론트엔드 변경 (추후)
- `agent_completed`에서 `content` 필드를 실제로 렌더링
- 접기/펼치기 UI

---

## Phase 4 — 피드백 메모리

### 구조
두 종류의 메모리를 분리 관리:

**전역 룰 (Global Rules)**
- 위치: `marketing-context.md` 내 `## CD Feedback Rules` 섹션
- 형태: "항상 이모지 금지", "문장 3줄 이내" 같은 스타일 룰
- 적용: 모든 에이전트 프롬프트에 자동 주입 (현재 marketing-context.md 로드 로직 재활용)

**카드별 피드백 (Card-specific Context)**
- 위치: `storage/feedback_store.py` (신규) — JSON 파일, `card_id` 또는 `"global"` 키
- 형태:
  ```json
  {
    "global": [
      {"agent": "copy_agent", "feedback": "항상 이모지 금지", "timestamp": "..."}
    ],
    "card_id_abc": [
      {"agent": "copy_agent", "feedback": "이모지 너무 많음", "timestamp": "..."},
      {"agent": "copy_agent", "feedback": "타겟을 20대 여성으로 좁혀서", "timestamp": "..."}
    ]
  }
  ```
- 적용: orchestrator 시작 시 `"global"` + 해당 `card_id` 피드백을 모두 로드 → 시스템 프롬프트에 주입

### 저장 시점
`core/orchestrator.py` 중단점 B에서 `feedback` 타입 수신 시 `feedback_store.save()` 호출.
`TaskRequest`에 `card_id` 있으면 카드별 저장, 없으면 `"global"` 키로 저장.

### 신규 파일
- `storage/feedback_store.py` — async JSON 파일 기반 (기존 store들과 동일 패턴)

---

## 수정 파일 목록

| 파일 | 작업 |
|------|------|
| `prompts/strategy_agent.md` | CD 보고 원칙 섹션 추가 |
| `prompts/scanner_agent.md` | CD 보고 원칙 섹션 추가 |
| `prompts/copy_agent.md` | CD 보고 원칙 섹션 추가 |
| `core/orchestrator.py` | `_ORCHESTRATOR_SYSTEM` 수정, 이벤트에 `cd_message` 추가, feedback 저장 로직 추가 |
| `storage/feedback_store.py` | 신규 생성 |

---

## 검증 방법

1. 웹 UI에서 워크플로우 실행 → 중단점 A에서 `cd_message` 포함 여부 확인
2. 에이전트 완료 후 중단점 B에서 `content` + `cd_message` 수신 확인 (WebSocket 로그)
3. 피드백 입력 후 `storage/feedback_store.json` 파일에 저장됐는지 확인
4. 동일 카드 재실행 시 이전 피드백이 시스템 프롬프트에 포함됐는지 로그 확인
