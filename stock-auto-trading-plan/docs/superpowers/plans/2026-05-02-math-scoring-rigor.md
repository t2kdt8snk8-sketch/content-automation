# Math Scoring Rigor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace subjective AI/heuristic scoring with deterministic math metrics: break-even probability, calibrated probability, expected value, reward/risk, and capped position sizing.

**Architecture:** Keep the current heuristic score only as a cheap candidate pre-filter. Final memo approval must use computed math fields; the AI explains the computed values but cannot invent or overwrite them.

**Tech Stack:** Python, SQLAlchemy, pytest, existing FastAPI/Jinja app.

---

## Current Gaps

- `app/data/features.py` uses hand-picked point weights such as `+15`, `+10`, `-10`. This is acceptable for candidate discovery, not final investment judgment.
- `app/ai/scoring.py` currently selects the AI payload with the highest `scores.total`, which rewards overconfident answers.
- `app/ai/prompts.py` asks the AI to generate scores directly. That makes the score subjective.
- `app/risk/rules.py` blocks by rough score thresholds, but does not require positive expected value or calibrated probability.

---

## Required Math

### Trade Terms

```text
entry = proposed entry price
target = review price
stop = stop price
gain = (target - entry) / entry
loss = (entry - stop) / entry
cost = commission + slippage + spread_buffer
```

Reject if:

```text
entry <= 0
target <= entry
stop >= entry
gain <= 0
loss <= 0
```

### Break-Even Probability

This is the minimum win probability needed after costs.

```text
p_break_even = (loss + cost) / (gain + loss)
```

Example:

```text
gain = 0.06
loss = 0.03
cost = 0.003
p_break_even = 0.033 / 0.09 = 36.7%
```

### Expected Value

```text
EV = p_calibrated * gain - (1 - p_calibrated) * loss - cost
```

Approval requires:

```text
EV > 0
p_calibrated >= p_break_even + 0.05
gain / loss >= 1.5
```

The `+0.05` buffer is a margin of safety. It prevents trades that are barely positive only because of noisy estimates.

### Probability Calibration

Do not trust raw model probability directly.

```text
p_raw = model output
p_calibrated = calibration_model(p_raw)
```

### Raw Probability Source

The current MVP has no trained alpha model yet, so `p_raw` must come from a transparent starter model, not from the LLM.

MVP source:

```text
p_raw = logistic regression probability
features =
  return_5d
  return_20d
  return_60d
  volatility_20d
  volume_ratio_20d
  relative_strength_spy
  relative_strength_qqq
  near_high_60d
  near_low_60d
label = triple_barrier_label
```

Fallback before enough labels exist:

```text
p_raw = None
probability_status = "unavailable"
approval_status = blocked
```

Do not use an AI-written probability as `p_raw`. AI may comment on probability quality, but the probability itself must come from the model/calibration pipeline.

MVP calibration:

```text
bucket raw probabilities into 10 bins
for each bin:
  calibrated probability = historical success rate in that bin
```

Minimum requirements:

```text
historical labeled trades >= 100
bucket sample count >= 20
otherwise probability_status = "uncalibrated"
```

If probability is uncalibrated, the system may create a memo but must mark the trade as paper-only or approval-blocked.

### Triple-Barrier Label

Use this to build historical success/failure labels.

```text
horizon = 10 trading days
upper_barrier = entry * (1 + 2.0 * volatility_20d)
lower_barrier = entry * (1 - 1.0 * volatility_20d)
```

Label:

```text
1  if upper barrier touched first
0  if lower barrier touched first
0  if neither touched by horizon and benchmark-relative return <= 0
1  if neither touched by horizon and benchmark-relative return > 0
```

Benchmark-relative time-expiry rule:

```text
stock_return = close_at_horizon / entry - 1
benchmark_return = benchmark_close_at_horizon / benchmark_entry - 1
benchmark_relative_return = stock_return - benchmark_return
```

For current price-only MVP, use only data known at `as_of_date`. When event data is added, labels and features must use `available_at`, not event date.

### Cost Model

Do not use zero-cost backtests.

MVP default:

```text
commission = 0.0000
slippage = 0.0010
spread_buffer = 0.0010
fx_or_tax_buffer = 0.0010
cost = commission + slippage + spread_buffer + fx_or_tax_buffer
```

This gives:

```text
cost = 0.0030
```

