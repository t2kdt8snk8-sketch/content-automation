# 계획: 하이브리드 채팅 및 자동화 워크플로우 구현

## 목표
`content-automation` 시스템을 단순한 일방향 자동화 툴에서, 자유로운 채팅과 구조화된 콘텐츠 자동화를 모두 수행할 수 있는 유연한 AI 어시스턴트로 진화시킨다.

## 핵심 목표
1. **의도 분류 (Intent Classification)**: "단순 채팅/브레인스토밍"과 "실제 콘텐츠 작업 수행"을 구분한다.
2. **대화 기억 (Conversational Memory)**: 세션 기반 메모리를 구현하여 여러 번의 대화 맥락을 기억하도록 한다.
3. **유연한 에이전트 실행**: 전체 파이프라인을 무조건 돌리는 것이 아니라, 특정 에이전트만 선택적으로 실행(예: "리서치만 해줘")할 수 있게 한다.
4. **하이브리드 인터페이스**: 텔레그램/웹 인터페이스에서 현재 모드(채팅 vs 작업)를 명확히 알 수 있게 업데이트한다.

## 상세 구현 단계

### 1단계: 설계 — 상태 모델 · 라우터 · 스토어 정의 ✅
- [x] `core/models.py`에 `ConversationState` 추가: `mode`, `collected_params`, `last_agent_outputs`, `pending_intent` 포함.
- [x] `core/router.py` 신규: `MessageRouter` — 명시적 명령(`/chat`, `/run`, `/research` 등) → 규칙 기반 판별 → Haiku LLM 분류 순서. 분류기는 보조 수단.
- [x] `storage/conversation_store.py` 신규: `output_store`와 완전 분리. TTL(24h), 최근 20개 이력, `load / save / append_message / set_mode / update_params / recent_history` 구현.

### 2단계: 명시적 실행 API 추가 ✅
- [x] `core/orchestrator.py`에 3가지 실행 경로 추가:
  - `run_chat(request, state)` — 이전 이력 포함, LLM 직접 답변. Fast-path.
  - `run_agent(request, agent_name, ...)` — 단일 에이전트 강제 실행. 세션 context 자동 주입.
  - `run_workflow(request, ...)` — 기존 전체 파이프라인 (변경 없음).
- [x] 텔레그램/웹에 최소 모드 표시 추가: "🤖 채팅 중" vs "⚙️ 작업 중..."

### 3단계: 텔레그램 · 웹에 라우터 연결 + 모드 표시 ✅
- [x] `telegram_bot.py`: `_on_message`에서 `route()`로 경로 판별 → `run_chat / run_agent / run_workflow` 분기. 모드 표시 메시지 추가.
- [x] `web/app.py`: WebSocket `run_workflow` 이벤트를 라우터 경유로 교체. 프론트에 `mode` 이벤트 전송.

### 4단계: 하이브리드 브릿지 — 채팅 맥락 → 워크플로우 ✅
- [x] `core/bridge.py` 신규: `extract_params` (Haiku로 파라미터 추출), `should_trigger` (규칙 우선 → Haiku 보조), `build_enriched_message` (맥락 주입).
- [x] 채팅 경로에서 매 메시지마다 파라미터 추출 → `collected_params` 누적.
- [x] 트리거 감지 시 `build_enriched_message`로 보강된 요청을 워크플로우에 전달. 중복 질문 방지.

### 5단계: 전체 시나리오 테스트 ✅
- [x] 24개 단위 테스트 작성 및 전량 통과: 라우터(8), 스토어(6), 브릿지(7), 모델(3).
- [x] LLM 호출 없이 mock으로 핵심 로직 검증. 실제 API 호출 엣지케이스는 운영 중 모니터링.

## 기술적 제약 및 원칙
- **모델 사용**: 오케스트레이션·채팅은 Opus 4.6. 의도 분류는 Haiku(속도·비용).
- **안정성**: 기존 `run_workflow` 시그니처 변경 없음. 하위 호환 유지.
- **라우터 원칙**: 명령어 → 규칙 → LLM 분류 순서. LLM은 최후 수단.
- **스토어 분리**: `output_store`(완료 결과물)와 `conversation_store`(대화 이력) 역할 분리 유지.
