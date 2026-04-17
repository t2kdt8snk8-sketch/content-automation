# Agent-Centric UI 설계 문서

**작성일:** 2026-04-17  
**대상 프로젝트:** content-automation 프론트엔드  
**구현 방식:** 단계적 교체 (Method A) — 기존 동작을 유지하면서 점진적으로 교체

---

## 개요

기존 탭 기반 UI(채팅/피드/제작)를 완전히 제거하고, 픽셀 오피스 캔버스에서 캐릭터와 가구를 클릭하여 패널을 여는 "에이전트 중심 인터페이스"로 전환한다.

---

## 1. 상태 관리 변경 (App.tsx)

### 변경 전
```typescript
type Tab = 'chat' | 'feed' | 'production'
const [activeTab, setActiveTab] = useState<Tab>('chat')
```

### 변경 후
```typescript
type OverlayType = 'chat' | 'production' | 'whiteboard' | string // string = agent name
const [openOverlays, setOpenOverlays] = useState<Set<OverlayType>>(new Set())
```

- 여러 오버레이 동시에 열기 가능
- 열기: `setOpenOverlays(prev => new Set(prev).add(type))`
- 닫기: 닫기 버튼 클릭 시 Set에서 제거
- 탭 헤더 및 탭 패널 컨테이너 완전 삭제
- OfficeCanvas가 화면 전체를 채움 (`position: absolute, inset: 0`)
- OfficeCanvas에 `onOverlayOpen: (type: OverlayType) => void` 콜백 prop 전달

### 에이전트 이름 매핑 상수
```typescript
// src/constants/agentNames.ts
export const AGENT_DISPLAY_NAMES: Record<string, string> = {
  research_agent: '리서처',
  strategy_agent: '전략가',
  copy_agent: '카피라이터',
  script_agent: '스크립터',
  image_prompt_agent: '이미지 디렉터',
  format_agent: '포맷터',
  scanner_agent: '트렌드 스캐너',
}
```

---

## 2. 캔버스 클릭 처리

### 2-1. officeState.ts — getFurnitureAt 신규 메서드

```typescript
getFurnitureAt(worldX: number, worldY: number): string | null
```
- `Math.floor(worldX / TILE_SIZE)` → col
- `Math.floor(worldY / TILE_SIZE)` → row
- `this.furniture` 배열 순회 → 해당 타일의 가구 `type` 반환
- 없으면 `null` 반환

### 2-2. OfficeCanvas.tsx — 이벤트 추가

**onClick:**
```typescript
const worldX = e.nativeEvent.offsetX / ZOOM
const worldY = e.nativeEvent.offsetY / ZOOM

// 캐릭터 클릭 → 에이전트 패널
const char = stateRef.current.getCharacterAt(worldX, worldY)
if (char) { onOverlayOpen(char.agentName); return; }

// 가구 클릭
const furniture = stateRef.current.getFurnitureAt(worldX, worldY)
if (furniture === 'PC') { setShowPcMenu(true); return; }
if (furniture === 'WHITEBOARD') { onOverlayOpen('whiteboard'); return; }
```

**onMouseMove:**
- 캐릭터 또는 가구 위에 있으면 `cursor: 'pointer'`
- 그 외 `cursor: 'default'`

### 2-3. PC 클릭 선택 팝업

PC 클릭 시 캔버스 위에 작은 팝업 표시:
- "💬 채팅" 버튼 → `onOverlayOpen('chat')`
- "✍️ 직접 제작" 버튼 → `onOverlayOpen('production')`
- 팝업 바깥 클릭 시 닫힘

### 2-4. 레이아웃 수정 (default-layout-1.json)

WHITEBOARD 에셋을 벽면에 추가 (현재 레이아웃에 없음).  
배치 위치: 사무실 상단 벽면 (구체적 좌표는 구현 시 결정).

---

## 3. 오버레이 시스템

