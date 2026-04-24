# Viral Content Analyzer

숏폼 콘텐츠(릴스, 유튜브 숏츠) 및 블로그 URL을 분석해서 바이럴 요인을 파악하고,
그 포맷 기반으로 콘텐츠 초안을 자동 생성하는 웹 앱.

사용자가 URL을 던지면 → AI가 왜 떴는지 분석 → 그 포맷으로 콘텐츠 초안 생성.

---

## 기술 스택

- **프레임워크:** Next.js (App Router)
- **DB:** Supabase
- **분석 AI:** Gemini API (영상 분석, 텍스트 스크래핑 분석)
- **생성 AI:** Claude API (콘텐츠 초안 생성)
- **영상 다운로드:** yt-dlp (YouTube Shorts), instaloader (Instagram Reels)
- **배포:** Railway (yt-dlp/instaloader 바이너리 실행 필요, Vercel 불가)

---

## 입력

- 인스타그램 릴스 URL
- 유튜브 숏츠 URL
- 블로그 URL

URL 타입 자동 감지 후 처리 분기:
- YouTube Shorts → yt-dlp로 다운로드 → Gemini Files API 업로드 → 분석
- Instagram Reels → instaloader + 세션 쿠키로 다운로드 → Gemini Files API 업로드 → 분석
- 블로그 → 서버사이드 텍스트 스크래핑 → Gemini 분석

인스타 세션 쿠키는 Railway 환경변수로 주입 (로컬에서 1회 추출).

---

## 분석 항목

- 왜 떴는지 (바이럴 메커니즘)
- 참신함 분석 (어떤 요소가 차별화됐는지)
- 포맷 구조 (편집 리듬, 훅 구조, 정보 전달 방식)

추후 RAG 연결 예정: 마케팅/심리학 이론 문서 기반으로 분석 고도화

---

## 출력

- 분석 결과
- 콘텐츠 초안 (분석된 포맷 기반)

---

## 페이지 구조

한 페이지, 모바일 우선, 위→아래 스크롤. 히스토리는 사이드 패널로 별도 열림.

---

## UX 흐름 (사용자 여정)

### 진입
랜딩 → 로그인/회원가입 → 메인 화면

### 메인 화면 (한 페이지 스크롤)

**① URL 입력창**
- URL 붙여넣기 → 제출
- URL 타입 자동 감지 (릴스/숏츠/블로그)

**② 분석 결과** ← URL 제출 후 펼쳐짐
- 카드 형태 대시보드
- AI가 확신하는 항목만 카드로 표시 (null이면 카드 없음)
- 분석 카테고리:
  - `viral_mechanism` — 왜 퍼졌는지, 공유 동기
  - `hook_structure` — 첫 3초 어떻게 잡았는지
  - `format_structure` — 편집 리듬, 정보 전달 순서
  - `novelty_point` — 뭐가 차별화됐는지
  - `emotion_trigger` — 어떤 감정 유발했는지
  - `target_audience` — 누구한테 먹히는 콘텐츠인지

**③ 각도 선정** ← 분석 완료 후 펼쳐짐
- 포맷은 그대로, 소재(각도)만 살짝 다르게
- AI가 각도 3~5개 추천 (분석된 포맷 기반)
- 유저가 선택하거나 직접 수정/입력 가능
- "각도 재추천" 버튼 (분석 유지, 각도만 다시 생성)
- "초안 생성" 버튼

**④ 콘텐츠 초안** ← 각도 확정 후 펼쳐짐
- AI 생성 초안
- 유저가 직접 편집 가능 (텍스트 에디터)
- "초안 재생성" 버튼 (같은 각도로 다시 생성)
- 복사/저장 버튼 → Supabase 저장

### 히스토리 패널
- 별도 버튼으로 슬라이드 패널 열림
- 이전 분석 카드 목록 (URL, 각도, 날짜)
- 카드 탭 → 해당 분석 결과 불러와서 메인 화면에 표시
- 불러온 분석으로 새 각도/초안 생성 가능 (재활용)

### 로딩 상태
- 단계별 진행 표시: "영상 다운로드 중 → 분석 중 → 각도 추천 중 → 초안 생성 중"
- 분석 완료 후 자동으로 해당 섹션으로 스크롤

### 엣지케이스
- 영상 길이 제한: Gemini Files API 한도 초과 시 "영상이 너무 깁니다" 안내
- 분석 도중 이탈: 저장 안 됨, 돌아오면 처음부터
- 로그인 필수: 비로그인 상태에서 분석 시도 시 로그인 유도 (게스트 없음)

---

## 디자인

- 화이트 베이스
- 모바일 우선 (세로 스크롤)
- 깔끔하고 심플하게

---

## API 호출 순서 및 에러 처리

모든 API 호출은 Next.js API Route 서버사이드에서만 실행 (API 키 클라이언트 노출 금지).

### 호출 순서

1. **URL 타입 감지** — 클라이언트 regex, API 없음
   - 실패: 지원 안 되는 URL → 즉시 에러 표시

2. **영상 다운로드** — API Route에서 shell 호출
   - YouTube Shorts → yt-dlp
   - Instagram Reels → instaloader (세션 쿠키 Railway 환경변수)
   - 실패: 비공개/차단 → "접근 불가" 안내
   - 완료 후 임시 파일 삭제 (Gemini 업로드 완료 시점에 서버에서 제거, 디스크 관리)

