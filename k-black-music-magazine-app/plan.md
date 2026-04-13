# 한국 블랙 뮤직 인스타그램 매거진 자동화 웹앱 계획서

## 1. 목표
- 한국 블랙 뮤직 인스타그램 매거진 제작 워크플로우 중 `1~4단계`만 먼저 구현한다.
- 사용자는 모바일 환경에서 메인 곡과 아티스트를 입력하고, AI 리서치와 교차검증 결과를 확인한 뒤 훅 곡 1개를 선택할 수 있어야 한다.
- 전체 UI 문구는 한국어로 제공한다.
- `5단계(카피 생성)`와 `6단계(Figma/Drive 연동)`은 이번 범위에서 구현하지 않는다.

## 2. 현재 범위

### 포함
- `1단계` 입력 화면
- `2단계` Gemini 기반 리서치
- `3단계` Claude 기반 교차검증
- `4단계` 훅 곡 선택 UI
- Supabase 기반 작업 세션 저장
- 모바일 퍼스트 UI

### 제외
- 카피 생성 UI 및 API
- Figma REST API 연동
- PNG export
- Google Drive 업로드
- 관리자 기능
- 로그인/권한 체계

## 3. 기술 스택
- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase
- Gemini API
- Claude API

## 4. 환경변수
실구현 시 아래 키를 `.env.local`에 둔다.

```bash
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
FIGMA_ACCESS_TOKEN=
GOOGLE_DRIVE_CREDENTIALS=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

이번 범위에서 실제 사용하는 값:
- `GEMINI_API_KEY`
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

이번 범위에서 미사용이지만 선반영:
- `FIGMA_ACCESS_TOKEN`
- `GOOGLE_DRIVE_CREDENTIALS`

## 5. 프롬프트 정책
- 리서처 시스템 프롬프트는 추후 제공 전까지 빈 문자열 `""` 로 둔다.
- 카피라이터 시스템 프롬프트도 추후 제공 전까지 빈 문자열 `""` 로 둔다.
- 이번 구현 범위에서는 카피라이터 프롬프트를 실제로 사용하지 않는다.

예정 상수:

```ts
export const RESEARCHER_SYSTEM_PROMPT = "";
export const COPYWRITER_SYSTEM_PROMPT = "";
```

## 6. 사용자 흐름
1. 사용자가 메인 곡명과 아티스트명을 입력한다.
2. `리서치 시작` 버튼을 누른다.
3. 서버가 Gemini API와 웹검색 기반 리서치를 수행해 훅 곡 후보 5개를 만든다.
4. 이어서 서버가 Claude API와 웹검색 기반 검증을 수행한다.
5. 결과 화면에서 후보 5개 카드를 본다.
6. 각 카드의 검증 상태를 확인하고 1개를 선택한다.
7. 선택 결과를 Supabase에 저장한다.

## 7. 화면 구조

### `/`
단일 모바일 중심 워크플로우 화면으로 시작한다.

섹션 구성:
- 상단 앱 헤더
- 입력 폼
- 리서치 진행 상태
- 후보 카드 리스트
- 선택 완료 영역

### 모바일 UX 원칙
- 기본 폭 기준 `360px~430px` 최적화
- 주요 CTA는 하단에서 쉽게 누를 수 있도록 크게 배치
- 입력 폼은 한 화면 안에서 완료 가능하게 구성
- 카드 간격, 폰트 크기, 상태 배지를 모바일에서 우선 설계
- 데스크톱에서는 가운데 정렬된 좁은 컬럼 레이아웃 유지

## 8. 정보 구조

### 입력 데이터
- 메인 곡명
- 메인 아티스트명

### 리서치 결과 데이터
- 후보 곡명
- 후보 아티스트명
- 사운드 개념
- 연결 이유
- 인지도 지표
- 출처 링크 목록

### 검증 결과 데이터
- 검증 상태: `verified | uncertain`
- 검증 요약
- 불확실 포인트 목록
- 검증 근거 링크 목록

### 사용자 선택 데이터
- 선택된 후보 ID
- 선택 시각

## 9. 서버 액션 / API 설계
Next.js App Router 기준으로 Route Handler를 사용한다.

### `POST /api/workflows`
역할:
- 새 작업 세션 생성
- 입력값 저장

요청 예시:

```json
{
  "mainTrack": "곡명",
  "mainArtist": "아티스트명"
}
```

응답 예시:

```json
{
  "workflowId": "uuid",
  "status": "draft"
}
```

### `POST /api/research`
역할:
- Gemini 리서치 실행
- 웹검색 결과와 함께 후보 5개 생성
- 결과를 Supabase에 저장

요청 예시:

```json
{
  "workflowId": "uuid"
}
```

응답 예시:

```json
{
  "workflowId": "uuid",
  "status": "researched",
  "candidates": [
    {
      "id": "uuid",
      "trackName": "예시",
      "artistName": "예시",
      "soundConcept": "예시",
      "connectionReason": "예시",
      "awarenessMetric": "예시",
      "sources": []
    }
  ]
}
```

### `POST /api/verify`
역할:
- 후보 5개 각각 Claude로 교차검증
- 웹검색 근거를 함께 저장

요청 예시:

```json
{
  "workflowId": "uuid"
}
```

응답 예시:

```json
{
  "workflowId": "uuid",
  "status": "verified",
  "candidates": [
    {
      "id": "uuid",
      "verificationStatus": "verified",
      "verificationSummary": "예시",
      "uncertaintyFlags": [],
      "verificationSources": []
    }
  ]
}
```

### `POST /api/select`
역할:
- 사용자가 최종 훅 곡 1개 선택
- 선택 상태를 저장

요청 예시:

```json
{
  "workflowId": "uuid",
  "candidateId": "uuid"
}
```

응답 예시:

```json
{
  "workflowId": "uuid",
  "selectedCandidateId": "uuid",
  "status": "selected"
}
```

## 10. Supabase 데이터 모델 초안

### `workflows`
- `id` uuid pk
- `main_track` text not null
- `main_artist` text not null
- `status` text not null
- `selected_candidate_id` uuid null
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()

상태값:
- `draft`
- `researching`
- `researched`
- `verifying`
- `verified`
- `selected`
- `failed`

### `hook_candidates`
- `id` uuid pk
- `workflow_id` uuid not null
- `track_name` text not null
- `artist_name` text not null
- `sound_concept` text not null
- `connection_reason` text not null
- `awareness_metric` text not null
- `research_sources` jsonb not null default '[]'
- `verification_status` text null
- `verification_summary` text null
- `uncertainty_flags` jsonb not null default '[]'
- `verification_sources` jsonb not null default '[]'
- `display_order` int not null
- `created_at` timestamptz default now()

## 11. 타입 설계 초안

```ts
export type WorkflowStatus =
  | "draft"
  | "researching"
  | "researched"
  | "verifying"
  | "verified"
  | "selected"
  | "failed";

