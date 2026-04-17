# Agent-Centric UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 탭 기반 UI를 제거하고, 픽셀 오피스 캔버스의 캐릭터/가구 클릭으로 패널을 여는 에이전트 중심 인터페이스로 전환한다.

**Architecture:** 단계적 교체 방식. 기존 컴포넌트를 살리면서 상태 관리(`activeTab` → `openOverlays: Set<OverlayType>`)를 먼저 바꾸고, 캔버스 클릭 이벤트를 연결한 뒤, 마지막으로 탭 UI를 제거한다. 새 컴포넌트(OverlayManager, ResearchPanel, AgentPanel)는 그 위에 추가한다.

**Tech Stack:** React 19, TypeScript 5.9, Vite, Canvas API (2D context), WebSocket

---

## 파일 구조

| 작업 | 파일 |
|------|------|
| 생성 | `src/constants/agentNames.ts` |
| 생성 | `src/components/OverlayManager.tsx` |
| 생성 | `src/components/ResearchPanel.tsx` |
| 생성 | `src/components/AgentPanel.tsx` |
| 수정 | `src/office/engine/officeState.ts` — `getFurnitureAt` 추가 |
| 수정 | `src/components/OfficeCanvas.tsx` — 클릭/호버 이벤트, `onOverlayOpen` prop |
| 수정 | `public/assets/default-layout-1.json` — WHITEBOARD 추가 |
| 수정 | `src/App.tsx` — 상태 교체, 탭 UI 제거, OverlayManager 연결 |
| 수정 | `src/components/ChatPanel.tsx` — 오버레이 스타일 적용 |
| 수정 | `src/components/FeedPanel.tsx` — 오버레이 스타일 적용 |
| 수정 | `src/components/ProductionPanel.tsx` — 오버레이 스타일 적용 |

---

## Task 1: 에이전트 이름 상수 파일

**Files:**
- Create: `web/frontend/src/constants/agentNames.ts`

- [ ] **Step 1: 파일 생성**

```typescript
// web/frontend/src/constants/agentNames.ts

export const AGENT_DISPLAY_NAMES: Record<string, string> = {
  research_agent: '리서처',
  strategy_agent: '전략가',
  copy_agent: '카피라이터',
  script_agent: '스크립터',
  image_prompt_agent: '이미지 디렉터',
  format_agent: '포맷터',
  scanner_agent: '트렌드 스캐너',
};

export type OverlayType = 'chat' | 'production' | 'whiteboard' | string;
```

- [ ] **Step 2: TypeScript 컴파일 확인**

```bash
cd web/frontend && npx tsc --noEmit
```
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add web/frontend/src/constants/agentNames.ts
git commit -m "feat(ui): add agent display name constants and OverlayType"
```

---

## Task 2: officeState.ts — getFurnitureAt 메서드 추가

**Files:**
- Modify: `web/frontend/src/office/engine/officeState.ts` (760번째 줄 근처, 클래스 끝)

`getCatalogEntry`는 이미 파일 상단에서 import됨 (line 15). `TILE_SIZE`는 `../types.js`에서 import됨 (line 33).

- [ ] **Step 1: `getCharacterAt` 바로 앞에 `getFurnitureAt` 메서드 추가**

`getCharacterAt` 메서드(line 741) 바로 위에 다음을 삽입:

```typescript
  /** Get furniture base type at pixel position (for hit testing). Returns normalized type or null.
   *  PC variants (PC_FRONT_OFF, PC_SIDE, etc.) → 'PC'
   *  Other types returned as-is.
   */
  getFurnitureAt(worldX: number, worldY: number): string | null {
    const col = Math.floor(worldX / TILE_SIZE);
    const row = Math.floor(worldY / TILE_SIZE);
    for (const item of this.layout.furniture) {
      const entry = getCatalogEntry(item.type);
      const fw = entry?.footprintW ?? 1;
      const fh = entry?.footprintH ?? 1;
      if (col >= item.col && col < item.col + fw && row >= item.row && row < item.row + fh) {
        // Normalize PC variants to 'PC'
        return item.type.startsWith('PC') ? 'PC' : item.type;
      }
    }
    return null;
  }
