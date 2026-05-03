# AI 투자 보조 시스템

군 복무 중 모바일로 확인 가능한 AI 투자 보조 대시보드다. 데이터는 자동 수집하고, AI가 의견서를 만들고, 사람은 웹/텔레그램에서 승인 또는 거절만 기록한다.

이 앱은 실제 주문을 실행하지 않는다. 텔레그램 승인은 의사결정 기록이다.

## 실행

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
uvicorn app.main:app --reload
```

기본 주소:

```text
http://127.0.0.1:8000
```

## 주요 환경변수

- `APP_SECRET`: 로그인 쿠키 서명용 비밀값
- `ADMIN_PASSWORD`: 웹 로그인 비밀번호
- `SQLITE_PATH`: SQLite 파일 위치
- `TELEGRAM_BOT_TOKEN`: 텔레그램 봇 토큰
- `TELEGRAM_ALLOWED_CHAT_ID`: 승인 허용 채팅 ID
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`: AI 의견서 생성 키
- `PRICE_HISTORY_DAYS`: 자동 수집할 과거 일수. 기본값은 1825일
- `AUTO_UNIVERSE_SOURCES`: 자동 후보군. 기본값은 `user_watchlist,sp500,nasdaq100`

API 키가 없어도 앱은 켜진다. 이 경우 AI provider는 비활성 상태로 표시되고 테스트용 Mock provider만 쓸 수 있다.

## Railway 배포

Railway에서는 이 폴더(`stock-auto-trading-plan`)를 서비스 루트로 잡고 배포한다.

필수 환경변수:

```text
APP_SECRET=긴_랜덤_문자열
ADMIN_PASSWORD=관리자_비밀번호
SQLITE_PATH=/app/data/app.db
PRICE_HISTORY_DAYS=1825
AUTO_UNIVERSE_SOURCES=user_watchlist,sp500,nasdaq100
```

AI 의견서를 실제 모델로 만들려면 `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` 중 하나 이상을 추가한다.

## QuantConnect 준비

`/exports/lean.csv`에서 승인된 의견서를 LEAN용 CSV로 받을 수 있다.

컬럼:

```text
date,ticker,recommendation,score,confidence,max_weight,entry_price,stop_price,review_price,memo_id
```

현재 CSV에는 결정 모드와 유니버스 정보도 포함된다.

```text
date,ticker,recommendation,decision_mode,universe_name,horizon_days,score,confidence,max_weight,entry_price,stop_price,review_price,memo_id
```

MVP에서는 LEAN을 직접 실행하지 않는다. 이후 QuantConnect LEAN 프로젝트에서 이 CSV를 custom data로 읽어 백테스트와 paper trading에 연결한다.
