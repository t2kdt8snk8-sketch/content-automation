# AI 투자 보조 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 군 복무 중 폰으로 확인 가능한 AI 투자 보조 시스템을 만든다. 데이터는 자동 수집하고, AI가 투자 의견서를 만들고, 사람은 웹/텔레그램에서 최종 승인만 기록한다.

**Architecture:** FastAPI 단일 앱으로 모바일 웹, 데이터 수집, AI 의견서 생성, 텔레그램 알림, 승인 기록, 성과 추적을 처리한다. 실제 주문은 MVP에서 제외하고, QuantConnect LEAN이 나중에 읽을 수 있는 신호 파일을 내보낸다.

**Tech Stack:** Python 3.11+, FastAPI, Jinja2, SQLite, SQLAlchemy, APScheduler, httpx, pandas, pytest, python-telegram-bot 또는 Telegram HTTP API, Railway.

---

## 1. 범위와 원칙

### MVP에 포함

- 모바일 웹 대시보드
- 관리자 로그인
- 관심종목 관리
- 무료 데이터 자동 수집
- CSV 업로드 백업 경로
- 기본 가격/거래량 피처 계산
- Gemini/Claude/GPT 기반 AI 의견서 생성
- 고정 의견서 양식
- 시스템 계산 수학 점수: EV, 손익분기 확률, 보정 확률, 손익비, math_score
- 위험관리 필터
- 텔레그램 알림과 승인/거절 기록
- 5일, 10일, 20일 사후 성과 추적
- 점수 구간별 성과 리포트
- QuantConnect LEAN용 신호 CSV 내보내기
- Railway 배포 준비

### MVP에서 제외

- 실제 증권사 주문
- 자동 매수/매도 실행
- 강화학습 실전 투입
- 유료 데이터 연동
- 완전한 상장폐지 데이터 반영
- QuantConnect LEAN 직접 실행

### 핵심 원칙

- AI는 의견서를 만든다.
- 위험관리 필터는 AI보다 우선한다.
- 사람 승인 없이는 실전 주문하지 않는다.
- 텔레그램 승인은 “주문 실행”이 아니라 “의사결정 기록”이다.
- CSV 업로드는 주 경로가 아니라 장애 대응/수동 보정용이다.
- 데이터 수집은 매일 자동 실행한다.

---

## 2. 프로젝트 구조

```text
stock-auto-trading-plan/
  STRATEGY.md
  IMPLEMENTATION_PLAN.md
  README.md
  pyproject.toml
  railway.json
  .env.example
  app/
    main.py
    config.py
    db.py
    models.py
    schemas.py
    security.py
    web/
      routes.py
      templates/
        base.html
        login.html
        dashboard.html
        candidates.html
        memo_detail.html
        uploads.html
        exports.html
      static/
        app.css
    data/
      sources.py
      collector.py
      validators.py
      features.py
      imports.py
    ai/
      schema.py
      scoring.py
      providers.py
      orchestrator.py
      prompts.py
    risk/
      rules.py
    telegram/
      bot.py
      callbacks.py
    reports/
      performance.py
      lean_export.py
    scheduler.py
  tests/
    test_data_validation.py
    test_features.py
    test_ai_schema.py
    test_risk_rules.py
    test_performance.py
    test_lean_export.py
```

파일 책임:

- `app/main.py`: 앱 생성, 라우터 등록, 시작 이벤트.
- `app/config.py`: 환경변수 로딩.
- `app/db.py`: SQLite 연결과 세션 관리.
- `app/models.py`: 저장 구조.
- `app/web/routes.py`: 웹 화면과 폼 처리.
- `app/data/*`: 자동 수집, CSV 업로드, 데이터 검증, 피처 계산.
- `app/ai/*`: 세 AI 모델 호출, 의견서 구조 검증, 수학값 해석 보조.
- `app/math/*`: EV, 손익분기 확률, 보정 확률, 라벨링, 점수 진단 계산.
- `app/risk/rules.py`: 승인 가능/불가 판정. AI 점수가 아니라 시스템 계산 수학값을 우선한다.
- `app/telegram/*`: 알림 전송과 승인/거절 처리.
- `app/reports/*`: 성과 집계와 LEAN 신호 파일 생성.
- `app/scheduler.py`: 장마감 후 자동 작업 예약.

