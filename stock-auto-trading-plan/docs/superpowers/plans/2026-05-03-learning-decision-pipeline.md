# Chart Learning Decision Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current memo app into a learning decision assistant that studies historical chart data, adds market/news/event context, and produces buy/hold/sell/watch decisions for paper trading first.

**Architecture:** Keep AI as the research analyst and explanation layer. Use deterministic data pipelines for chart features, future-outcome labels, model probabilities, calibrated probabilities, EV, and risk gates. Add non-chart context as structured features, not as free-form guesses.

**Tech Stack:** Python, FastAPI, SQLAlchemy, SQLite, pandas, scikit-learn, pytest, existing Jinja UI.

---

## User Intent Captured From Discussion

The user is a 22-year-old college student and does not have deep finance knowledge. Future explanations and UI copy should assume a beginner investor who needs clear reasoning, not professional trading shorthand.

The user's real goal is not simply:

```text
AI writes a buy/sell memo.
```

The real goal is:

```text
During military service,
the system watches markets every day,
records predictions,
tracks whether they were right or wrong,
learns from paper-trading outcomes,
and gradually improves the quality of buy/hold/sell/watch recommendations.
```

So the product should be framed as a learning research lab first, and a semi-automated trading assistant second.

Important interpretation:

```text
"AI learning" does not mean the LLM permanently retrains itself after every day.
```

Instead, use two kinds of learning:

```text
1. Statistical learning model
   - learns from historical chart features and future outcome labels
   - produces p_raw
   - improves as more paper-trading data accumulates

2. LLM research analyst
   - reads accumulated prediction logs and paper-trading results
   - finds repeated success/failure patterns
   - explains why predictions were right or wrong
   - proposes strategy improvement hypotheses
   - writes beginner-friendly learning reports
```

The LLM should not invent the final probability, EV, or math score. But it should be used heavily to analyze accumulated evidence and extract useful patterns from it.

Recommended LLM use:

```text
daily: explain current candidates and risks
weekly: summarize paper-trading results
monthly: find repeated failure/success patterns
monthly: propose strategy changes to test
always: explain conclusions in beginner-friendly language
```

Do not feed raw chart history directly into the LLM when the dataset is large. Feed compressed evidence:

```text
score bucket results
hit rates
average excess returns
top success patterns
top failure patterns
representative winning examples
representative losing examples
model confidence vs actual success
```

This keeps LLM usage useful and cost-controlled.

Decision boundary:

```text
ML/statistical model = probability and expected value
LLM = pattern interpretation, failure analysis, hypothesis generation, explanation
human = final approval
```

---

## Why This Plan Exists

The original goal was not just to generate AI-written opinions. The goal was:

```text
historical chart data
→ repeated learning
→ future trade outcome probability
→ AI explains whether buy/hold/sell/watch makes sense
→ user gives final approval
```

The current app has the first pieces:

- price collection
- chart features
- candidate generation
- AI memo generation
- math modules for EV, labeling, calibration, diagnostics

The missing part is the full connection:

```text
historical features
→ historical labels
→ starter alpha model
→ p_raw
→ p_calibrated
→ EV/math_score
→ decision memo
→ paper trading result tracking
```

This plan adds that connection.

---

## Decision Principle

Do not try to predict the exact future price.

Bad target:

```text
"AAPL will be exactly 214.32 after 10 trading days."
```

Better target:

```text
"Given the current chart/context pattern, is this trade likely to hit the upside barrier before the downside barrier, after costs?"
```

So the model should predict trade outcome probability, not an exact price.

---

## Hidden Risks And Guardrails

These are the gaps a beginner investor is likely to miss. They must be visible in the product, not buried in code comments.

### 1. Data Quality Illusion

Free data is acceptable for early paper trading, but it can make results look better than reality.

Common problems:

```text
delisted stocks missing
adjusted price errors
ticker changes missing
trading halts missing
dividend/split adjustments incomplete
```

Guardrail:

```text
Every dashboard and report must show data reliability:
research_only
paper_trading_ok
real_money_ready
```

MVP default:

```text
data_reliability = research_only
```

### 2. Paper Trading Fill Illusion

Paper trading can assume fills that would not happen in real life.

Guardrail:

Track both:

