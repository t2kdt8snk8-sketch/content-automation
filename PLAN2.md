# 스펙: 자율형 콘텐츠 팀 시스템 (V1)

## Context

군 입대 후 폰 웹브라우저로만 운영할 시스템. 사용자는 최종 오케스트레이터 — 에이전트들이 시장 기회를 자율 발굴·보고하면, 사용자가 근거를 보고 방향을 결정하고, 에이전트가 실행. 고정 브랜드 없이 수요 기반 멀티니치로 운영.

**해결할 문제점:**
1. `.agents/marketing-context.md` 없음 → 에이전트가 퀄리티/판단 기준 없이 제너릭 출력
2. 스케줄러가 trend scan만 하고 저장에서 멈춤 → 웹 피드로 자동 연결 안 됨
3. 리서치 결과가 strategy 레이어 없이 방치됨 → 에이전트가 "알아서 보고"를 못 함
4. 웹 UI에 자율 피드 없음 → 에이전트 활동을 볼 방법 없음
5. `accumulated_context`가 string → 에이전트 간 구조화된 정보 전달 불가

---

## 아키텍처 개요

```
[스케줄러]
  ├── research_loop (30분 간격)
  │   └── gather_research_data × N categories → research_store 누적
  └── strategy_loop (60분 간격)
      └── research_store에 새 항목 3개+ 누적됐으면
          └── strategy_agent 실행 → OpportunityCard 생성 → opportunity_store 저장
                                                            └── WebSocket 브로드캐스트 → 웹 피드 실시간 업데이트

[웹 UI]
  ├── 피드 탭 — OpportunityCard 목록 (새로 올라오는 기회들)
  │   └── 각 카드: 근거·추천포맷·각도 + 상태 버튼(승인/패스) + 에이전트 대화창
  └── 기존 채팅 탭 — 그대로 유지
```

---

## V1 범위 (이번 계획)

- operator-profile.md 생성
- `strategy_agent` 신규 구현
- 스케줄러 research_loop + strategy_loop 분리
- `OpportunityCard` 데이터 모델 + `opportunity_store`
- 웹 API 추가 (`/api/opportunities`)
- 웹소켓 이벤트 추가 (`opportunity_created`)
- 프론트엔드 피드 탭 + 에이전트 대화창
- `accumulated_context` string → dict 개선

## V2 (다음 계획)

- 승인된 OpportunityCard에서 콘텐츠 제작 파이프라인 실행 (copy → script → format)
- 스킬(social-content, video-content-strategist, content-humanizer) → 에이전트 프롬프트 반영

## V3 (나중에)

- 성과 피드백 루프 (업로드 후 지표 수집 → 다음 리서치 주입)
- 클라이언트 분리 (세션별 별도 operator-profile 연결)

---

## 1. operator-profile.md

**파일:** `.agents/marketing-context.md`

orchestrator.py가 이미 이 경로를 읽어 모든 에이전트 실행 시 주입하므로 파일만 생성하면 됨 (`_load_marketing_context()` at orchestrator.py:23).

**담을 내용:**
- 퀄리티 기준: 어떤 콘텐츠가 통과/탈락인지 (AI 냄새 허용 수준, 후킹 강도, 정보 밀도)
- 플랫폼 우선순위: 인스타 릴스 > 캐러셀 > 유튜브 쇼츠
- 기회 판단 기준: 어떤 시그널 조합일 때 진입할지 (opportunity_score 임계값 기준 등)
- 출력 톤: 컬쳐-퍼스트, 인터넷 네이티브, 한국어 우선
- 패스 기준: 포화 소재, 에버그린 단순 재탕

---

## 2. 데이터 모델 추가

**파일:** `core/models.py`

### OpportunityCard (신규)
```python
class OpportunityStatus(str, Enum):
    NEW = "new"
    APPROVED = "approved"
    REJECTED = "rejected"
    IN_PROGRESS = "in_progress"
    DONE = "done"

class OpportunityCard(BaseModel):
    card_id: str                          # uuid
    created_at: datetime
    title: str                            # 기회 제목
    summary: str                          # 왜 지금인가 (2-3문장)
    evidence: list[str]                   # 근거 목록
    recommended_formats: list[str]        # 추천 포맷 (릴스, 캐러셀 등)
    suggested_angles: list[str]           # 콘텐츠 각도 1-3개
    opportunity_score: int                # 0-100
    status: OpportunityStatus = OpportunityStatus.NEW
    conversation: list[ConversationMessage] = []   # 카드별 에이전트 대화
    source_research_ids: list[str] = []   # 근거가 된 research result IDs
    updated_at: datetime | None = None
```