export type VerificationStatus = "verified" | "uncertain";

export interface SourceLink {
  title: string;
  url: string;
  snippet?: string;
}

export interface HookCandidate {
  id: string;
  trackName: string;
  artistName: string;
  soundConcept: string;
  connectionReason: string;
  awarenessMetric: string;
  researchSources: SourceLink[];
  verificationStatus?: VerificationStatus;
  verificationSummary?: string;
  uncertaintyFlags: string[];
  verificationSources: SourceLink[];
  displayOrder: number;
}

export interface Workflow {
  id: string;
  mainTrack: string;
  mainArtist: string;
  status: WorkflowStatus;
  selectedCandidateId?: string | null;
}
```

## 12. AI 연동 설계

### Gemini 리서치
역할:
- 메인 곡과 아티스트를 기반으로 훅 곡 후보 5개 생성
- 각 후보마다 사운드 개념, 연결 이유, 인지도 지표 생성
- Google Search grounding을 함께 사용해 최신 웹 정보를 반영

입력:
- 메인 곡명
- 메인 아티스트명
- Gemini `google_search` 도구 활성화
- 시스템 프롬프트 `""`

출력 규칙:
- 반드시 5개 후보 반환
- JSON 구조 강제
- 곡명/아티스트명 누락 금지
- 응답에 grounding 메타데이터가 있으면 출처 링크를 정규화해 저장

### Claude 검증
역할:
- 후보 5개 각각 사실성/연결 타당성 검증
- 근거 부족 시 `uncertain`
- 충분히 검증되면 `verified`
- Anthropic `web_search` 툴을 사용해 후보별 근거를 재확인

입력:
- 메인 곡 정보
- 후보 5개
- Claude `web_search` 툴 활성화
- Gemini 리서치 결과 요약 및 출처

출력 규칙:
- 후보별 상태 포함
- 불확실 항목은 사람이 이해하기 쉬운 문장으로 반환
- JSON 구조 강제
- Claude가 반환한 인용/검색 근거를 `verification_sources`로 저장

## 13. 웹검색 전략
이번 범위에서는 별도 검색 provider를 두지 않는다.

### 리서치 단계
- Gemini API의 내장 `google_search` grounding 사용
- 애플리케이션 레벨에서 별도 검색 API를 직접 호출하지 않음
- 모델 응답의 grounding 메타데이터를 출처 데이터로 정규화해 저장

### 검증 단계
- Anthropic Messages API의 `web_search` 툴 사용
- 애플리케이션 레벨에서 별도 검색 provider를 추가하지 않음
- Claude가 검색과 인용을 수행하고, 반환 근거를 `verification_sources`에 저장

### 추상화 방침
- `searchWeb()` 같은 독립 검색 레이어는 만들지 않는다.
- 대신 모델 어댑터를 분리한다.
- `lib/ai/gemini.ts`는 리서치 + grounding 처리 담당
- `lib/ai/claude.ts`는 검증 + web search 처리 담당
- 추후 비용, 품질, 제약 때문에 별도 검색 provider가 필요해질 때만 공통 검색 레이어를 도입한다.

### 설계 원칙
- 최신성이 필요한 검색은 각 모델의 내장 검색 기능을 우선 사용
- 출처 링크는 UI 표시 가능하도록 표준 구조로 저장
- 모델 출력은 항상 앱 내부 스키마로 정규화
- 검색 책임은 앱이 아니라 각 모델 호출 계층에 둔다

## 14. 프론트엔드 컴포넌트 구조 초안

### 페이지
- `app/page.tsx`

### 컴포넌트
- `InputForm`
- `WorkflowStepper`
- `ResearchProgressPanel`
- `HookCandidateCard`
- `HookCandidateList`
- `VerificationBadge`
- `SelectionBar`
- `EmptyState`
- `ErrorState`

### 상태 관리
초기 구현은 로컬 `useState` + 서버 fetch 조합으로 시작한다.

후보:
- 추후 복잡해지면 Zustand 또는 React Query 도입 검토

## 15. 모바일 UI 상세 방향

### 입력 화면
- 상단 설명 문구는 짧고 명확하게
- 입력창 2개를 세로 배치
- 버튼은 `리서치 시작`
- 진행 중에는 버튼 비활성화 + 스피너 표시

### 후보 카드
- 카드 상단에 곡명 / 아티스트명
- 중간에 `사운드 개념`, `연결 이유`, `인지도 지표`
- 하단에 검증 상태 배지
- `검증 완료`는 초록색
- `불확실 항목 있음`은 주황색
- 선택 버튼은 카드 전체 또는 하단 CTA로 제공

### 상태 표현
- 로딩: 단계별 텍스트 진행 상태
- 실패: 짧은 오류 설명 + 재시도 버튼
- 완료: 선택된 카드 고정 표시

## 16. 디렉터리 구조 제안

```txt
black-music-magazine-app/
  app/
    api/
      workflows/route.ts
      research/route.ts
      verify/route.ts
      select/route.ts
    globals.css
    layout.tsx
    page.tsx
  components/
    input-form.tsx
    workflow-stepper.tsx
    research-progress-panel.tsx
    hook-candidate-card.tsx
    hook-candidate-list.tsx
    verification-badge.tsx
    selection-bar.tsx
  lib/
    ai/
      gemini.ts
      claude.ts
      prompts.ts
    search/
      web-search.ts
    supabase/
      client.ts
      server.ts
    validators/
      workflow.ts
  types/
    workflow.ts
  supabase/
    schema.sql
  plan.md
