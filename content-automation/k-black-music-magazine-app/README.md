# 흑음 매거진 메이커

한국 블랙 뮤직 인스타그램 매거진 제작 워크플로우 중 `1~4단계`를 우선 구현한 모바일 퍼스트 Next.js 앱입니다.

## 포함 범위
- 1단계: 메인 곡명 + 아티스트명 입력
- 2단계: Gemini 기반 훅 곡 후보 5개 리서치
- 3단계: Claude 기반 후보 교차검증
- 4단계: 최종 훅 곡 선택

## 실행 전 준비
`.env.local`에 아래 값을 설정합니다.

```bash
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
FIGMA_ACCESS_TOKEN=
GOOGLE_DRIVE_CREDENTIALS=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

환경변수가 비어 있으면 개발 편의를 위해 목업 데이터로 동작합니다.

## 실행
```bash
npm install
npm run dev
```

Playwright Chromium이 아직 없으면 한 번만 아래를 실행합니다.

```bash
npx playwright install chromium
```

## Supabase
- 스키마: [supabase/schema.sql](/Users/minsoopark/Downloads/바이브코딩/k-black-music-magazine-app/supabase/schema.sql)
- 현재는 MVP 단계라 anon 정책이 넓게 열려 있습니다.
- 실제 운영 전에는 인증/RLS 정책을 더 좁혀야 합니다.

## 5~6단계 메모
- `FIGMA_ACCESS_TOKEN`는 현재 사용하지 않습니다.
- `GOOGLE_DRIVE_CREDENTIALS`가 있으면 PNG export 후 Drive 업로드를 시도합니다.
- 없으면 PNG를 로컬 [exports](/Users/minsoopark/Downloads/바이브코딩/k-black-music-magazine-app/exports) 폴더에만 저장합니다.
