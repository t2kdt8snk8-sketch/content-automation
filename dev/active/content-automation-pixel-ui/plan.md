# Content Automation — Pixel Office UI 전환 계획

**참고 레포**: https://github.com/pablodelucca/pixel-agents (MIT 라이선스)  
**목표**: 기존 `index.html` → React + Canvas 픽셀 오피스 UI로 전환  
**백엔드**: 변경 없음 (FastAPI + `/ws` WebSocket 그대로)

---

## 핵심 결정사항

### pixel-agents 코드/에셋 재사용 범위

MIT 라이선스이므로 **그대로 복사 가능**. 저작권 표시만 유지하면 됨.

| 항목 | 재사용 방식 |
|---|---|
| `webview-ui/public/characters.png` | 스프라이트 시트 그대로 복사 |
| `webview-ui/src/office/sprites/spriteData.ts` | 그대로 복사 |
| `webview-ui/src/office/sprites/spriteCache.ts` | 그대로 복사 |
| `webview-ui/src/office/engine/renderer.ts` | 그대로 복사 후 수정 |
| `webview-ui/src/office/engine/characters.ts` | 그대로 복사 후 수정 |
| `webview-ui/src/office/engine/gameLoop.ts` | 그대로 복사 |
| `webview-ui/src/office/engine/officeState.ts` | 그대로 복사 후 수정 |
| `webview-ui/package.json` 의존성 | 그대로 사용 (React 19, Vite 8, Tailwind v4) |

**제거 대상** (VS Code 전용):
- `vscodeApi.ts` — WebSocket으로 교체
- `browserMock.ts` — 불필요
- `hooks/useExtensionMessages.ts` — `useWebSocket.ts`로 교체
- `hooks/useEditorActions.ts` — 편집 모드 불필요하면 제거

---

## 디렉토리 구조

```
content-automation/web/
├── frontend/                        ← React 앱 (여기서 개발)
│   ├── package.json
│   ├── vite.config.ts               ← 빌드 출력: ../static/
│   ├── public/
│   │   └── characters.png           ← pixel-agents에서 복사
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                  ← 로그인 게이트 + 메인 레이아웃
│       ├── index.css
│       ├── components/
│       │   ├── LoginScreen.tsx      ← 기존 로그인 UI 이식
│       │   ├── OfficeCanvas.tsx     ← 캔버스 컴포넌트
│       │   └── ChatPanel.tsx        ← 입력 + 결과 + 승인/피드백
│       ├── hooks/
│       │   └── useWebSocket.ts      ← /ws 연결, 이벤트 파싱
│       └── office/
│           ├── engine/
│           │   ├── officeState.ts   ← pixel-agents에서 복사+수정
│           │   ├── renderer.ts      ← pixel-agents에서 복사+수정
│           │   ├── characters.ts    ← pixel-agents에서 복사+수정
│           │   └── gameLoop.ts      ← pixel-agents에서 그대로 복사
│           └── sprites/
│               ├── spriteData.ts    ← pixel-agents에서 그대로 복사
│               ├── spriteCache.ts   ← pixel-agents에서 그대로 복사
│               └── index.ts
└── static/                          ← FastAPI가 서빙 (빌드 결과물)
    └── index.html                   ← npm run build 시 자동 생성
```

---

## FastAPI 연동 방식

`app.py` 수정 없음. 현재:
- `app.mount("/static", ...)` → `web/static/` 폴더 서빙
- `GET /` → `web/static/index.html` 반환

Vite 빌드 출력을 `web/static/`으로 설정하면 끝.

```ts
// vite.config.ts
build: {
  outDir: '../static',
  emptyOutDir: true,
}
```

---

## 에이전트 ↔ 캐릭터 매핑

| 에이전트 | 캐릭터 | 유휴 | 작업 중 |
|---|---|---|---|
| `research_agent` | 파랑 | 오피스 배회 | 책상 앉아서 타이핑 |
| `copy_agent` | 노랑 | 오피스 배회 | 책상 앉아서 타이핑 |
| `image_prompt_agent` | 보라 | 오피스 배회 | 책상 앉아서 타이핑 |
| `script_agent` | 빨강 | 오피스 배회 | 책상 앉아서 타이핑 |
| `format_agent` | 초록 | 오피스 배회 | 책상 앉아서 타이핑 |