```text
paper_return = ideal close/next-open simulation
conservative_return = paper_return minus slippage/spread/stress cost
```

Real-money readiness can use only conservative performance.

### 3. Over-Frequent Model Changes

Daily model retraining looks smart but can chase noise.

Guardrail:

```text
daily: record predictions and outcomes
weekly: generate learning report
monthly: create retraining candidate
manual approval: required before model promotion
```

The live/paper model version should not change automatically just because one recent week looked good.

### 4. LLM Failure-Reason Hallucination

LLM can write convincing but unverified failure explanations.

Guardrail:

Every LLM failure note must include a confidence tier:

```text
confirmed
likely
hypothesis
insufficient_data
```

Only `confirmed` and `likely` causes may be used to propose rule changes. `hypothesis` must be tested before adoption.

### 5. Event Time Leakage

Events must not be used before the system could actually know them.

Required fields:

```text
event_date
available_at
usable_from
```

Guardrail:

```text
event feature can be used only if usable_from <= prediction_time
```

### 6. Market Regime Dependence

A strategy can work in rising markets and fail in falling markets.

Guardrail:

Performance must be split by:

```text
risk_on
risk_off
high_volatility
low_volatility
benchmark_up
benchmark_down
```

Overall average performance is not enough.

### 7. Universe Bias

If the user only tracks favorite big-tech stocks, the model learns only that narrow universe.

Guardrail:

Every run must record `universe_name`.

Examples:

```text
user_watchlist
nasdaq_100
sp500
top_dollar_volume_300
```

Performance must not be compared across universes without labeling the universe.

### 8. Tax, FX, And Account Friction

For a Korean user trading US stocks, real return can differ from USD chart return.

Guardrail:

Early MVP can use a simple cost buffer, but real-money readiness requires:

```text
FX buffer
broker fee
tax estimate
spread/slippage
```

### 9. Approval Delay

The user may not be able to check the app immediately during military service.

Guardrail:

Every memo must have validity rules:

```text
valid_until
max_entry_drift_pct
invalidated_by_event
```

Example:

```text
valid until next market open + 30 minutes
invalidate if price moves more than 1.5% from entry
invalidate if earnings/news event occurs
```

### 10. Good Explanation vs Good Performance

A memo can sound smart and still lose money.

Guardrail:

Track AI memo quality separately from model quality:

```text
AI strong-buy actual return
AI warning actually occurred
AI missed risk
AI hold/watch that later outperformed
reason quality after outcome
```

The LLM itself should be evaluated, not trusted just because the explanation is fluent.

---

## Workflow

### 1. Data Collection

```text
watchlist tickers
→ daily price bars
→ benchmark bars: SPY, QQQ
→ optional event/news/context data
```

### 2. Historical Feature Generation

For every ticker and every usable date, generate a feature row.

```text
ticker
as_of_date
return_5d
return_20d
return_60d
volatility_20d
volume_ratio_20d
relative_strength_spy
relative_strength_qqq
near_high_60d
near_low_60d
market_regime fields
event fields
```

This differs from the current app, which mostly keeps the latest feature row. The learning model needs historical rows across many dates.

### 3. Historical Label Generation

For each historical feature row, look forward 10 trading days and label what happened.

```text
1 = upside barrier touched first
0 = downside barrier touched first
1 = neither touched but benchmark-relative return positive
0 = neither touched but benchmark-relative return not positive
```

This is already supported by `app/math/labels.py`, but it needs to be connected to stored training rows.

### 4. Starter Alpha Model

Train a transparent starter model.

```text
input = historical feature rows
target = triple-barrier label
model = logistic regression
output = p_raw
```

`p_raw` means the model's raw estimated chance that the trade setup succeeds.

### 5. Probability Calibration

Raw model probabilities are usually overconfident. Calibrate them using past outcomes.

```text
p_raw 70~80% bucket
→ historical success rate in that bucket
→ p_calibrated
```

`p_calibrated` is the probability used for EV and approval.

### 6. Decision Math

For each candidate:

```text
gain = (review_price - entry_price) / entry_price
loss = (entry_price - stop_price) / entry_price
p_break_even = (loss + cost) / (gain + loss)
EV = p_calibrated * gain - (1 - p_calibrated) * loss - cost
reward_risk = gain / loss
```