The value is intentionally simple and conservative. If the broker provides measured execution data later, replace the constants with observed average cost.

### Final Score

Do not ask AI to invent this.

```text
ev_score = clamp(EV / 0.03, 0, 1) * 35
prob_score = clamp((p_calibrated - p_break_even) / 0.20, 0, 1) * 25
rr_score = clamp((reward_risk - 1.0) / 2.0, 0, 1) * 20
liquidity_score = clamp(log10(dollar_volume) / 9, 0, 1) * 10
stability_score = clamp(1 - volatility_20d / 0.08, 0, 1) * 10

math_score = ev_score + prob_score + rr_score + liquidity_score + stability_score
```

Approval action bands:

```text
math_score < 60: reject
60 <= math_score < 75: watch only
75 <= math_score < 85: small position candidate
math_score >= 85: normal position candidate, still needs human approval
```

### Position Sizing

Use capped fractional Kelly, then apply hard limits.

```text
kelly_raw = p_calibrated / loss - (1 - p_calibrated) / gain
kelly_scaled = k * max(kelly_raw, 0)
position_weight = min(kelly_scaled, 0.07, sector_remaining, account_remaining)
```

MVP settings:

```text
k = 0.10
single_name_cap = 0.07
sector_cap = 0.25
account_equity_cap = 0.70
```

If probability is uncalibrated:

```text
position_weight = 0
approval_status = blocked
```

### Validation Layer

The system must track whether the math is reliable, not only whether the latest trade looks positive.

First-pass required diagnostics:

```text
EV confidence interval
score monotonicity by bucket
calibration quality metrics
cost sensitivity
```

Second-pass diagnostics:

```text
purged walk-forward validation
model stability report
```

---

## Task 1: Add Deterministic Math Module

**Files:**
- Create: `app/math/__init__.py`
- Create: `app/math/trade_math.py`
- Test: `tests/test_trade_math.py`

- [x] Create pure functions:

```python
def trade_terms(entry: float, stop: float, target: float, cost: float) -> dict:
    gain = (target - entry) / entry
    loss = (entry - stop) / entry
    break_even = (loss + cost) / (gain + loss)
    reward_risk = gain / loss
    return {
        "gain": gain,
        "loss": loss,
        "cost": cost,
        "p_break_even": break_even,
        "reward_risk": reward_risk,
    }

def expected_value(p: float, gain: float, loss: float, cost: float) -> float:
    return p * gain - (1 - p) * loss - cost

def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))

def math_score(ev: float, p: float, p_break_even: float, reward_risk: float, dollar_volume: float, volatility_20d: float) -> float:
    ev_score = clamp(ev / 0.03, 0, 1) * 35
    prob_score = clamp((p - p_break_even) / 0.20, 0, 1) * 25
    rr_score = clamp((reward_risk - 1.0) / 2.0, 0, 1) * 20
    liquidity_score = clamp(math.log10(max(dollar_volume, 1)) / 9, 0, 1) * 10
    stability_score = clamp(1 - volatility_20d / 0.08, 0, 1) * 10
    return ev_score + prob_score + rr_score + liquidity_score + stability_score
```

- [x] Tests must verify:
  - invalid `entry`, `stop`, `target` is rejected
  - break-even probability formula
  - EV positive/negative examples
  - score clamps to `0..100`

---

## Task 2: Add Triple-Barrier Labeling

**Files:**
- Create: `app/math/labels.py`
- Test: `tests/test_labels.py`

- [x] Implement:

```python
def triple_barrier_label(
    closes: list[float],
    benchmark_closes: list[float],
    entry_index: int,
    volatility: float,
    horizon: int = 10,
) -> int | None:
    entry = closes[entry_index]
    benchmark_entry = benchmark_closes[entry_index]
    upper = entry * (1 + 2.0 * volatility)
    lower = entry * (1 - 1.0 * volatility)
    future = closes[entry_index + 1 : entry_index + horizon + 1]
    benchmark_future = benchmark_closes[entry_index + 1 : entry_index + horizon + 1]
    if len(future) < horizon or len(benchmark_future) < horizon:
        return None
    for close in future:
        if close >= upper:
            return 1
        if close <= lower:
            return 0
    stock_return = future[-1] / entry - 1
    benchmark_return = benchmark_future[-1] / benchmark_entry - 1
    return 1 if stock_return - benchmark_return > 0 else 0
```