```

- [ ] **Step 2: TypeScript 컴파일 확인**

```bash
cd web/frontend && npx tsc --noEmit
```
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add web/frontend/src/office/engine/officeState.ts
git commit -m "feat(office): add getFurnitureAt hit-test method"
```

---

## Task 3: 레이아웃 JSON에 WHITEBOARD 추가

**Files:**
- Modify: `web/frontend/public/assets/default-layout-1.json`

WHITEBOARD는 2×2 footprint, 벽 타일에 배치 가능. 현재 레이아웃 21×22타일. 상단 벽면 빈 공간(col:10, row:1)에 배치.

- [ ] **Step 1: furniture 배열에 WHITEBOARD 항목 추가**

`default-layout-1.json`의 `"furniture"` 배열 맨 뒤에 다음 항목 추가:

```json
{
  "uid": "f-whiteboard-001",
  "type": "WHITEBOARD",
  "col": 10,
  "row": 1
}
```

- [ ] **Step 2: 개발 서버 실행 후 시각 확인**

```bash
cd web/frontend && npm run dev
```

브라우저에서 오피스를 열어 화이트보드가 상단 벽에 표시되는지 확인. 위치가 이상하면 col/row 값을 조정.

- [ ] **Step 3: 커밋**

```bash
git add web/frontend/public/assets/default-layout-1.json
git commit -m "feat(layout): add WHITEBOARD to office layout"
```

---

## Task 4: OfficeCanvas — 클릭/호버 이벤트 추가

**Files:**
- Modify: `web/frontend/src/components/OfficeCanvas.tsx`

현재 props: `{ lastEvent?: WsEvent | null }`. `agentIdMap`은 모듈 레벨 Map(string→number). `ZOOM = 2` 상수. `stateRef.current`로 officeState 접근.

- [ ] **Step 1: props 타입에 콜백 추가**

파일 상단 import에 `OverlayType` 추가:
```typescript
import type { OverlayType } from '../constants/agentNames.js';
```

컴포넌트 props 타입 변경:
```typescript
interface OfficeCanvasProps {
  lastEvent?: WsEvent | null;
  onOverlayOpen: (type: OverlayType) => void;
}
```

함수 시그니처 변경:
```typescript
export function OfficeCanvas({ lastEvent, onOverlayOpen }: OfficeCanvasProps) {
```

- [ ] **Step 2: PC 메뉴 상태 추가**

컴포넌트 내부 상단(기존 state 선언 근처)에 추가:
```typescript
const [showPcMenu, setShowPcMenu] = useState(false);
```

- [ ] **Step 3: canvas에 onClick, onMouseMove 이벤트 추가**

`<canvas>` 태그에 다음 핸들러 추가:

```typescript
onClick={(e) => {
  const worldX = e.nativeEvent.offsetX / ZOOM;
  const worldY = e.nativeEvent.offsetY / ZOOM;

  // 캐릭터 클릭 먼저 확인
  const charId = stateRef.current?.getCharacterAt(worldX, worldY);
  if (charId !== null && charId !== undefined) {
    const agentName = Array.from(agentIdMap.entries()).find(([, id]) => id === charId)?.[0];
    if (agentName) {
      onOverlayOpen(agentName);
      return;
    }
  }

  // 가구 클릭 확인
  const furniture = stateRef.current?.getFurnitureAt(worldX, worldY);
  if (furniture === 'PC') {
    setShowPcMenu(true);
    return;
  }
  if (furniture === 'WHITEBOARD') {
    onOverlayOpen('whiteboard');
    return;
  }
}}
onMouseMove={(e) => {
  const worldX = e.nativeEvent.offsetX / ZOOM;
  const worldY = e.nativeEvent.offsetY / ZOOM;
  const charId = stateRef.current?.getCharacterAt(worldX, worldY);
  const furniture = stateRef.current?.getFurnitureAt(worldX, worldY);
  e.currentTarget.style.cursor = (charId !== null && charId !== undefined) || furniture ? 'pointer' : 'default';
}}
```

- [ ] **Step 4: PC 메뉴 팝업 JSX 추가**