---

## 3. 데이터 설계

### 주요 테이블

#### `watchlist`

관심종목.

| 필드 | 설명 |
|---|---|
| `id` | 내부 ID |
| `ticker` | 종목 코드 |
| `name` | 종목명 |
| `sector` | 섹터 |
| `notes` | 사용자 메모 |
| `is_active` | 수집 대상 여부 |
| `created_at` | 생성 시각 |

#### `price_bars`

일봉 가격 데이터.

| 필드 | 설명 |
|---|---|
| `id` | 내부 ID |
| `ticker` | 종목 코드 |
| `date` | 거래일 |
| `open` | 시가 |
| `high` | 고가 |
| `low` | 저가 |
| `close` | 종가 |
| `volume` | 거래량 |
| `adjusted_close` | 수정 종가 |
| `source` | 데이터 출처 |
| `ingested_at` | 저장 시각 |

중복 방지 기준: `ticker + date + source`.

#### `data_runs`

자동 수집/CSV 업로드 실행 기록.

| 필드 | 설명 |
|---|---|
| `id` | 내부 ID |
| `run_type` | `auto` 또는 `csv_upload` |
| `source` | 데이터 출처 |
| `started_at` | 시작 시각 |
| `finished_at` | 종료 시각 |
| `status` | `success`, `partial`, `failed` |
| `message` | 요약 메시지 |
| `file_hash` | CSV면 원본 해시 |

#### `features`

후보 생성에 쓰는 계산값.

| 필드 | 설명 |
|---|---|
| `id` | 내부 ID |
| `ticker` | 종목 코드 |
| `as_of_date` | 기준일 |
| `return_1d` | 1일 수익률 |
| `return_5d` | 5일 수익률 |
| `return_20d` | 20일 수익률 |
| `return_60d` | 60일 수익률 |
| `volatility_20d` | 20일 변동성 |
| `volume_ratio_20d` | 최근 거래량/20일 평균 거래량 |
| `relative_strength_spy` | SPY 대비 상대강도 |
| `relative_strength_qqq` | QQQ 대비 상대강도 |
| `near_high_60d` | 60일 고점 근접도 |
| `near_low_60d` | 60일 저점 근접도 |

#### `candidates`

AI 의견서 생성 전 후보.

| 필드 | 설명 |
|---|---|
| `id` | 내부 ID |
| `ticker` | 종목 코드 |
| `as_of_date` | 기준일 |
| `baseline_score` | 기본 모델 점수 |
| `candidate_reason` | 후보 선정 이유 |
| `risk_status` | `ok`, `warning`, `blocked` |
| `created_at` | 생성 시각 |

#### `investment_memos`

AI 의견서.

| 필드 | 설명 |
|---|---|
| `id` | 내부 ID |
| `candidate_id` | 후보 ID |
| `ticker` | 종목 코드 |
| `as_of_date` | 기준일 |
| `recommendation` | `buy`, `hold`, `sell`, `watch` |
| `confidence` | 0~100 |
| `total_score` | 최종 점수 |
| `score_price_trend` | 가격/추세 점수 |
| `score_fundamental` | 실적/재무 점수 |
| `score_news_event` | 뉴스/이벤트 점수 |
| `score_flow_volume` | 수급/거래량 점수 |
| `score_risk` | 리스크 점수 |
| `score_reward_risk` | 손익비 점수 |
| `entry_price` | 진입 기준가 |
| `stop_price` | 손절 기준가 |
| `review_price` | 익절 또는 재평가 기준가 |
| `max_weight` | 최대 허용 비중 |
| `holding_period` | 예상 보유 기간 |
| `bull_case` | 상승 시나리오 |
| `bear_case` | 하락 시나리오 |
| `key_reasons_json` | 핵심 근거 3개 |
| `counter_reasons_json` | 반대 근거 3개 |
| `do_not_trade_if_json` | 거래 금지 조건 |
| `model_stack_json` | 사용 모델과 역할 |
| `prompt_version` | 프롬프트 버전 |
| `source_summary_json` | 사용 데이터 출처 |
| `raw_outputs_json` | 모델별 원문 결과 |
| `created_at` | 생성 시각 |