Real-money approval requires:

```text
p_calibrated exists
EV > 0
p_calibrated >= p_break_even + 0.05
reward_risk >= 1.5
cost stress passes
human approval
```

Before enough historical samples exist, every trade is paper-only.

### 7. AI Decision Memo

AI should not invent the score. AI should explain the computed decision.

Memo sections:

```text
Decision: buy / hold / sell / watch
Mode: paper-only / approval-ready / blocked
Chart read
Model probability read
Math read
Market/sector context
News/event context
Key reasons
Counter reasons
Do-not-trade conditions
What would change the decision
```

### 8. Paper Trading Loop

Every generated memo is tracked.

```text
memo
→ paper decision recorded
→ 5/10/20 day outcome measured
→ label/result stored
→ model retraining dataset grows
→ calibration improves
```

This is the core "keeps learning while user is away" loop.

---

## Task 1: Store Historical Training Rows

**Files:**
- Modify: `app/models.py`
- Create: `app/learning/dataset.py`
- Test: `tests/test_learning_dataset.py`

- [ ] Add a `training_examples` table.

Required fields:

```text
id
ticker
as_of_date
feature_json
label
horizon_days
benchmark_ticker
created_at
```

- [ ] Implement `build_training_examples(db, horizon=10)`.

Behavior:

```text
For each ticker with enough historical price bars:
  For each usable historical date:
    Build the feature row using only data up to that date.
    Generate triple_barrier_label using future prices.
    Store one training example.
Skip rows with insufficient future data.
Skip duplicate ticker/as_of_date/horizon rows.
```

- [ ] Tests must verify:

```text
historical rows are created
future data is not used inside feature_json
insufficient future data is skipped
duplicate training rows are not inserted twice
```

---

## Task 2: Connect Starter Alpha Model To Candidates

**Files:**
- Modify: `app/ai/scoring.py`
- Create: `app/learning/predict.py`
- Test: `tests/test_learning_predict.py`

- [ ] Implement `predict_candidate_probability(db, candidate)`.

Behavior:

```text
Load the candidate feature row.
Load historical training examples.
Call starter_probability().
Return:
  p_raw
  probability_status
  training_sample_count
```

- [ ] Rules:

```text
If fewer than 100 labels exist, return p_raw=None and status="unavailable".
If model cannot train, return p_raw=None and status="unavailable".
Never use an AI-provided probability.
```

- [ ] Tests must verify:

```text
not enough labels returns unavailable
enough labels returns p_raw between 0 and 1
candidate prediction uses Feature values, not AI memo text
```

---

## Task 3: Connect Calibration To Candidate Math

**Files:**
- Modify: `app/ai/scoring.py`
- Create: `app/learning/calibration_store.py`
- Test: `tests/test_learning_calibration_store.py`

- [ ] Implement `historical_probability_rows(db)`.

Returns rows shaped like:

```python
{"p_raw": 0.72, "label": 1}
```

- [ ] Update `attach_deterministic_math()`.

New flow:

```text
candidate feature
→ p_raw from starter model
→ p_calibrated from calibration bins
→ EV/math_score/position_weight
```

- [ ] Rules:

```text
If p_calibrated is unavailable, mark memo as paper-only.
If p_calibrated is calibrated, calculate EV and math_score.
```

- [ ] Tests must verify:

```text
uncalibrated probability creates paper-only math data
calibrated probability creates EV and math_score
negative EV remains blocked
```

---

## Task 4: Add Paper-Only Mode Explicitly

**Files:**
- Modify: `app/risk/rules.py`
- Modify: `app/schemas.py`
- Modify: `app/web/templates/memo_detail.html`
- Test: `tests/test_risk_rules.py`

- [ ] Add a decision mode concept.

Values:

```text
paper_only
approval_ready
blocked
```

- [ ] Risk rules:

```text
probability unavailable → paper_only
probability uncalibrated → paper_only
calibrated but EV <= 0 → blocked
calibrated and EV > 0 but cost stress fails → paper_only
calibrated, EV > 0, margin passes, risk limits pass → approval_ready
```

- [ ] UI should show:

```text
실전 승인 불가: 보정 확률 표본 부족
모의 추적 가능
```

instead of making it look like a fatal error.

---

## Task 5: Add Market Regime Features

**Files:**
- Modify: `app/data/features.py`
- Test: `tests/test_features.py`

- [ ] Add market context features.

MVP fields:

```text
spy_return_20d
qqq_return_20d
spy_volatility_20d
qqq_volatility_20d
market_risk_on
```

- [ ] Simple `market_risk_on` rule:

```text
market_risk_on = 1 if SPY return_20d > 0 and QQQ return_20d > 0 else 0
```

- [ ] Tests must verify:

```text
market features are computed from benchmark bars
missing benchmark data gives neutral values
feature rows still generate without paid data
```

---

## Task 6: Add Event Context Schema

**Files:**
- Modify: `app/models.py`
- Create: `app/events/schema.py`
- Create: `app/events/ingest.py`
- Test: `tests/test_event_ingest.py`

- [ ] Add `event_features` table.

Required fields:

```text
id
ticker
event_date
available_at
usable_from
event_type
sentiment_score
uncertainty_score
guidance_score
risk_score
summary
source_url
created_at
```

- [ ] Implement CSV/manual ingest first.

This avoids pretending paid news APIs are already available.

Required CSV columns:

```text
ticker,event_date,available_at,event_type,sentiment_score,uncertainty_score,guidance_score,risk_score,summary,source_url
```

- [ ] Rules:

```text
Features can only be used on or after usable_from.
Rows without available_at are rejected.
Scores must be numeric and clamped to -1..1 or 0..1 depending on field.
```

---

## Task 7: Merge Event Context Into AI Memo

**Files:**
- Modify: `app/ai/orchestrator.py`
- Modify: `app/ai/prompts.py`
- Modify: `app/web/templates/memo_detail.html`
- Test: `tests/test_ai_orchestrator.py`

- [ ] Add recent event context to candidate prompt.

Include only events where:

```text
event.usable_from <= candidate.as_of_date
```

- [ ] Prompt must separate:

```text
chart_read
model_probability_read
math_read
market_context_read
event_context_read
```

- [ ] AI output may explain these sections, but cannot overwrite:

```text
p_raw
p_calibrated
EV
math_score
position_weight
```

---

## Task 8: Update Dashboard For Full Orchestrator View

**Files:**
- Modify: `app/web/routes.py`
- Modify: `app/web/templates/dashboard.html`
- Modify: `app/web/static/app.css`
- Test: `tests/test_web_routes.py`

- [ ] Dashboard should show the full loop.

Required blocks:

```text
Data status
Training rows count
Model probability status
Calibration status
Paper-only candidates
Approval-ready candidates
Blocked candidates
LEAN export count
```

- [ ] Add an "AI is learning" panel.

Show:

```text
training examples
latest model sample count
calibrated probability buckets
last paper result update
```

This helps the user understand that early months are for paper trading and calibration.

---

## Task 9: Add Scheduled Learning Loop

**Files:**
- Modify: `app/scheduler.py`
- Modify: `app/web/routes.py`
- Test: `tests/test_scheduler.py`

- [ ] After daily data collection:

```text
calculate features
generate candidates
build training examples
update performance snapshots
refresh probability calibration inputs
```

- [ ] Rules:

```text
No real-money approval is unlocked by scheduler alone.
Model/calibration updates can improve paper decisions.
Human approval remains required.
```

---

## Task 10: Documentation Update

**Files:**
- Modify: `STRATEGY.md`
- Modify: `IMPLEMENTATION_PLAN.md`
- Modify: `README.md`

- [ ] Explain the final decision flow:

```text
Chart model predicts probability.
Calibration corrects that probability.
Event/market context explains why the signal may or may not be valid.
EV decides whether the setup is mathematically worth considering.
Risk engine decides whether it is allowed.
User gives final approval.
```

- [ ] Make clear that chart-only is not enough.

Minimum decision inputs:

```text
chart/price
volume/liquidity
market regime
event/news context
calibrated model probability
EV and risk limits
```

---

## Task 11: Add Data Reliability Status

**Files:**
- Modify: `app/models.py`
- Create: `app/data/reliability.py`
- Modify: `app/web/routes.py`
- Modify: `app/web/templates/dashboard.html`
- Test: `tests/test_data_reliability.py`