`<canvas>` 태그를 `<div style={{ position: 'relative', display: 'inline-block' }}>` 로 감싸고, 그 안에 팝업 추가:

```tsx
<div style={{ position: 'relative', display: 'inline-block' }}>
  <canvas ref={canvasRef} onClick={...} onMouseMove={...} />
  {showPcMenu && (
    <div
      onClick={() => setShowPcMenu(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(18,26,49,0.95)',
          border: '1px solid rgba(255,255,255,0.15)',
          backdropFilter: 'blur(8px)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minWidth: 160,
          zIndex: 21,
        }}
      >
        <button
          onClick={() => { setShowPcMenu(false); onOverlayOpen('chat'); }}
          style={{
            background: 'transparent', border: '1px solid #2d3d69',
            color: 'rgba(255,255,255,0.85)', padding: '8px 12px',
            cursor: 'pointer', fontFamily: 'monospace', fontSize: 13,
          }}
        >
          💬 채팅
        </button>
        <button
          onClick={() => { setShowPcMenu(false); onOverlayOpen('production'); }}
          style={{
            background: 'transparent', border: '1px solid #2d3d69',
            color: 'rgba(255,255,255,0.85)', padding: '8px 12px',
            cursor: 'pointer', fontFamily: 'monospace', fontSize: 13,
          }}
        >
          ✍️ 직접 제작
        </button>
      </div>
    </div>
  )}
</div>
```

- [ ] **Step 5: TypeScript 컴파일 확인**

```bash
cd web/frontend && npx tsc --noEmit
```
Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add web/frontend/src/components/OfficeCanvas.tsx
git commit -m "feat(canvas): add click/hover hit-test and PC menu popup"
```

---

## Task 5: App.tsx — 상태 교체 및 탭 UI 제거

**Files:**
- Modify: `web/frontend/src/App.tsx`

- [ ] **Step 1: import 업데이트**

기존 import에서 `FeedPanel`, `ProductionPanel` 제거 후 새 컴포넌트 추가 (아직 없으니 일단 주석으로 예약):

```typescript
import type { OverlayType } from './constants/agentNames.js';
// 아래 컴포넌트는 Task 6~9에서 생성됨 — 미리 import 선언만
// import { OverlayManager } from './components/OverlayManager.js';
```

- [ ] **Step 2: 상태 교체**

기존:
```typescript
type Tab = 'chat' | 'feed' | 'production';
const [activeTab, setActiveTab] = useState<Tab>('chat');
const [newCardCount, setNewCardCount] = useState(0);
```

변경 후:
```typescript
const [openOverlays, setOpenOverlays] = useState<Set<OverlayType>>(new Set());
```

- [ ] **Step 3: 핸들러 교체**

기존 `handleTabChange` 삭제. 새 핸들러 추가:
```typescript
const handleOverlayOpen = useCallback((type: OverlayType) => {
  setOpenOverlays((prev) => new Set(prev).add(type));
}, []);