#### `approval_records`

사람 승인/거절 기록.

| 필드 | 설명 |
|---|---|
| `id` | 내부 ID |
| `memo_id` | 의견서 ID |
| `decision` | `approved`, `rejected` |
| `channel` | `web`, `telegram` |
| `decided_at` | 결정 시각 |
| `notes` | 메모 |

#### `performance_snapshots`

사후 성과.

| 필드 | 설명 |
|---|---|
| `id` | 내부 ID |
| `memo_id` | 의견서 ID |
| `ticker` | 종목 코드 |
| `horizon_days` | 5, 10, 20 |
| `entry_close` | 기준 종가 |
| `future_close` | 미래 종가 |
| `return_pct` | 수익률 |
| `benchmark_return_pct` | 벤치마크 수익률 |
| `excess_return_pct` | 초과수익 |
| `status` | `pending`, `ready`, `missing_data` |

---

## 4. 자동 데이터 수집

### 기본 정책

초기 자동 수집은 무료 소스를 쓴다. CSV 업로드는 백업이다.

우선순위:

1. 관심종목 일봉 가격
2. SPY, QQQ, IWM 벤치마크
3. 섹터 ETF 가격
4. 수동 CSV 보정

무료 소스는 안정성과 약관 문제가 있을 수 있으므로, 모든 데이터에 `source`와 `ingested_at`을 저장한다.

### 스케줄

기본 시간은 미국장 마감 후로 잡는다.

```text
매일 07:30 KST:
가격 데이터 자동 수집
데이터 검증
피처 계산
후보 생성
AI 의견서 생성 대상 선정
텔레그램 요약 알림

매일 08:00 KST:
AI 의견서 생성
위험관리 필터 적용
텔레그램 후보 알림

매일 08:30 KST:
사후 성과 업데이트
```

Railway에서 항상 켜진 웹 프로세스 하나로 시작한다. APScheduler를 앱 내부에서 사용하되, 중복 실행 방지를 위해 `data_runs`에 실행 상태를 기록한다.

### 데이터 검증 규칙

- 필수 컬럼 누락 시 저장하지 않는다.
- 같은 종목/날짜 중복 데이터는 업데이트하지 않고 기존 값을 유지한다.
- `high < low`면 실패.
- `close <= 0`이면 실패.
- 전일 대비 수정종가 변화가 40%를 넘으면 경고.
- 거래량이 0이면 후보 생성에서 제외.
- 벤치마크 데이터가 없으면 AI 의견서 생성은 보류.

---

## 5. 후보 생성

MVP 후보 생성은 복잡한 ML이 아니라 단순한 기준 모델로 시작한다.

점수 예시:

```text
20일 수익률 양수: +15
60일 수익률 양수: +10
SPY 대비 20일 상대강도 양수: +15
QQQ 대비 20일 상대강도 양수: +10
거래량 20일 평균 대비 1.5배 이상: +10
60일 고점 10% 이내: +10
20일 변동성 과도: -10
최근 5일 급등 15% 초과: -10
```

후보 조건:

- 기본 점수 40점 이상
- 거래량 0 아님
- 벤치마크 데이터 있음
- 위험관리 필터에서 `blocked` 아님