- [ ] Add `data_reliability` calculation.

MVP rules:

```text
research_only:
  free/manual data, no delisted coverage, no verified corporate action audit

paper_trading_ok:
  adjusted prices present, benchmark data present, no missing bars in recent window

real_money_ready:
  delisted coverage checked, corporate actions checked, trading halt handling checked
```

- [ ] Dashboard must show current reliability state.

Default must be:

```text
research_only
```

---

## Task 12: Add Conservative Paper Fill Metrics

**Files:**
- Modify: `app/reports/performance.py`
- Modify: `app/models.py`
- Test: `tests/test_performance.py`

- [ ] Store both ideal and conservative returns.

Required fields:

```text
paper_return_pct
conservative_return_pct
cost_assumption_pct
```

- [ ] Conservative return rule:

```text
conservative_return_pct = return_pct - 0.005
```

MVP uses 0.5% stress cost until broker execution data exists.

- [ ] Real-money readiness checks must use conservative returns.

---

## Task 13: Add Model Version And Promotion Rules

**Files:**
- Modify: `app/models.py`
- Create: `app/learning/model_registry.py`
- Test: `tests/test_model_registry.py`

- [ ] Add model version records.

Required fields:

```text
model_name
model_version
trained_at
training_sample_count
validation_summary_json
status
approved_by_user
```

Allowed statuses:

```text
candidate
paper_active
retired
rejected
```

- [ ] Promotion rule:

```text
Only user-approved candidate models can become paper_active.
No automatic real-money activation.
```

---

## Task 14: Add LLM Failure Note Confidence Tiers

**Files:**
- Modify: `app/ai/prompts.py`
- Modify: `app/ai/schema.py`
- Create: `app/reports/learning_notes.py`
- Test: `tests/test_learning_notes.py`

- [ ] LLM learning notes must include:

```text
failure_reason
confidence_tier
evidence
suggested_rule_change
```

Allowed confidence tiers:

```text
confirmed
likely
hypothesis
insufficient_data
```

- [ ] Rule changes from `hypothesis` must be marked test-only.

---

## Task 15: Enforce Event Time Leakage Rules

**Files:**
- Modify: `app/events/ingest.py`
- Modify: `app/ai/orchestrator.py`
- Test: `tests/test_event_time_leakage.py`

- [ ] Reject event rows without `available_at`.

- [ ] Candidate context may include only:

```text
event.usable_from <= candidate.as_of_date
```

- [ ] Tests must verify:

```text
post-market event is not used for same-day pre-market decision
past event is included
missing available_at is rejected
```

---

## Task 16: Add Market Regime Performance Split

**Files:**
- Modify: `app/reports/performance.py`
- Modify: `app/web/templates/dashboard.html`
- Test: `tests/test_performance.py`

- [ ] Performance report must split by:

```text
risk_on
risk_off
high_volatility
low_volatility
benchmark_up
benchmark_down
```

- [ ] Dashboard must show regime performance separately from overall performance.

---

## Task 17: Track Universe Name

**Files:**
- Modify: `app/models.py`
- Modify: `app/data/features.py`
- Modify: `app/reports/performance.py`
- Test: `tests/test_universe_tracking.py`

- [ ] Add `universe_name` to candidates, training examples, and performance summaries.

Default:

```text
user_watchlist
```

- [ ] Reports must not aggregate across universes unless explicitly grouped.

---

## Task 18: Add Memo Validity Rules

**Files:**
- Modify: `app/ai/orchestrator.py`
- Modify: `app/models.py`
- Modify: `app/risk/rules.py`
- Modify: `app/web/templates/memo_detail.html`
- Test: `tests/test_memo_validity.py`

- [ ] Add memo validity fields:

```text
valid_until
max_entry_drift_pct
invalidated_by_event
```

MVP defaults:

```text
valid_until = next_market_open + 30 minutes
max_entry_drift_pct = 0.015
invalidated_by_event = true
```

- [ ] Risk engine must mark stale memos as blocked or paper-only.

---

## Task 19: Track AI Memo Quality