const handleOverlayClose = useCallback((type: OverlayType) => {
  setOpenOverlays((prev) => {
    const next = new Set(prev);
    next.delete(type);
    return next;
  });
}, []);
```

기존 `handleEvent`에서 `newCardCount` 관련 코드 제거:
```typescript
const handleEvent = useCallback((e: WsEvent) => {
  setEvents(e);
}, []);
```

- [ ] **Step 4: JSX 구조 교체**

기존 반환 JSX에서:
- 탭 헤더(`<div>` with `(['chat', 'feed', 'production'] as Tab[]).map(...)`) 삭제
- 오른쪽 패널 컨테이너 (`flex: 1` div) 삭제
- `OfficeCanvas`를 `position: absolute, inset: 0`으로 변경
- `onOverlayOpen` prop 전달

새 JSX 구조:
```tsx
return (
  <div style={{ width: '100vw', height: '100vh', background: 'radial-gradient(circle at top, #182341 0%, #0b1020 60%)', overflow: 'hidden', position: 'relative' }}>
    {/* 상단 바 */}
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 16px', borderBottom: '1px solid #2d3d69',
      background: 'rgba(11,16,32,0.8)', backdropFilter: 'blur(4px)',
    }}>
      <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}>Marketing Workspace</span>
      <button
        onClick={() => { void handleLogout(); }}
        style={{
          background: 'transparent', border: '1px solid #2d3d69',
          color: 'rgba(255,255,255,0.5)', padding: '4px 12px',
          cursor: 'pointer', fontFamily: 'monospace', fontSize: 13,
        }}
      >로그아웃</button>
    </div>

    {/* 오피스 캔버스 — 전체 배경 */}
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 40 }}>
      <OfficeCanvas
        lastEvent={lastEvent ?? events}
        onOverlayOpen={handleOverlayOpen}
      />
    </div>

    {/* 오버레이 매니저 — Task 6 완료 후 주석 해제 */}
    {/* <OverlayManager
      openOverlays={openOverlays}
      onClose={handleOverlayClose}
      lastEvent={lastEvent ?? events}
      wsStatus={status}
      onSend={handleSend}
      onApprove={handleApprove}
      onFeedback={handleFeedback}
      onCancel={handleCancel}
    /> */}
  </div>
);
```

- [ ] **Step 5: TypeScript 컴파일 + 실행 확인**

```bash
cd web/frontend && npx tsc --noEmit
npm run dev
```

브라우저에서 오피스가 화면 전체를 채우는지 확인. 탭 UI가 사라졌는지 확인. PC/WHITEBOARD/캐릭터 클릭 시 콘솔에 이벤트가 찍히는지 확인 (OverlayManager는 아직 없으므로 아무것도 열리지 않는 게 정상).

- [ ] **Step 6: 커밋**

```bash
git add web/frontend/src/App.tsx
git commit -m "feat(app): replace tab state with openOverlays, remove tab UI"
```

---

## Task 6: OverlayManager 컴포넌트 생성

**Files:**
- Create: `web/frontend/src/components/OverlayManager.tsx`

이 컴포넌트는 `openOverlays` Set을 받아 열린 패널들을 화면 우측에서 슬라이드 형태로 렌더링한다.

- [ ] **Step 1: 컴포넌트 생성**

```tsx
// web/frontend/src/components/OverlayManager.tsx
import type { WsEvent } from '../hooks/useWebSocket.js';
import type { OverlayType } from '../constants/agentNames.js';
import { ChatPanel } from './ChatPanel.js';
import { FeedPanel } from './FeedPanel.js';
import { ProductionPanel } from './ProductionPanel.js';
import { ResearchPanel } from './ResearchPanel.js';
import { AgentPanel } from './AgentPanel.js';

interface OverlayManagerProps {
  openOverlays: Set<OverlayType>;
  onClose: (type: OverlayType) => void;
  lastEvent: WsEvent | null;
  wsStatus: string;
  onSend: (msg: string) => void;
  onApprove: () => void;
  onFeedback: (msg: string) => void;
  onCancel: () => void;
}

const OVERLAY_WIDTH = 380;
const PANEL_GAP = 12;

const OVERLAY_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 48, // 상단 바 높이만큼 여백
  bottom: 0,
  width: OVERLAY_WIDTH,
  background: 'rgba(18,26,49,0.88)',
  border: '1px solid rgba(255,255,255,0.1)',
  backdropFilter: 'blur(8px)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

function PanelWrapper({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ ...OVERLAY_STYLE }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{title}</span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent', border: 'none',
            color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
            fontSize: 16, lineHeight: 1, padding: '2px 6px',
          }}
        >×</button>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 12 }}>
        {children}
      </div>
    </div>
  );
}