후보는 매일 생성하되, 같은 종목의 기존 의견서가 5거래일 이내에 있으면 새 의견서 생성을 보류하고 기존 의견서를 재평가 대상으로 표시한다.

---

## 6. AI 의견서 생성

### 모델 역할

세 모델을 모두 지원한다.

```text
Gemini:
저비용 초안, 데이터 요약, 이벤트 정리

Claude:
반대 근거, 리스크, 논리적 허점 검토

GPT:
최종 JSON 정리, 점수 일관성 검사, 누락 필드 검증
```

API 키가 없는 모델은 건너뛴다. 최소 1개 모델이 있으면 의견서 생성은 가능하다. 단, 사용 모델이 1개뿐이면 의견서에 `model_coverage_warning`을 남긴다.

### 고정 출력 형식

최종 의견서는 JSON으로 저장한다.

```json
{
  "recommendation": "buy",
  "confidence": 82,
  "scores": {
    "price_trend": 18,
    "fundamental": 12,
    "news_event": 14,
    "flow_volume": 10,
    "risk": -6,
    "reward_risk": 20,
    "total": 68
  },
  "holding_period": "5~20 trading days",
  "entry_price": 123.45,
  "stop_price": 116.00,
  "review_price": 132.00,
  "max_weight": 0.03,
  "key_reasons": [
    "20일 수익률이 양수이고 SPY 대비 상대강도가 높다.",
    "거래량이 20일 평균보다 증가했다.",
    "손절 기준 대비 재평가 가격의 보상 비율이 양호하다."
  ],
  "counter_reasons": [
    "최근 단기 급등 후 되돌림 가능성이 있다.",
    "섹터 전체 변동성이 높다.",
    "뉴스 근거가 부족하면 가격 신호만 남는다."
  ],
  "bull_case": "상대강도와 거래량 증가가 유지되면 단기 추세가 이어질 수 있다.",
  "bear_case": "벤치마크가 약해지거나 거래량이 줄면 신호 신뢰도가 떨어진다.",
  "do_not_trade_if": [
    "다음 거래일 시초가가 진입 기준보다 5% 이상 갭 상승",
    "거래량이 20일 평균의 절반 이하",
    "같은 섹터 노출이 25% 초과"
  ]
}
```

### 저장 전 검증

- 추천값은 `buy`, `hold`, `sell`, `watch` 중 하나여야 한다.
- 확신도는 0~100이어야 한다.
- 핵심 근거는 정확히 3개 이상이어야 한다.
- 반대 근거는 정확히 3개 이상이어야 한다.
- 손절가는 진입가보다 낮아야 한다.
- `max_weight`는 0.07 이하여야 한다.
- 총점이 70 미만이면 `buy`여도 승인 불가로 표시한다.
- 출처 없는 강한 표현이 있으면 경고를 남긴다.

---

## 7. 위험관리

### 승인 불가 조건

- 최종 점수 70 미만
- 한 종목 제안 비중 7% 초과
- AI 보조 계좌 전체 주식 노출 70% 초과
- 섹터 노출 25% 초과
- 손절가가 진입가보다 높거나 같음
- 진입가 대비 손절폭이 12% 초과
- 거래량 데이터 누락
- 벤치마크 데이터 누락
- 같은 종목 중복 승인 대기

### 경고 조건

- 5일 수익률 15% 초과 급등
- 20일 변동성이 평소보다 큼
- AI 모델 1개만 사용됨
- 뉴스/이벤트 근거 부족
- 최근 30일 AI 추천 성과가 음수

---

## 8. 모바일 웹

### 화면

#### 로그인

- 비밀번호 1개로 로그인.
- 세션 쿠키 사용.
- 실패 시 구체적 보안 정보 노출 금지.

#### 대시보드

표시:

- 오늘 후보 수
- 승인 대기 수
- 승인/거절 현황
- 최근 5일 AI 추천 성과
- 점수 구간별 성과
- 데이터 수집 상태
- 마지막 AI 생성 상태

