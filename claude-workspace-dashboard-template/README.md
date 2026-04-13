# 📋 Claude 워크스페이스 대시보드

내 `~/.claude/` 디렉토리 (에이전트 / 스킬 / 훅 / 플러그인 / 세션 / 프로젝트) 를 한 화면에서 보고 정리하는 로컬 대시보드.

> **읽기 전용** — 화면에 편집/저장 버튼이 보여도 실제 파일은 절대 안 건드립니다. 안심하고 켜놔도 OK.

## 한눈에 보이는 것

- 🎯 하네스 건강 점수 (0–100) + ✓CLAUDE.md / ✓권한 / ✓Hook / ✓에이전트 / ✓스킬 / ✓커넥터 / ✓플러그인 7 항목
- ⚡ 스킬 / 🤖 에이전트 / 🪝 Hook / 🔗 커넥터 / 🔌 플러그인 / 📁 프로젝트 / ✅ 태스크 / 💬 세션 카운트
- 🖥️ 실행 중 세션 (디바이스별 그룹)
- 💻 디바이스별 작업 현황 (cwd 기반 맥미니/맥북 분류)
- 📊 오늘의 명령 수 + 활성 프로젝트
- ⏰ 예약된 작업 + 진행 중 태스크 + 서브태스크 진행률
- 📁 최근 프로젝트 작업 요약 (첫 요청 / 마지막 결과)
- ⚠️ 승인 대기 중 작업 (활성 세션의 마지막 tool_use 기반)

사이드바 14 탭 — 브리핑 / 지침 / 스킬 / 커넥터 / 훅 / 에이전트 / 플러그인 / 설정 / 가이드 / 모니터 / 능력 맵 / 하네스 / 도우미 / 전체 그리드

---

## 시작하기 (1 단계)

```bash
python3 server.py
```

브라우저에서 **http://localhost:8080** 열기. 끝.

> macOS에 기본 Python 3.9+ 가 있으면 추가 설치 0개. 외부 의존성 없음 (Python 표준 라이브러리만).

또는 한 줄 실행 스크립트:

```bash
./start.sh
```

---

## 폴더 구조

```
claude-workspace-dashboard-template/
├── server.py                       # Python 백엔드 (단일 파일)
├── start.sh                        # 실행 스크립트
├── dist/                           # 빌드된 React SPA (수정 불필요)
│   ├── index.html
│   └── assets/index-DYwNDC3K.js
├── docs/
│   └── CLAUDE-CODE-GUIDE.md        # Claude Code로 사용/확장하는 법
└── README.md                       # 이 파일
```

---

## 데이터 소스 (전부 `~/.claude/` 안)

| 카드 | 데이터 위치 |
|---|---|
| 하네스 점수 / 권한 / Hook | `~/.claude/settings.json` |
| 에이전트 | `~/.claude/agents/*.md` (frontmatter: name, description, model, tools) |
| 스킬 | `~/.claude/skills/*/SKILL.md` |
| 플러그인 | `~/.claude/plugins/installed_plugins.json` + `enabledPlugins` |
| 커넥터 (MCP) | `~/.claude.json` 의 `mcpServers` |
| 글로벌 지침 | `~/.claude/CLAUDE.md` |
| 프로젝트 | `~/.claude/projects/<encoded>/` |
| 활성 세션 | `~/.claude/sessions/*.json` |
| 예약 작업 | `~/.claude/scheduled-tasks/*/SKILL.md` |
| 태스크 + 서브태스크 | `~/.claude/tasks/*/{1,2,3}.json` |
| 오늘 명령 수 / 디바이스 / 최근 프로젝트 요약 | `~/.claude/history.jsonl` |
| 승인 대기 | `~/.claude/projects/*/{sessionId}.jsonl` 의 마지막 `assistant.tool_use` |

→ **자기 ~/.claude/ 만 있으면 자동으로 다 채워짐.** 별도 설정 0개.

---

## 안전 동작 (중요)

이 대시보드는 **read-only mock** 백엔드입니다.

- 화면의 "글로벌 지침 저장", "+ 새 스킬", "settings 저장", "삭제", "전체 자동 최적화" 등 **모든 편집 버튼은 무동작**
- HTTP PUT / POST / DELETE 는 200 OK 만 반환하고 **실제 파일은 절대 수정하지 않음**
- 화면에 "저장되었습니다" 토스트가 떠도 ~/.claude 는 그대로
- 단 두 가지 예외:
  - **`/api/open-folder` POST** — 폴더 버튼 클릭 시 macOS Finder 에서 해당 경로 열기 (read 동작이므로 안전)
  - **read 동작은 모두 작동** (스캔, 표시)