- [x] Tests must cover upper touched first, lower touched first, insufficient future data, neither touched but benchmark-relative positive, neither touched but benchmark-relative negative.

---

## Task 3: Add Starter Probability Model

**Files:**
- Create: `app/math/probability.py`
- Test: `tests/test_probability.py`

- [x] Implement a transparent starter model wrapper:

```python
@dataclass(frozen=True)
class ProbabilityResult:
    p_raw: float | None
    status: str
    sample_count: int

def starter_probability(feature_row: dict, training_rows: list[dict]) -> ProbabilityResult:
    if len(training_rows) < 100:
        return ProbabilityResult(None, "unavailable", len(training_rows))
    try:
        from sklearn.linear_model import LogisticRegression
    except ImportError:
        return ProbabilityResult(None, "unavailable", len(training_rows))

    feature_names = [
        "return_5d",
        "return_20d",
        "return_60d",
        "volatility_20d",
        "volume_ratio_20d",
        "relative_strength_spy",
        "relative_strength_qqq",
        "near_high_60d",
        "near_low_60d",
    ]
    x_train = [[float(row.get(name) or 0.0) for name in feature_names] for row in training_rows]
    y_train = [int(row["label"]) for row in training_rows]
    if len(set(y_train)) < 2:
        return ProbabilityResult(None, "unavailable", len(training_rows))
    model = LogisticRegression(max_iter=1000)
    model.fit(x_train, y_train)
    x_live = [[float(feature_row.get(name) or 0.0) for name in feature_names]]
    p_raw = float(model.predict_proba(x_live)[0][1])
    return ProbabilityResult(p_raw, "available", len(training_rows))
```

- [x] Tests must verify:
  - fewer than 100 labels returns `unavailable`
  - returned probability, when available, is within `0..1`
  - no LLM/AI output can be accepted as `p_raw`

---

## Task 4: Calibrate Probabilities

**Files:**
- Create: `app/math/calibration.py`
- Test: `tests/test_calibration.py`

- [x] Implement 10-bin calibration:

```text
input: historical rows with p_raw and label
output:
  p_calibrated
  sample_count
  calibration_status
```

- [x] Rules:
  - fewer than 100 historical labels: `uncalibrated`
  - selected bin count below 20: `uncalibrated`
  - otherwise return bin historical success rate

---

## Task 5: Make AI Scores Read-Only

**Files:**
- Modify: `app/ai/prompts.py`
- Modify: `app/ai/orchestrator.py`
- Modify: `app/ai/schema.py`
- Test: `tests/test_ai_schema.py`

- [x] Prompt must say:

```text
Do not create scores. Use the provided math_score, EV, break-even probability, and risk/reward values exactly.
```

- [x] AI may return:

```json
{
  "recommendation": "buy|hold|sell|watch",
  "confidence_comment": "",
  "key_reasons": [],
  "counter_reasons": [],
  "bull_case": "",
  "bear_case": "",
  "do_not_trade_if": []
}
```

- [x] System, not AI, writes:

```text
total_score
expected_value
p_break_even
p_calibrated
reward_risk
max_weight
```

---

## Task 6: Risk Engine Must Use EV

**Files:**
- Modify: `app/risk/rules.py`
- Test: `tests/test_risk_rules.py`

- [x] Approval must block if:

```text
probability_status != calibrated
EV <= 0
p_calibrated < p_break_even + 0.05
reward_risk < 1.5
max_weight > 0.07
```

- [x] Keep existing hard safety limits:

```text
single name <= 7%
sector <= 25%
total stock exposure <= 70%
stop < entry
```

---

## Task 7: Update Docs

**Files:**
- Modify: `STRATEGY.md`
- Modify: `IMPLEMENTATION_PLAN.md`

- [x] Replace “AI 점수 기준표” wording with:

```text
AI 점수는 최종 판단 숫자가 아니다.
최종 판단 숫자는 시스템이 계산한 EV, p_break_even, p_calibrated, reward_risk, math_score다.
AI는 이 숫자를 해석하고 반대 근거를 쓰는 역할이다.
```

- [x] Keep the old heuristic score only as:

```text
cheap candidate pre-filter
```

---

## Task 8: Add EV Confidence Diagnostics

**Files:**
- Create: `app/math/confidence.py`
- Test: `tests/test_confidence.py`

- [x] Implement deterministic confidence helpers:

```python
import math
import statistics

def mean_ci_95(values: list[float]) -> dict:
    if len(values) < 30:
        return {"status": "insufficient", "mean": None, "lower": None, "upper": None, "sample_count": len(values)}
    mean = statistics.fmean(values)
    stdev = statistics.stdev(values)
    half_width = 1.96 * stdev / math.sqrt(len(values))
    return {
        "status": "ok",
        "mean": mean,
        "lower": mean - half_width,
        "upper": mean + half_width,
        "sample_count": len(values),
    }

def quantile(values: list[float], q: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, int(q * (len(ordered) - 1))))
    return ordered[index]
```

- [x] Approval rule:

```text
If historical EV sample count < 30: mark as paper-only.
If 95% EV lower bound <= 0: mark as watch or paper-only, not normal position.
If 10th percentile EV <= -0.01: add risk warning.
```

- [x] Tests must verify:
  - fewer than 30 samples returns `insufficient`
  - positive stable EV has lower bound above zero
  - noisy EV can have positive mean but lower bound below zero
  - quantile returns the expected 10th percentile item

---

## Task 9: Add Score Monotonicity Diagnostics

**Files:**
- Create: `app/math/monotonicity.py`
- Test: `tests/test_monotonicity.py`

- [x] Implement bucket diagnostics:

```python
SCORE_BUCKETS = [(0, 60), (60, 75), (75, 85), (85, 101)]

def score_bucket_summary(rows: list[dict]) -> list[dict]:
    result = []
    for low, high in SCORE_BUCKETS:
        bucket = [row for row in rows if low <= float(row["score"]) < high]
        returns = [float(row["excess_return"]) for row in bucket]
        avg = sum(returns) / len(returns) if returns else None
        result.append({"low": low, "high": high, "count": len(bucket), "avg_excess_return": avg})
    return result

def monotonicity_pass(summary: list[dict], min_count: int = 20, tolerance: float = 0.002) -> bool:
    valid = [row for row in summary if row["count"] >= min_count and row["avg_excess_return"] is not None]
    if len(valid) < 3:
        return False
    for left, right in zip(valid, valid[1:]):
        if right["avg_excess_return"] + tolerance < left["avg_excess_return"]:
            return False
    return True
```

- [x] Deployment rule:

```text
If monotonicity fails, math_score can still be displayed but cannot be used for real-money approval.
```

- [x] Tests must verify:
  - increasing bucket returns pass
  - higher score bucket underperforming fails
  - not enough samples fails

---

## Task 10: Add Calibration Quality Metrics

**Files:**
- Create: `app/math/calibration_metrics.py`
- Test: `tests/test_calibration_metrics.py`

- [x] Implement:

```python
import math

def brier_score(rows: list[dict]) -> float:
    return sum((float(row["p"]) - int(row["label"])) ** 2 for row in rows) / len(rows)

def log_loss(rows: list[dict], eps: float = 1e-12) -> float:
    total = 0.0
    for row in rows:
        p = min(1 - eps, max(eps, float(row["p"])))
        y = int(row["label"])
        total += y * math.log(p) + (1 - y) * math.log(1 - p)
    return -total / len(rows)

def expected_calibration_error(rows: list[dict], bins: int = 10) -> float:
    total = 0.0
    n = len(rows)
    for bin_index in range(bins):
        low = bin_index / bins
        high = (bin_index + 1) / bins
        bucket = [row for row in rows if low <= float(row["p"]) < high or (bin_index == bins - 1 and float(row["p"]) == 1.0)]
        if not bucket:
            continue
        avg_p = sum(float(row["p"]) for row in bucket) / len(bucket)
        avg_y = sum(int(row["label"]) for row in bucket) / len(bucket)
        total += len(bucket) / n * abs(avg_p - avg_y)
    return total
```

- [x] Quality gates:

```text
Brier score must be better than constant base-rate predictor.
Expected calibration error should be <= 0.10 for real-money approval.
Log loss is tracked; sudden monthly increase triggers warning.
```

- [x] Tests must verify:
  - perfect predictions have lower Brier score than poor predictions
  - log loss is finite for p=0 and p=1 because of clipping
  - ECE is zero when predicted bucket probability matches actual bucket rate

---

## Task 11: Add Cost Sensitivity Check

**Files:**
- Create: `app/math/cost_sensitivity.py`
- Test: `tests/test_cost_sensitivity.py`

- [x] Implement:

```python
from app.math.trade_math import expected_value

DEFAULT_COST_GRID = [0.001, 0.003, 0.005]

def cost_sensitivity(p: float, gain: float, loss: float, costs: list[float] = DEFAULT_COST_GRID) -> list[dict]:
    return [
        {"cost": cost, "ev": expected_value(p, gain, loss, cost), "pass": expected_value(p, gain, loss, cost) > 0}
        for cost in costs
    ]

def passes_stress_cost(rows: list[dict], stress_cost: float = 0.005) -> bool:
    stress_rows = [row for row in rows if abs(float(row["cost"]) - stress_cost) < 1e-12]
    return bool(stress_rows) and all(row["ev"] > 0 for row in stress_rows)
```

- [x] Approval rule:

```text
If base cost EV is positive but 0.5% stress-cost EV is negative, downgrade to watch.
```

- [x] Tests must verify:
  - EV decreases as cost increases
  - strategy that only works at low cost fails stress check
  - strategy that remains positive at 0.5% passes stress check

---

## Task 12: Add Purged Walk-Forward Split

**Files:**
- Create: `app/math/walk_forward.py`
- Test: `tests/test_walk_forward.py`

- [x] Implement date split generator:

```python
from dataclasses import dataclass
from datetime import date, timedelta

@dataclass(frozen=True)
class WalkForwardSplit:
    train_start: date
    train_end: date
    test_start: date
    test_end: date
    embargo_start: date
    embargo_end: date

def purged_walk_forward_splits(start: date, end: date, train_days: int, test_days: int, embargo_days: int) -> list[WalkForwardSplit]:
    splits = []
    train_start = start
    while True:
        train_end = train_start + timedelta(days=train_days - 1)
        embargo_start = train_end + timedelta(days=1)
        embargo_end = train_end + timedelta(days=embargo_days)
        test_start = embargo_end + timedelta(days=1)
        test_end = test_start + timedelta(days=test_days - 1)
        if test_end > end:
            break
        splits.append(WalkForwardSplit(train_start, train_end, test_start, test_end, embargo_start, embargo_end))
        train_start = train_start + timedelta(days=test_days)
    return splits
```

- [x] Rule:

```text
embargo_days must be at least the label horizon.
For 10-trading-day labels, use at least 14 calendar days as MVP embargo.
```

- [x] Tests must verify:
  - no train/test overlap
  - embargo sits between train and test
  - no split extends beyond final date

---

## Task 13: Add Model Stability Report

**Files:**
- Create: `app/math/stability.py`
- Test: `tests/test_stability.py`

- [x] Implement simple stability checks:

```python
def top_feature_overlap(left: list[str], right: list[str], k: int = 5) -> float:
    left_top = set(left[:k])
    right_top = set(right[:k])
    return len(left_top & right_top) / k

def coefficient_sign_stability(rows: list[dict]) -> dict:
    result = {}
    features = sorted({row["feature"] for row in rows})
    for feature in features:
        signs = [1 if float(row["coefficient"]) > 0 else -1 if float(row["coefficient"]) < 0 else 0 for row in rows if row["feature"] == feature]
        dominant = max(set(signs), key=signs.count)
        result[feature] = signs.count(dominant) / len(signs)
    return result

def period_return_concentration(period_returns: list[float]) -> float:
    total_abs = sum(abs(value) for value in period_returns)
    if total_abs == 0:
        return 0.0
    return max(abs(value) for value in period_returns) / total_abs
```

- [x] Warning rules:

```text
top feature overlap below 0.40 across adjacent walk-forward folds: warning
coefficient sign stability below 0.70 for major features: warning
single period contributes over 40% of absolute return: warning
```

- [x] Tests must verify:
  - identical top features return overlap 1.0
  - disjoint top features return overlap 0.0
  - stable coefficient signs produce high stability
  - one-period return domination produces high concentration

---

## Done Criteria

- `python -m pytest` passes.
- AI can no longer invent `scores.total`.
- A memo with negative EV is approval-blocked.
- A memo with uncalibrated probability is approval-blocked or paper-only.
- A memo with positive EV but non-positive EV lower confidence bound is not normal-position eligible.
- Score bucket monotonicity is tracked before real-money approval.
- Calibration quality metrics are tracked before real-money approval.
- Cost sensitivity at 0.5% stress cost is tracked before real-money approval.
- Candidate generation still works without paid data.
- No new paid data dependency is introduced.