#### 후보 목록

카드 표시:

- 종목
- 추천
- 점수
- 확신도
- 위험 상태
- 핵심 근거 1줄
- 승인 가능/불가

#### 의견서 상세

표시:

- 전체 의견서
- 점수 구성
- 근거/반대 근거
- 진입가/손절가/재평가가
- 최대 비중
- 거래 금지 조건
- AI 모델 사용 내역
- 텔레그램 전송 버튼
- 승인/거절 버튼

#### 데이터 관리

- 관심종목 추가/비활성화
- CSV 업로드
- 마지막 수집 결과
- 데이터 오류 목록

#### 내보내기

- LEAN용 신호 CSV 다운로드
- 기간 선택
- 승인된 의견서만 포함

---

## 9. 텔레그램

### 메시지 형식

```text
[AI 투자 후보]
AAPL / 매수 검토 / 82점

근거:
1. SPY 대비 상대강도 양수
2. 거래량 증가
3. 손익비 양호

반대:
1. 단기 급등
2. 섹터 변동성
3. 뉴스 근거 부족

진입: 123.45
손절: 116.00
재평가: 132.00
최대비중: 3%

상태: 승인 가능
```

버튼:

- `승인 기록`
- `거절 기록`
- `웹에서 보기`

### 보안

- `TELEGRAM_ALLOWED_CHAT_ID`와 일치하지 않으면 무시한다.
- 승인/거절 callback은 1회만 처리한다.
- 실제 주문 버튼은 만들지 않는다.

---

## 10. 사후 성과 추적

매일 자동으로 실행한다.

계산:

- 의견서 기준 종가
- 5거래일 후 수익률
- 10거래일 후 수익률
- 20거래일 후 수익률
- SPY 대비 초과수익
- QQQ 대비 초과수익

집계:

- 90점 이상 추천군 평균 성과
- 80~90점 추천군 평균 성과
- 70~80점 추천군 평균 성과
- 70점 미만 추천군 평균 성과
- 승인한 후보 성과
- 거절한 후보 성과

목표는 “AI가 높은 점수를 준 후보가 실제로 더 나은가”를 확인하는 것이다.

---

## 11. QuantConnect LEAN 연결 준비

MVP에서는 LEAN을 직접 실행하지 않는다. 대신 신호 파일을 내보낸다.

### 내보내기 파일

파일명:

```text
lean_signals_YYYYMMDD.csv
```

컬럼:

```text
date,ticker,recommendation,score,confidence,max_weight,entry_price,stop_price,review_price,memo_id
```

규칙:

- 승인된 의견서만 포함한다.
- `recommendation`은 `buy`, `hold`, `sell`, `watch` 중 하나다.
- 점수와 확신도는 숫자로 저장한다.
- 가격 필드는 비어 있으면 내보내기 실패 처리한다.

다음 단계에서 LEAN 프로젝트가 이 파일을 custom data처럼 읽어 paper trading과 백테스트에 사용한다.

---

## 12. 구현 작업

### Task 1: 프로젝트 초기화

**Files:**

- Create: `pyproject.toml`
- Create: `.env.example`
- Create: `railway.json`
- Create: `README.md`
- Create: `app/main.py`
- Create: `app/config.py`
- Create: `app/db.py`

- [ ] FastAPI, SQLAlchemy, Jinja2, pandas, httpx, APScheduler, pytest 의존성 추가.
- [ ] 환경변수 로더 구현.
- [ ] 앱 시작 시 DB 연결 확인.
- [ ] `/health`가 `{"status":"ok"}`를 반환하게 구현.
- [ ] `pytest`와 `uvicorn app.main:app --reload` 실행 확인.

### Task 2: 저장 구조 구현

**Files:**

- Create: `app/models.py`
- Create: `app/schemas.py`
- Create: `tests/test_models.py`