**Files:**
- Create: `app/reports/ai_quality.py`
- Modify: `app/web/templates/dashboard.html`
- Test: `tests/test_ai_quality.py`

- [ ] Track:

```text
AI strong-buy actual return
AI warning actually occurred
AI missed risk count
AI watch/hold that later outperformed
reason quality after outcome
```

- [ ] Dashboard must show AI quality separately from model probability quality.

This prevents fluent explanations from being mistaken for real predictive skill.

---

## Task 20: Add S&P 500 Auto Universe

**Files:**
- Create: `app/data/universe.py`
- Modify: `app/models.py`
- Modify: `app/scheduler.py`
- Modify: `app/web/routes.py`
- Modify: `app/web/templates/uploads.html`
- Test: `tests/test_universe.py`

- [ ] Add automatic universe sources.

MVP universe options:

```text
user_watchlist
sp500
nasdaq100
```

Default operating mode:

```text
user_watchlist + SPY + QQQ
```

Recommended next mode:

```text
sp500 + SPY + QQQ
```

- [ ] Implement `refresh_sp500_universe(db)`.

Behavior:

```text
Fetch or load S&P 500 ticker list.
Upsert tickers into Watchlist.
Set universe_name = "sp500" where applicable.
Keep SPY and QQQ as benchmark tickers.
Do not delete manually added user tickers.
```

- [ ] Source rule:

```text
Use a replaceable provider function.
MVP can use a bundled CSV fallback for repeatable tests.
Network fetch can be added later with caching.
```

- [ ] Filtering rule:

```text
Exclude tickers with obviously invalid symbols.
Do not run AI memo generation for all 500 names every day.
Use chart/model pre-filter first, then generate AI memos only for top candidates.
```

Cost control:

```text
Collect prices for all universe tickers.
Generate AI memos only for top 5~20 candidates per day.
Cache repeated event/news summaries.
```

- [ ] Dashboard should show:

```text
active universe
tracked ticker count
benchmark tickers
last universe refresh time
```

---

## Task 21: Financial Statement Data Policy

**Files:**
- Modify: `STRATEGY.md`
- Modify: `IMPLEMENTATION_PLAN.md`
- Modify: `README.md`

- [ ] Document that financial statements are not required for the first learning loop.

MVP does not need full financial statement ingestion because the first goal is:

```text
chart learning
paper prediction logging
probability calibration
LLM result analysis
```

- [ ] Add financial data as phase-2 context.

Phase-2 fields:

```text
revenue_growth
gross_margin
operating_margin
eps_surprise
guidance_change
debt_to_equity
free_cash_flow_trend
```

- [ ] Rule:

```text
Do not let missing financial statements block MVP paper trading.
Do mark memos as "financial_context_missing" when financial data is unavailable.
```

- [ ] LLM memo policy:

```text
If financial data is missing, AI must say "재무제표 기반 판단은 아직 제외됨."
AI may still analyze chart/model/event context.
```

Reason:

```text
For short 5~20 trading day paper decisions, chart, volume, market regime, and event timing can be enough for MVP.
Financial statements become more important for longer holding periods and real-money readiness.
```

---

## Done Criteria

- Historical training examples are built from past chart data.
- Labels use future outcome data only for training, never for live prediction.
- Candidate memos receive `p_raw` when enough training rows exist.
- Candidate memos receive `p_calibrated` when enough calibration rows exist.
- Uncalibrated candidates are paper-only, not silently treated as failures.
- Calibrated candidates calculate EV, math_score, and position size.
- AI memo separates chart, model, math, market, and event reasoning.
- Dashboard shows the full learning loop and current readiness state.
- Paper trading results feed back into future calibration.
- No paid data dependency is required for the MVP.
- Data reliability is visible and defaults to research-only.
- Paper performance includes conservative fill estimates.
- Model changes require explicit promotion.
- LLM failure notes include confidence tiers.
- Event features cannot leak future information.
- Performance is split by market regime and universe.
- Memos have validity windows and invalidation rules.
- AI memo quality is tracked separately from model quality.
- S&P 500 universe can be refreshed without deleting user-added tickers.
- AI memo generation is capped after pre-filtering, so S&P 500 tracking does not explode API cost.
- Financial statements are explicitly phase-2 and do not block MVP paper learning.