export function OverlayManager({
  openOverlays, onClose, lastEvent, wsStatus, onSend, onApprove, onFeedback, onCancel,
}: OverlayManagerProps) {
  const overlays = Array.from(openOverlays);
  if (overlays.length === 0) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
      {overlays.map((type, idx) => {
        const rightOffset = PANEL_GAP + idx * (OVERLAY_WIDTH + PANEL_GAP);
        const panelStyle: React.CSSProperties = {
          ...OVERLAY_STYLE,
          right: rightOffset,
          pointerEvents: 'auto',
        };

        const close = () => onClose(type);

        if (type === 'chat') {
          return (
            <div key={type} style={panelStyle}>
              <PanelWrapper title="채팅" onClose={close}>
                <ChatPanel
                  wsStatus={wsStatus}
                  lastEvent={lastEvent}
                  onSend={onSend}
                  onApprove={onApprove}
                  onFeedback={onFeedback}
                  onCancel={onCancel}
                />
              </PanelWrapper>
            </div>
          );
        }
        if (type === 'production') {
          return (
            <div key={type} style={panelStyle}>
              <PanelWrapper title="직접 제작" onClose={close}>
                <ProductionPanel />
              </PanelWrapper>
            </div>
          );
        }
        if (type === 'whiteboard') {
          return (
            <div key={type} style={panelStyle}>
              <PanelWrapper title="리서치" onClose={close}>
                <ResearchPanel />
              </PanelWrapper>
            </div>
          );
        }
        if (type === 'opportunity') {
          return (
            <div key={type} style={panelStyle}>
              <PanelWrapper title="기회 카드" onClose={close}>
                <FeedPanel lastEvent={lastEvent} />
              </PanelWrapper>
            </div>
          );
        }
        // 에이전트 패널 (strategy_agent 포함)
        return (
          <div key={type} style={panelStyle}>
            <AgentPanel agentName={type} lastEvent={lastEvent} onClose={close} />
          </div>
        );
      })}
    </div>
  );
}
```

**참고:** `PanelWrapper`가 `OVERLAY_STYLE`을 적용하고, 바깥 `div`에도 `panelStyle`을 적용하면 중복이 된다. `PanelWrapper`에서는 `position/right/bottom` 없이 내부 레이아웃만 담당하도록 수정:

`PanelWrapper`의 `style`에서 `position`, `top`, `bottom`, `width` 제거하고 대신 `flex: 1`, `display: flex`, `flexDirection: column`, `overflow: hidden`만 유지. 바깥 `div`(panelStyle)가 위치/크기를 담당.

최종 구조:
```tsx
// panelStyle을 가진 바깥 div가 위치/크기 담당
// PanelWrapper는 헤더(타이틀+닫기버튼) + 내용 레이아웃만 담당
<div key={type} style={panelStyle}>
  <div style={{ /* 헤더 */ }}>...</div>
  <div style={{ flex: 1, overflow: 'hidden', padding: 12 }}>
    {/* 패널 컴포넌트 */}
  </div>
</div>
```

- [ ] **Step 2: App.tsx에서 OverlayManager import 주석 해제**

`App.tsx`에서:
```typescript
import { OverlayManager } from './components/OverlayManager.js';
```
주석 해제 및 JSX에서 `<OverlayManager ... />` 주석 해제.

- [ ] **Step 3: strategy_agent 클릭 시 'opportunity' 오버레이 열도록 처리**

`App.tsx`의 `handleOverlayOpen`에서 전략가 클릭을 기회 카드로 매핑:
```typescript
const handleOverlayOpen = useCallback((type: OverlayType) => {
  // 전략가 클릭 → 기회 카드 뷰
  const resolved = type === 'strategy_agent' ? 'opportunity' : type;
  setOpenOverlays((prev) => new Set(prev).add(resolved));
}, []);
```

- [ ] **Step 4: TypeScript 컴파일 + 실행 확인**

```bash
cd web/frontend && npx tsc --noEmit
npm run dev
```

브라우저에서:
- PC 클릭 → 팝업 → "채팅" 클릭 → 채팅 패널 우측에 슬라이드 등장
- WHITEBOARD 클릭 → 리서치 패널 등장 (ResearchPanel은 Task 7에서 구현, 지금은 빈 화면 정상)
- 닫기(×) 버튼으로 닫힘 확인

- [ ] **Step 5: 커밋**

```bash
git add web/frontend/src/components/OverlayManager.tsx web/frontend/src/App.tsx
git commit -m "feat(ui): add OverlayManager with slide-in overlay panels"
```

---

## Task 7: ResearchPanel 컴포넌트 생성

**Files:**
- Create: `web/frontend/src/components/ResearchPanel.tsx`

API: `GET /api/research/archive` → `{ items: ResearchItem[] }`
API: `GET /api/research/archive/{file_id}` → 상세 데이터

- [ ] **Step 1: 타입 정의 및 컴포넌트 생성**

```tsx
// web/frontend/src/components/ResearchPanel.tsx
import { useEffect, useState } from 'react';

