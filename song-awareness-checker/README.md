# Song Awareness Checker

블랙뮤직 인스타 매거진 훅 선정을 위한 **한국 내 곡 인지도 측정 도구**.

Google Trends KR과 Last.fm listener 수를 종합해 0–100 점수를 산출합니다.

---

## 점수 산식

| 지표 | 가중치 | 비고 |
|------|--------|------|
| Last.fm Listeners (정규화) | 55% | log 스케일 변환 |
| Google Trends KR (web) | 45% | 최근 12개월 평균 |

---

## 빠른 시작

```bash
cd song-awareness-checker
npm install
cp .env.local.example .env.local   # 키 입력 후
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.
API 키 없이 UI를 확인하려면 화면 우상단 **Mock data** 체크박스를 켜세요.

---

## API 키 발급

### 1. Google Trends (SerpAPI)
1. [SerpAPI](https://serpapi.com) 가입 (무료 100회/월)
2. Dashboard → API Key 복사
3. `.env.local`에 `SERPAPI_KEY` 입력

### 2. Last.fm
1. [Last.fm API 신청](https://www.last.fm/api/account/create)
2. API Key 복사 (무료, 별도 제한 없음)
3. `.env.local`에 `LASTFM_API_KEY` 입력

---

## 폴더 구조

```
app/
  api/
    trends/route.ts     ← Google Trends KR (SerpAPI)
    lastfm/route.ts     ← Last.fm listeners
    score/route.ts      ← 두 지표 종합 스코어
  page.tsx              ← 메인 UI
lib/
  score.ts              ← 스코어 계산 로직
.env.local.example      ← 환경변수 템플릿
```