---

## WebSocket 이벤트 → 캐릭터 상태

백엔드가 이미 이 이벤트들을 보내고 있음:

```
mode             → 워크플로우/채팅 모드 표시
plan_step        → agents[] 목록 → 해당 캐릭터 깜빡임 (준비 상태)
agent_started    → agent 이름 → 해당 캐릭터 책상으로 이동 + 타이핑 시작
agent_completed  → agent 이름, elapsed_ms → 타이핑 멈춤, 완료 표시 (✓)
workflow_completed → 전체 캐릭터 완료 연출, 결과 패널에 출력
workflow_failed  → 실패 표시
chat_completed   → 채팅 결과 패널에 출력
```

---

## 화면 레이아웃

```
┌──────────────────────────────────────────────────────────┐
│ Marketing Workspace                          [로그아웃]   │
├────────────────────────────┬─────────────────────────────┤
│                            │                             │
│    픽셀 오피스 캔버스       │        채팅 패널            │
│   (characters.png 스프라이트│                             │
│    5명 캐릭터, 5개 책상)    │  [이전 결과 / 대화 히스토리] │
│                            │                             │
│                            │  ─────────────────────────  │
│                            │  [입력창]         [전송]    │
│                            │  [승인] [피드백]  (워크플로우│
│                            │                   실행 중일 때)│
└────────────────────────────┴─────────────────────────────┘
```

---

## 작업 순서

### Phase 1 — 프로젝트 세팅
- [ ] `web/frontend/` 폴더 생성
- [ ] `package.json` 작성 (pixel-agents webview-ui 기준)
- [ ] `vite.config.ts` 작성 (출력: `../static/`)
- [ ] `tsconfig.json`, `eslint.config.mjs` 작성
- [ ] `npm install`

### Phase 2 — pixel-agents 에셋/엔진 복사
- [ ] `characters.png` → `public/` 복사
- [ ] `office/sprites/` 전체 복사 (`spriteData.ts`, `spriteCache.ts`)
- [ ] `office/engine/` 전체 복사 (`officeState.ts`, `renderer.ts`, `characters.ts`, `gameLoop.ts`)

### Phase 3 — VS Code API → WebSocket 교체
- [ ] `hooks/useWebSocket.ts` 작성
  - `/ws?token=...` 연결
  - 이벤트 파싱 및 상태 업데이트
- [ ] `officeState.ts` 수정: VS Code 메시지 대신 WebSocket 이벤트 반응
- [ ] `renderer.ts` 수정: 에이전트 5명으로 고정 (VS Code 터미널 개념 제거)

### Phase 4 — UI 컴포넌트
- [ ] `LoginScreen.tsx` 작성 (기존 login UI 이식)
- [ ] `OfficeCanvas.tsx` 작성 (Canvas + 게임루프)
- [ ] `ChatPanel.tsx` 작성 (입력 + 결과 + 승인/피드백 버튼)
- [ ] `App.tsx` 작성 (로그인 게이트 + 레이아웃)

### Phase 5 — 통합 및 빌드
- [ ] `npm run build` → `web/static/` 생성 확인
- [ ] FastAPI 서버 실행 후 전체 플로우 테스트
- [ ] 기존 `index.html` 백업 후 교체 확인

---

## 주요 변경 파일 요약

| 파일 | 작업 |
|---|---|
| `web/frontend/` | 신규 생성 (React 앱 전체) |
| `web/static/index.html` | 빌드 결과로 교체 (자동) |
| `web/app.py` | **변경 없음** |
| `core/`, `agents/` 등 백엔드 | **변경 없음** |

---

## 참고

- pixel-agents 원본: https://github.com/pablodelucca/pixel-agents
- 라이선스: MIT (Copyright 2026 Pablo De Lucca)
- 스프라이트 시트: `webview-ui/public/characters.png` (4.2KB)
- 핵심 엔진 파일: `webview-ui/src/office/engine/` (6개 파일)