interface ResearchItem {
  id: string;
  title?: string;
  summary?: string;
  created_at?: string;
  [key: string]: unknown;
}

interface ResearchDetail {
  [key: string]: unknown;
}

export function ResearchPanel() {
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [selected, setSelected] = useState<ResearchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    void fetch('/api/research/archive', { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { items: ResearchItem[] }) => {
        setItems(data.items ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const loadDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const r = await fetch(`/api/research/archive/${id}`, { credentials: 'include' });
      const data = await r.json() as ResearchDetail;
      setSelected(data);
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return <div style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: 13 }}>로딩 중...</div>;
  }

  if (selected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
        <button
          onClick={() => setSelected(null)}
          style={{
            alignSelf: 'flex-start', background: 'transparent',
            border: '1px solid #2d3d69', color: 'rgba(255,255,255,0.6)',
            padding: '4px 10px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 12,
          }}
        >
          ← 목록으로
        </button>
        <div style={{ flex: 1, overflow: 'auto', color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {detailLoading ? '로딩 중...' : JSON.stringify(selected, null, 2)}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return <div style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: 13 }}>리서치 데이터가 없습니다.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflow: 'auto', height: '100%' }}>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => { void loadDetail(item.id); }}
          style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.75)', padding: '10px 12px',
            cursor: 'pointer', fontFamily: 'monospace', fontSize: 12,
            textAlign: 'left', flexShrink: 0,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {item.title ?? item.id}
          </div>
          {item.summary && (
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {item.summary}
            </div>
          )}
          {item.created_at && (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 4 }}>
              {String(item.created_at)}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript 컴파일 + 실행 확인**

```bash
cd web/frontend && npx tsc --noEmit
npm run dev
```

WHITEBOARD 클릭 → 리서치 패널에 목록이 표시되는지 확인. 항목 클릭 → 상세 내용 표시 확인.

- [ ] **Step 3: 커밋**

```bash
git add web/frontend/src/components/ResearchPanel.tsx
git commit -m "feat(ui): add ResearchPanel with list and detail view"
```

---

## Task 8: AgentPanel 컴포넌트 생성

**Files:**
- Create: `web/frontend/src/components/AgentPanel.tsx`

에이전트별 작업 현황 패널. WebSocket 이벤트를 필터링하여 해당 에이전트의 이벤트만 표시.

- [ ] **Step 1: 컴포넌트 생성**