3. **Gemini 분석** — 영상: Files API 업로드 → 상태 polling (PROCESSING → ACTIVE 확인 후 분석 요청) / 블로그: 스크래핑 후 텍스트 전달
   - 결과: 분석 JSON (카테고리별 null 포함)
   - 실패: "분석 실패" + 재시도 버튼
   - 완료 즉시 `analyses` 테이블 저장

4. **Claude — 각도 추천** — 분석 결과 전달, 각도 3~5개 생성
   - 실패: "각도 추천 실패" + 재시도 버튼

5. **유저 각도 선택/편집** — 클라이언트, API 없음

6. **Claude — 초안 생성** — 분석 결과 + 확정 각도 전달
   - 실패: "초안 생성 실패" + 재시도 버튼
   - 완료 즉시 `drafts` 테이블 저장

7. **유저 편집 후 저장** — `final_content` 업데이트
   - 실패: 결과 화면 유지, 백그라운드 재시도

---

---

## Supabase 테이블 구조

**`analyses`** — URL 분석 1건당 행 1개
- `id` uuid PK
- `user_id` uuid FK → auth.users
- `url` text
- `url_type` enum ('reels' | 'shorts' | 'blog')
- `result` jsonb — 분석 카테고리 6개, null 포함 가능
- `created_at` timestamp

**`drafts`** — 초안 생성 1건당 행 1개, analyses에 연결
- `id` uuid PK
- `analysis_id` uuid FK → analyses
- `selected_angle` text — 유저가 확정한 각도
- `ai_draft` text — AI 생성 원본
- `final_content` text — 유저 편집 후 최종본
- `published_at` timestamp nullable — 실제 발행 시각 (v2 UI, 지금은 컬럼만)
- `performance_note` text nullable — 성과 메모 (v2 UI, 지금은 컬럼만)
- `created_at` timestamp
- `updated_at` timestamp

users 테이블은 Supabase Auth가 자동 관리. 히스토리 패널은 두 테이블 JOIN해서 카드 렌더링.

---

## v1 — 구현 범위

- URL 입력 → 분석 → 각도 선정 → 초안 생성 → 저장
- 히스토리 패널 (불러오기 + 재활용)
- 플랫폼별 초안 포맷 (릴스/숏츠 → 훅/본문/CTA 구조, 블로그 → 소제목 포함)
- 빈 상태 화면 (첫 사용자용 예시 또는 가이드)
- 로그인/회원가입

## v2 — 추후 추가

- 퍼블리시 추적 UI (`published_at`, `performance_note` 입력)
- 인사이트 집계: 히스토리 패턴 분석 ("자주 나온 viral_mechanism" 등)
- 마케팅 원리 연결: 분석 카드에 이론 한 줄 (RAG 연결 전 프롬프트로 가능)
- RAG: 마케팅/심리학 이론 문서 연결 (NotebookLM 수집 완료)
  - 인지 부하 이론, 감정 전염, 인센티브 현저성 이론 등

---

## 환경변수

```
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
INSTAGRAM_SESSION_COOKIE=   # instaloader용, Railway 환경변수로 주입
```

---

## AI 모델

- **분석 (Gemini):** `gemini-3.1-pro` — 영상 직접 분석 지원, Files API 사용
- **각도 추천 + 초안 생성 (Claude):** `claude-sonnet-4-6` — 콘텐츠 생성 품질/비용 균형

---

## 핵심 설계 결정 (바꾸지 말 것)

- **Railway 배포:** yt-dlp, instaloader는 바이너리 의존성 때문에 Vercel 서버리스에서 실행 불가. Railway 고정. `nixpacks.toml`로 Python + ffmpeg + yt-dlp + instaloader 설치 명시 필요.
- **API Route 서버사이드 전용:** 모든 AI/외부 API 호출은 Next.js API Route에서만. 클라이언트에서 직접 호출 금지.
- **반구조화 JSON 분석 결과:** 분석 카테고리는 null 허용. 억지로 채우지 않음. UI는 null 항목 렌더링 안 함.
- **분석-초안 2테이블 분리:** `analyses`와 `drafts` 별도 저장. 히스토리에서 분석 재활용 시 새 `drafts` 행 생성.

---

## 구현 시작점

1. Next.js 프로젝트 생성 (App Router)
2. Supabase 연결 + `analyses`, `drafts` 테이블 생성
3. Supabase Auth 로그인/회원가입 페이지
4. 메인 페이지 UI 골격 (4개 섹션 + 히스토리 패널)
5. URL 감지 → 다운로드 → Gemini 분석 API Route
6. Claude 각도 추천 API Route
7. Claude 초안 생성 API Route
8. 히스토리 패널 + 불러오기

---

## Thinking Protocol

- 파일 먼저 읽기. 가정 금지.
- 구현 전 계획 설명, 확인 후 진행.
- 요구사항 불명확 시 질문.
- 대규모 구조 변경/파일 삭제 필요 시 이유와 방법 먼저 설명, 승인 후 진행.

## Coding Principles

- 가장 단순한 해결책 선택. 과설계 금지.
- 버그 수정 중 무관한 코드 리팩토링 금지.
- 수정 시 동일/유사 문제 주변 확인. 패턴 수정, 단일 인스턴스 수정 금지.
- 해킹처럼 느껴지면 → 말하고 더 깔끔한 대안 제안.
- UI 구현 시 전체 사용자 여정 고려, 완료 전 빈틈 플래그.
- TODO 플레이스홀더 금지. API 키 커밋 금지.

## Definition of Done

기능이 설명대로 동작하고, 기존 기능이 깨지지 않고, 코드가 깔끔하고, 실제로 실행해서 검증됨.
네 가지 모두 충족해야 완료.