- [ ] 관심종목, 가격 데이터, 수집 실행, 피처, 후보, 의견서, 승인 기록, 성과 테이블 정의.
- [ ] SQLite에서 테이블 생성 가능하게 구현.
- [ ] 중복 가격 데이터 저장 방지 테스트 작성.
- [ ] 의견서 필수 필드 저장 테스트 작성.

### Task 3: 로그인과 모바일 웹 기본 화면

**Files:**

- Create: `app/security.py`
- Create: `app/web/routes.py`
- Create: `app/web/templates/base.html`
- Create: `app/web/templates/login.html`
- Create: `app/web/templates/dashboard.html`
- Create: `app/web/static/app.css`

- [ ] 단일 비밀번호 로그인 구현.
- [ ] 모바일 우선 CSS 작성.
- [ ] 대시보드에 수집 상태, 후보 수, 승인 대기 수 표시.
- [ ] 로그인하지 않으면 대시보드 접근 차단.

### Task 4: 데이터 자동 수집과 CSV 업로드

**Files:**

- Create: `app/data/sources.py`
- Create: `app/data/collector.py`
- Create: `app/data/validators.py`
- Create: `app/data/imports.py`
- Create: `tests/test_data_validation.py`

- [ ] 관심종목과 벤치마크 가격 자동 수집 구현.
- [ ] CSV 업로드는 백업 경로로 구현.
- [ ] 필수 컬럼, 날짜, 가격, 거래량 검증.
- [ ] 수집 성공/실패를 `data_runs`에 저장.
- [ ] 실패 시 텔레그램 알림을 보낼 수 있도록 오류 메시지 반환.

### Task 5: 피처 계산과 후보 생성

**Files:**

- Create: `app/data/features.py`
- Create: `tests/test_features.py`

- [ ] 1일, 5일, 20일, 60일 수익률 계산.
- [ ] 20일 변동성 계산.
- [ ] 거래량 비율 계산.
- [ ] SPY/QQQ 상대강도 계산.
- [ ] 기본 후보 점수 계산.
- [ ] 후보 점수 40점 이상만 후보로 저장.

### Task 6: AI provider 구현

**Files:**

- Create: `app/ai/schema.py`
- Create: `app/ai/providers.py`
- Create: `app/ai/prompts.py`
- Create: `tests/test_ai_schema.py`

- [ ] Gemini provider 구현.
- [ ] Claude provider 구현.
- [ ] GPT provider 구현.
- [ ] API 키가 없으면 해당 provider 비활성 처리.
- [ ] 테스트용 Mock provider 구현.
- [ ] JSON 형식 검증 테스트 작성.

### Task 7: AI 의견서 생성

**Files:**

- Create: `app/ai/scoring.py`
- Create: `app/ai/orchestrator.py`
- Create: `tests/test_ai_memo_generation.py`

- [ ] 후보와 피처를 입력으로 받아 의견서 생성.
- [ ] 모델별 결과를 저장.
- [ ] 최종 의견서 JSON 생성.
- [ ] 점수 범위 검증.
- [ ] 근거/반대 근거 개수 검증.
- [ ] 같은 입력 재실행 시 점수 차이 기록.

### Task 8: 위험관리 필터

**Files:**

- Create: `app/risk/rules.py`
- Create: `tests/test_risk_rules.py`

- [ ] 70점 미만 승인 불가.
- [ ] 한 종목 7% 초과 승인 불가.
- [ ] 전체 주식 노출 70% 초과 승인 불가.
- [ ] 섹터 25% 초과 경고.
- [ ] 손절 기준 오류 승인 불가.
- [ ] 데이터 누락 후보 제외.

### Task 9: 의견서 화면과 승인 기록

**Files:**

- Modify: `app/web/routes.py`
- Create: `app/web/templates/candidates.html`
- Create: `app/web/templates/memo_detail.html`