```tsx
// web/frontend/src/components/AgentPanel.tsx
import { useEffect, useRef, useState } from 'react';
import { AGENT_DISPLAY_NAMES } from '../constants/agentNames.js';
import type { WsEvent } from '../hooks/useWebSocket.js';

interface AgentPanelProps {
  agentName: string;
  lastEvent: WsEvent | null;
  onClose: () => void;
}

interface AgentLog {
  time: string;
  text: string;
  type: 'started' | 'completed' | 'error' | 'info';
}

function formatTime() {
  return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function AgentPanel({ agentName, lastEvent, onClose }: AgentPanelProps) {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [isActive, setIsActive] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const displayName = AGENT_DISPLAY_NAMES[agentName] ?? agentName;

  useEffect(() => {
    if (!lastEvent) return;
    if ('agent' in lastEvent && lastEvent.agent !== agentName) return;

    if (lastEvent.type === 'agent_started' && lastEvent.agent === agentName) {
      setIsActive(true);
      setLogs((prev) => [...prev, { time: formatTime(), text: '작업 시작', type: 'started' }]);
    } else if (lastEvent.type === 'agent_completed' && lastEvent.agent === agentName) {
      setIsActive(false);
      const text = lastEvent.error
        ? `오류: ${lastEvent.error}`
        : `완료 (${Math.round(lastEvent.elapsed_ms / 1000)}초)`;
      setLogs((prev) => [...prev, { time: formatTime(), text, type: lastEvent.error ? 'error' : 'completed' }]);
    }
  }, [lastEvent, agentName]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const logColor = {
    started: '#60a5fa',
    completed: '#34d399',
    error: '#f87171',
    info: 'rgba(255,255,255,0.5)',
  };

  return (
    <div style={{
      position: 'absolute', top: 48, bottom: 0, right: 0,
      width: 380,
      background: 'rgba(18,26,49,0.88)',
      border: '1px solid rgba(255,255,255,0.1)',
      backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      pointerEvents: 'auto',
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
            {displayName}
          </span>
          {isActive && (
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#34d399', display: 'inline-block',
              animation: 'pulse 1.5s infinite',
            }} />
          )}
        </div>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 16, padding: '2px 6px' }}
        >×</button>
      </div>

      {/* 로그 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {logs.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', fontSize: 12 }}>
            아직 활동 없음
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontFamily: 'monospace', fontSize: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{log.time}</span>
              <span style={{ color: logColor[log.type] }}>{log.text}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript 컴파일 + 실행 확인**

```bash
cd web/frontend && npx tsc --noEmit
npm run dev
```

에이전트 캐릭터 클릭 → 해당 에이전트 패널 표시 확인. 에이전트 작업 중 이벤트가 로그에 찍히는지 확인.

- [ ] **Step 3: 커밋**

```bash
git add web/frontend/src/components/AgentPanel.tsx
git commit -m "feat(ui): add AgentPanel showing per-agent event log"
```

---

## Task 9: 기존 패널 오버레이 스타일 적용

**Files:**
- Modify: `web/frontend/src/components/ChatPanel.tsx`
- Modify: `web/frontend/src/components/FeedPanel.tsx`
- Modify: `web/frontend/src/components/ProductionPanel.tsx`

이 컴포넌트들은 `OverlayManager`의 패널 컨텐츠 영역(`flex: 1, overflow: hidden, padding: 12`)에서 렌더링된다. 현재 컴포넌트가 자체적으로 배경/테두리/위치를 잡고 있다면, OverlayManager 안에서 중복 스타일이 생길 수 있다.

- [ ] **Step 1: 각 컴포넌트 최상위 wrapper에서 배경/테두리/위치 관련 스타일 제거**

각 파일을 열어 최상위 `<div>`의 스타일에서 다음 속성 제거 (있는 경우에만):
- `background`
- `border`
- `position: absolute/fixed`
- `width`, `height` (명시적 px 고정값)

`flex: 1`이나 `overflow: auto/hidden`은 유지.

- [ ] **Step 2: 개발 서버에서 전체 동작 최종 확인**

```bash
npm run dev
```

전체 흐름 확인:
1. 로그인 후 오피스 전체 화면 표시
2. PC 클릭 → 팝업 → 채팅 선택 → 채팅 패널 등장
3. PC 클릭 → 팝업 → 직접 제작 선택 → 제작 패널 등장
4. WHITEBOARD 클릭 → 리서치 패널 등장 (목록 표시)
5. 에이전트 캐릭터 클릭 → 에이전트 패널 등장
6. 전략가 클릭 → 기회 카드 패널 등장
7. 각 패널 닫기(×) 버튼 동작
8. 여러 패널 동시에 열기 가능
9. 로그아웃 버튼 동작

- [ ] **Step 3: 최종 커밋**

```bash
git add web/frontend/src/components/ChatPanel.tsx web/frontend/src/components/FeedPanel.tsx web/frontend/src/components/ProductionPanel.tsx
git commit -m "feat(ui): refactor panels for overlay container compatibility"
```

---

## 완료 기준

- [ ] 탭 UI 완전 제거됨
- [ ] 오피스가 화면 전체를 채움
- [ ] PC 클릭 → 채팅/제작 선택 팝업 동작
- [ ] WHITEBOARD 클릭 → 리서치 패널 (API 데이터 표시)
- [ ] 전략가 클릭 → 기회 카드 패널
- [ ] 나머지 에이전트 클릭 → 에이전트별 작업 현황 패널
- [ ] 여러 패널 동시에 열림
- [ ] 각 패널 닫기 버튼 동작
- [ ] TypeScript 컴파일 에러 없음