### accumulated_context 타입 변경

`run_workflow` 내 `accumulated_context`를 `dict[str, str]`로 변경:
```python
# Before (orchestrator.py:92)
accumulated_context = ""
accumulated_context += f"\n\n--- {agent_name} output ---\n{result.content}"
tool_input.setdefault("context", accumulated_context)

# After
accumulated_context: dict[str, str] = {}
accumulated_context[agent_name] = result.content
tool_input.setdefault("context", accumulated_context)  # JSON 직렬화하여 주입
```

에이전트 입장에서 이전 에이전트의 출력을 키로 참조 가능해짐.

---

## 3. strategy_agent (신규)

### 프롬프트 파일: `prompts/strategy_agent.md`

역할: 누적된 리서치를 읽고 "지금 이 기회가 진짜인가"를 판단해 OpportunityCard 초안 생성. 마케팅팀 전략팀장 포지션.

담을 내용:
- 리서치 데이터에서 진짜 시그널 vs 노이즈 구분 기준
- 기회 점수 계산 방식 (수요·포화도·타이밍)
- 각도 제안 방식 (에버그린 제외, 지금만 되는 이유 필요)
- 출력 JSON 스키마 (OpportunityCard 호환)
- `social-media-analyzer` 스킬의 수요/포화도 스코어링 관점 통합

### 에이전트 파일: `agents/strategy_agent.py`

```python
async def run(request: TaskRequest, tool_input: dict[str, Any]) -> AgentResult:
    # research_store에서 최근 리서치 결과 로드
    # trend_store에서 최신 스캔 로드
    # strategy_agent 프롬프트 + 데이터 → call_sonnet
    # 응답 파싱 → list[OpportunityCard]
    # opportunity_store에 저장
    # AgentResult 반환
```

### registry.py에 추가

```python
AgentName.STRATEGY: AgentDef(
    name=AgentName.STRATEGY,
    description="누적 리서치를 분석해 블루오션 콘텐츠 기회 카드 생성",
    input_schema={...}
)
```

`AgentName` enum에 `STRATEGY = "strategy"` 추가.

---

## 4. opportunity_store (신규)

**파일:** `storage/opportunity_store.py`

저장 경로: `{outputs_dir}/opportunities/{card_id}.json`

```python
async def save_card(card: OpportunityCard) -> Path
async def list_cards(status: OpportunityStatus | None = None, limit: int = 50) -> list[OpportunityCard]
async def get_card(card_id: str) -> OpportunityCard | None
async def update_card(card_id: str, **kwargs) -> OpportunityCard
async def append_card_message(card_id: str, role: str, content: str) -> OpportunityCard
```

---

## 5. 스케줄러 고도화

**파일:** `scheduler.py`, `config/settings.py`

### 기존 scanner_loop → 유지 (trend_store용)
변경 없음. 기존 TrendScan 저장 그대로.

### 신규: research_loop
```python
async def research_accumulation_loop():
    # RESEARCH_INTERVAL_MINUTES 간격 (기본 30분)
    # gather_research_data(category) for category in settings.scan_categories
    # ResearchResult → research_store 저장
    # 이전 strategy 실행 이후 누적된 새 항목 수 카운트
```

### 신규: strategy_loop
```python
async def strategy_synthesis_loop():
    # STRATEGY_INTERVAL_MINUTES 간격 (기본 60분)
    # 마지막 strategy 실행 이후 새 research item이 STRATEGY_MIN_NEW_ITEMS(기본 3)개 이상이면
    # strategy_agent 실행
    # 생성된 OpportunityCard → opportunity_store 저장
    # WebSocket 브로드캐스트: opportunity_created 이벤트
```

### settings.py 추가 환경변수
```
RESEARCH_INTERVAL_MINUTES=30
STRATEGY_INTERVAL_MINUTES=60
STRATEGY_MIN_NEW_ITEMS=3
```