```

## 17. 구현 순서 제안
1. Next.js 프로젝트 초기화
2. Tailwind 및 기본 모바일 레이아웃 구성
3. Supabase 프로젝트 연결 및 스키마 작성
4. 입력 폼과 세션 생성 API 구현
5. Gemini 리서치 API 래퍼 구현
6. 웹검색 어댑터 구현
7. 후보 5개 저장 및 표시
8. Claude 검증 API 래퍼 구현
9. 검증 상태 배지 및 카드 UI 구현
10. 최종 선택 저장 구현
11. 에러/재시도/빈 상태 정리

## 18. 예외 처리 방침
- Gemini 응답이 5개 미만이면 실패 처리 후 재시도 유도
- Claude 검증 일부 실패 시 해당 후보만 `uncertain` 처리 가능
- 외부 API 타임아웃 시 사용자에게 `잠시 후 다시 시도` 메시지 노출
- JSON 파싱 실패에 대비해 서버에서 스키마 검증 수행

## 19. 보안 및 운영 고려사항
- API 키는 모두 서버 전용 로직에서 사용
- 클라이언트에서는 Supabase anon key만 사용
- 외부 API 응답 원문은 로그에 남기되 개인정보는 저장하지 않음
- Rate limit 대비를 위해 추후 작업량 제한 고려

## 20. 향후 확장 지점
- `5단계` 카피 생성 연결
- `6단계` Figma 텍스트 삽입 자동화
- Google Drive 업로드
- 작업 히스토리 조회
- 사용자 인증 및 팀 워크스페이스

## 21. 이번 단계 산출물 정의
이번 요청 기준 산출물은 아래 1개다.
- 별도 폴더 내 `plan.md`

다음 구현 단계에서 바로 착수 가능한 상태를 목표로 한다.