- 보안: open-folder 는 사용자 홈 디렉토리(`~/`) 하위 경로만 허용 (path traversal 차단)

→ 안심하고 켜놔도 됩니다. 실수로 클릭해도 데이터 변경 0건.

---

## UI/UX

- 🌑 다크 OLED 테마 (zinc 베이스, violet 강조 #a78bfa)
- 한글 폰트: **Pretendard Variable** (jsdelivr CDN, 자동 fallback)
- 모노스페이스: JetBrains Mono → Fira Code
- 카드 hover 마이크로 인터랙션 (220ms cubic-bezier)
- 작업중 / 승인 대기 dot 펄스 애니메이션
- WCAG focus-visible (amber outline)
- `prefers-reduced-motion` 존중

---

## 한글 라벨

- 영어로 된 71 개 에이전트 + 102 개 스킬을 모두 한글 라벨로 매핑 (예: `code-architect` → "코드 설계자", `cpp-build-resolver` → "C++ 빌드 해결사", `gsd-roadmapper` → "GSD 로드맵 작성기")
- 매핑은 `dist/assets/index-DYwNDC3K.js` 안의 `Fl` (에이전트) + `bn` (스킬) dict 에 정의됨

---

## 한계 + 트레이드오프

### 1. 데이터가 휴리스틱인 영역

- **맥북/맥미니 분류**: cwd 가 `/Users/<user>` 자체이면 맥미니, 그 외는 맥북. 진짜 디바이스 정보 아님 (`.stignore` 로 sessions/history 동기화 제외라 단일 디바이스 데이터만 존재)
- **승인 대기 카드**: 영구 저장 안 되는 권한 큐 대신, 활성 세션 jsonl 의 마지막 tool_use 를 추정
- **추천 settings 프로필**: 정적 4개 (균형형/개발자형/안전 우선/탐색 모드)

### 2. 빈 카드 (의도적)

- `/api/briefing/activity` 의 `activities`, `briefing/pending-approvals` 의 `approvals` 같은 일부 키는 빈 배열 (데이터 소스 없음)

### 3. 자동 갱신 비대칭

- 브리핑 탭만 30 초 polling
- 다른 탭은 새로고침 버튼 / 페이지 reload 필요

### 4. 외부 의존

- Pretendard 폰트는 jsdelivr CDN. 오프라인이면 시스템 폰트로 fallback (한글 가독성 ↓). 자체 호스트 원하면 `dist/fonts/` 에 폰트 복사 후 `dist/index.html` 의 `<link>` 경로 변경

---

## 트러블슈팅

| 증상 | 원인 + 해결 |
|---|---|
| `Address already in use` | 8080 포트 점유. `lsof -ti:8080 \| xargs kill` |
| 빈 화면 / 에러 | `python3 --version` 확인 (3.9 이상). 그 후 `python3 server.py` 다시 |
| 카드가 "—" 또는 "데이터 없음" | `~/.claude/` 안의 해당 디렉토리/파일이 없음 (정상) |
| 폴더 버튼 안 됨 | `open` 명령이 PATH 에 없거나 sandbox 환경. 터미널에서 `open ~/.claude/skills` 가 되는지 확인 |
| 한글 폰트 깨짐 | 인터넷 연결 확인 (Pretendard CDN). 또는 시스템 폰트 fallback |
| 승인 대기 카드가 실시간 권한 요청과 안 맞음 | 의도된 한계 — 활성 세션 jsonl 마지막 tool_use 기반 휴리스틱 |

---

## 다른 사람에게 공유하기

이 폴더 통째로 압축해서 공유:

```bash
cd ~/Desktop
tar czf claude-workspace-dashboard.tar.gz claude-workspace-dashboard-template/
```

받은 사람:
1. 압축 해제
2. `cd claude-workspace-dashboard-template && python3 server.py`
3. http://localhost:8080

→ 자기 `~/.claude/` 데이터가 자동으로 로드됨.

---

## 라이선스

자유 사용. 본인 환경 시각화 도구.

---

## Claude Code 로 더 작업하기

`docs/CLAUDE-CODE-GUIDE.md` 참고. Claude Code 에서 이 템플릿을 열고 새 카드 / endpoint / 데이터 소스 추가하는 방법.