### start_scheduler() 수정
세 개의 asyncio Task 동시 시작.

---

## 6. 웹 API 추가

**파일:** `web/app.py`

### REST 엔드포인트

| 경로 | 메서드 | 역할 |
|------|--------|------|
| `GET /api/opportunities` | GET | 기회 카드 목록 (status 필터 가능) |
| `GET /api/opportunities/{card_id}` | GET | 단일 카드 상세 |
| `PATCH /api/opportunities/{card_id}` | PATCH | 상태 변경 (approve/reject/done) |
| `POST /api/opportunities/{card_id}/chat` | POST | 해당 카드에 대해 에이전트와 대화 |

### WebSocket 이벤트 추가 (서버→클라이언트)

```json
// 새 기회 카드 생성됨 (strategy_loop 완료 시)
{ "type": "opportunity_created", "card": { ...OpportunityCard } }

// 카드 상태 변경됨 (PATCH 후)
{ "type": "opportunity_updated", "card": { ...OpportunityCard } }
```

WebSocket broadcast는 `app.state.ws_manager` (또는 유사한 연결 풀)를 통해 모든 연결된 클라이언트에 전송.

---

## 7. 프론트엔드

**파일:** `web/static/index.html` (React 빌드 결과물 교체)

현재 React + Vite 구조. 소스는 별도 디렉토리 확인 필요.

### 피드 탭 추가

- 기존 채팅 탭 옆에 "피드" 탭 추가
- `GET /api/opportunities` 로 초기 로드
- WebSocket `opportunity_created` 이벤트 수신 → 실시간 카드 추가

### OpportunityCard 컴포넌트

```
┌────────────────────────────────────────┐
│ 📊 [기회 제목]                  ●NEW  │
│ [요약 텍스트]                          │
│                                        │
│ 근거: • 시그널1 • 시그널2              │
│ 추천: 릴스 | 캐러셀                    │
│ 각도: • 각도1 • 각도2                  │
│                                        │
│ [승인]  [패스]  [대화하기 ▼]          │
│ ─────────────────────────────────────  │
│ (대화하기 열리면 채팅창 인라인 표시)   │
└────────────────────────────────────────┘
```

- **승인** → `PATCH /api/opportunities/{id}` `{ status: "approved" }`
- **패스** → `PATCH /api/opportunities/{id}` `{ status: "rejected" }`
- **대화하기** → 카드 하단에 인라인 채팅창 열림 (`POST /api/opportunities/{id}/chat`)
- opportunity_score 높을수록 상단 정렬

---

## 수정 파일 목록

| 파일 | 변경 유형 |
|------|----------|
| `.agents/marketing-context.md` | 신규 생성 |
| `core/models.py` | OpportunityCard, OpportunityStatus 추가 / accumulated_context 타입 변경 |
| `agents/strategy_agent.py` | 신규 생성 |
| `prompts/strategy_agent.md` | 신규 생성 |
| `storage/opportunity_store.py` | 신규 생성 |
| `agents/registry.py` | STRATEGY 에이전트 등록 |
| `scheduler.py` | research_loop + strategy_loop 추가, start_scheduler 수정 |
| `config/settings.py` | RESEARCH_INTERVAL_MINUTES 등 3개 변수 추가 |
| `web/app.py` | /api/opportunities 엔드포인트 + WebSocket 이벤트 추가 |
| `core/orchestrator.py` | accumulated_context string → dict |
| 프론트엔드 소스 | 피드 탭 + OpportunityCard 컴포넌트 |

---

## 검증

1. `.agents/marketing-context.md` 생성 후 `run_workflow` 호출 → 에이전트 출력에 판단 기준 반영 확인
2. `scheduler.py` 수동 실행 → research_loop가 research_store에 저장 확인
3. strategy_loop 수동 트리거 → OpportunityCard가 opportunity_store에 생성 확인
4. 웹 UI 피드 탭 열기 → 카드 목록 표시 확인
5. WebSocket 연결 상태에서 strategy_loop 실행 → 실시간 카드 추가 확인
6. 카드 승인/패스 → 상태 변경 확인
7. 카드 대화창 → 에이전트 응답 확인
8. `pytest` 전량 통과 확인 (기존 24개 + 신규 테스트)