### 레이아웃 계층
```
App.tsx
├── <OfficeCanvas />     position: absolute, inset: 0, z-index: 0
└── <OverlayManager />   position: absolute, inset: 0, z-index: 10, pointer-events: none
    └── 각 패널           pointer-events: auto
```

### OverlayManager 컴포넌트 (신규)

Props:
```typescript
{
  openOverlays: Set<OverlayType>
  onClose: (type: OverlayType) => void
  // 기존 패널에 필요한 props 전달
}
```

- `openOverlays` Set을 순회하며 열린 패널 렌더링
- 패널은 화면 우측에서 슬라이드 등장
- 여러 개 열리면 좌우로 나란히 배치
- 각 패널 우상단 닫기(×) 버튼

### 패널 스타일 공통
- 반투명 배경: `background: rgba(18,26,49,0.85)`
- 배경 블러: `backdrop-filter: blur(8px)`
- 테두리: `border: 1px solid rgba(255,255,255,0.1)`
- 오피스가 은은하게 비치는 효과

---

## 4. 클릭 대상별 패널 매핑

| 클릭 대상 | 열리는 패널 | 구현 방식 |
|-----------|------------|----------|
| PC | 채팅/제작 선택 팝업 | 신규 |
| WHITEBOARD | 리서치 뷰 | 신규 |
| 전략가 (strategy_agent) | 기회 카드 뷰 | 기존 FeedPanel 재활용 |
| 나머지 에이전트 | 에이전트 작업 현황 | 신규 AgentPanel |

---

## 5. 신규 컴포넌트

### 5-1. 리서치 뷰 (ResearchPanel)

- API: `GET /api/research/archive` → 리서치 목록
- API: `GET /api/research/archive/{file_id}` → 상세 조회
- 목록 → 항목 클릭 → 상세 내용 표시 (드릴다운)
- 원시 리서치 데이터 전체 표시 (FeedPanel과 다르게 필터링 없음)

### 5-2. 에이전트 작업 현황 패널 (AgentPanel)

- 에이전트 이름 표시 (AGENT_DISPLAY_NAMES 매핑 사용)
- WebSocket 이벤트 필터링: 해당 에이전트의 이벤트만 표시
- 현재 작업 중인 내용, 완료된 작업 로그

### 5-3. 채팅 패널 개선

- 기존 ChatPanel 재활용
- 에이전트 간 대화 이벤트도 표시 (agent-to-agent)
- 발신자 표시 예시:
  ```
  [리서처 → 전략가] "리서치 완료. 트렌드 3개 전달."
  [전략가 → 전체] "기획안 작성 시작."
  [리서처 → 나] "수집 완료 보고."
  ```
- 에이전트 간 이벤트는 백엔드 구현 여부 확인 후 연결 (현재 미구현 가능성 있음)

---

## 6. 향후 작업 (이번 범위 외)

- **모바일 레이아웃**: 상단 오피스/대시보드 + 하단 채팅 고정, 에셋 클릭 시 상단 교체
- **에이전트 행동 시스템**: 일할 때 책상, 쉴 때 소파/돌아다니기 (idle/working 상태)
- **오케스트레이터 캐릭터**: 팀장 역할로 오피스에 표시할지 여부

---

## 7. 구현 순서 (단계적 교체)

1. `officeState.ts` — `getFurnitureAt` 메서드 추가
2. `OfficeCanvas.tsx` — onClick, onMouseMove 이벤트 추가 + onOverlayOpen 콜백 연결
3. `default-layout-1.json` — WHITEBOARD 배치
4. `App.tsx` — `activeTab` → `openOverlays` 상태 교체, 탭 UI 제거
5. `OverlayManager.tsx` — 신규 컴포넌트 생성
6. `ResearchPanel.tsx` — 신규 컴포넌트 생성
7. `AgentPanel.tsx` — 신규 컴포넌트 생성
8. `constants/agentNames.ts` — 에이전트 이름 매핑 상수
9. 기존 `ChatPanel`, `FeedPanel`, `ProductionPanel` — 오버레이 스타일로 리팩토링