- [ ] 후보 목록 화면 구현.
- [ ] 의견서 상세 화면 구현.
- [ ] 웹 승인/거절 버튼 구현.
- [ ] 승인/거절 기록 저장.
- [ ] 승인 불가 후보는 버튼 비활성화.

### Task 10: 텔레그램 알림과 승인

**Files:**

- Create: `app/telegram/bot.py`
- Create: `app/telegram/callbacks.py`
- Create: `tests/test_telegram_callbacks.py`

- [ ] 텔레그램 메시지 전송 구현.
- [ ] 승인/거절 callback 처리.
- [ ] 허용된 채팅 ID만 처리.
- [ ] 중복 callback 방지.
- [ ] 텔레그램 승인 결과를 DB에 저장.

### Task 11: 스케줄러

**Files:**

- Create: `app/scheduler.py`
- Modify: `app/main.py`
- Create: `tests/test_scheduler_jobs.py`

- [ ] 장마감 후 자동 수집 작업 등록.
- [ ] 피처 계산 작업 등록.
- [ ] 후보 생성 작업 등록.
- [ ] AI 의견서 생성 작업 등록.
- [ ] 사후 성과 업데이트 작업 등록.
- [ ] 중복 실행 방지.

### Task 12: 사후 성과 리포트

**Files:**

- Create: `app/reports/performance.py`
- Create: `tests/test_performance.py`

- [ ] 5일, 10일, 20일 수익률 계산.
- [ ] 벤치마크 대비 초과수익 계산.
- [ ] 점수 구간별 평균 성과 계산.
- [ ] 승인/거절 후보 성과 비교.
- [ ] 대시보드에 요약 표시.

### Task 13: QuantConnect 내보내기

**Files:**

- Create: `app/reports/lean_export.py`
- Create: `app/web/templates/exports.html`
- Create: `tests/test_lean_export.py`

- [ ] 승인된 의견서만 CSV 내보내기.
- [ ] 컬럼 순서 고정.
- [ ] 필수 가격 필드 누락 시 실패.
- [ ] 다운로드 화면 구현.
- [ ] LEAN 연결 방법을 README에 문서화.

### Task 14: 배포 준비

**Files:**

- Modify: `README.md`
- Modify: `.env.example`
- Modify: `railway.json`

- [ ] Railway 배포 명령 문서화.
- [ ] 환경변수 목록 문서화.
- [ ] Telegram webhook 설정 방법 문서화.
- [ ] API 키 없는 상태에서 앱이 켜지는지 확인.
- [ ] 실제 주문 기능이 없음을 README에 명확히 표시.

---

## 13. 테스트 기준

완료 전 반드시 확인:

```bash
pytest
```

수동 확인:

- 모바일 화면에서 로그인 가능.
- 관심종목 추가 가능.
- 자동 수집 실행 가능.
- CSV 업로드 가능.
- 후보 생성 가능.
- AI 의견서 생성 가능.
- 텔레그램 알림 수신 가능.
- 텔레그램 승인/거절 기록 가능.
- 사후 성과 계산 가능.
- LEAN용 CSV 다운로드 가능.

완료 정의:

- 데이터가 자동으로 들어온다.
- AI 의견서가 사람이 직접 쓰지 않아도 생성된다.
- 위험관리 필터가 승인 불가 후보를 막는다.
- 폰에서 후보를 보고 승인/거절 기록이 가능하다.
- 성과가 5일, 10일, 20일 기준으로 쌓인다.
- QuantConnect 연결을 위한 신호 파일을 만들 수 있다.

---

## 14. 참고 문서

- QuantConnect LEAN CLI: https://www.quantconnect.com/docs/v2/lean-cli
- LEAN backtest: https://www.quantconnect.com/docs/v2/lean-cli/api-reference/lean-backtest
- OpenAI Responses API: https://platform.openai.com/docs/api-reference/responses
- Claude structured outputs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Gemini structured outputs: https://ai.google.dev/gemini-api/docs/structured-output
