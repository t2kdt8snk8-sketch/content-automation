from __future__ import annotations

from typing import Any

from app.math.cost_sensitivity import cost_sensitivity, passes_stress_cost
from app.math.trade_math import DEFAULT_COST, capped_fractional_kelly, expected_value, math_score, trade_terms


def coerce_total_score(payload: dict[str, Any]) -> float:
    scores = payload.get("scores") or {}
    if isinstance(scores.get("total"), (int, float)):
        return float(scores["total"])
    total = 0.0
    for key in ("price_trend", "fundamental", "news_event", "flow_volume", "risk", "reward_risk"):
        value = scores.get(key, 0)
        if isinstance(value, (int, float)):
            total += value
    total = max(0.0, min(100.0, total))
    scores["total"] = total
    payload["scores"] = scores
    return total


def merge_provider_payloads(payloads: list[dict[str, Any]]) -> dict[str, Any]:
    if not payloads:
        raise ValueError("no valid AI payloads")
    payloads = sorted(
        payloads,
        key=lambda p: len(p.get("key_reasons") or []) + len(p.get("counter_reasons") or []),
        reverse=True,
    )
    return payloads[0].copy()


def attach_deterministic_math(payload: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    final = payload.copy()
    features = context.get("features") or {}
    learning = context.get("learning") or {}
    try:
        terms = trade_terms(
            entry=float(final["entry_price"]),
            stop=float(final["stop_price"]),
            target=float(final["review_price"]),
            cost=DEFAULT_COST,
        )
    except (KeyError, TypeError, ValueError):
        final["math"] = {
            "probability_status": "invalid_trade_terms",
            "decision_mode": "blocked",
            "math_score": 0.0,
            "expected_value": None,
            "p_break_even": None,
            "p_raw": None,
            "p_calibrated": None,
            "reward_risk": None,
            "cost": DEFAULT_COST,
            "position_weight": 0.0,
            "cost_sensitivity": [],
            "cost_stress_pass": False,
        }
        final["scores"] = _score_payload(0.0, 0.0, 0.0, 0.0, context)
        final["max_weight"] = 0.0
        final["decision_mode"] = "blocked"
        return final

    p_raw = learning.get("p_raw")
    p_calibrated = learning.get("p_calibrated")
    probability_status = str(learning.get("probability_status") or "unavailable")
    calibration_sample_count = int(learning.get("calibration_sample_count") or 0)
    training_sample_count = int(learning.get("training_sample_count") or 0)
    ev = None
    score = 0.0
    position_weight = 0.0
    sensitivity: list[dict[str, Any]] = []
    stress_pass = False
    dollar_volume = float(context.get("latest_dollar_volume") or 0.0)
    volatility = float(features.get("volatility_20d") or 0.0)

    if p_calibrated is not None:
        p_calibrated = float(p_calibrated)
        ev = expected_value(p_calibrated, terms["gain"], terms["loss"], DEFAULT_COST)
        score = math_score(ev, p_calibrated, terms["p_break_even"], terms["reward_risk"], dollar_volume, volatility)
        position_weight = capped_fractional_kelly(p_calibrated, terms["gain"], terms["loss"])
        sensitivity = cost_sensitivity(p_calibrated, terms["gain"], terms["loss"])
        stress_pass = passes_stress_cost(sensitivity)
    decision_mode = _decision_mode(probability_status, ev, p_calibrated, terms, stress_pass)

    final["math"] = {
        "probability_status": probability_status,
        "decision_mode": decision_mode,
        "math_score": score,
        "expected_value": ev,
        "p_break_even": terms["p_break_even"],
        "p_raw": p_raw,
        "p_calibrated": p_calibrated,
        "reward_risk": terms["reward_risk"],
        "gain": terms["gain"],
        "loss": terms["loss"],
        "cost": DEFAULT_COST,
        "position_weight": position_weight,
        "cost_sensitivity": sensitivity,
        "cost_stress_pass": stress_pass,
        "training_sample_count": training_sample_count,
        "calibration_sample_count": calibration_sample_count,
    }
    final["scores"] = _score_payload(score, ev, terms["reward_risk"], volatility, context)
    final["max_weight"] = position_weight
    final["decision_mode"] = decision_mode
    return final


def _decision_mode(
    probability_status: str,
    ev: float | None,
    p_calibrated: float | None,
    terms: dict[str, float],
    stress_pass: bool,
) -> str:
    if probability_status != "calibrated" or p_calibrated is None:
        return "paper_only"
    if ev is None or ev <= 0:
        return "blocked"
    if p_calibrated < terms["p_break_even"] + 0.05:
        return "blocked"
    if terms["reward_risk"] < 1.5:
        return "blocked"
    if not stress_pass:
        return "paper_only"
    return "approval_ready"


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _price_trend_score(features: dict) -> float:
    r20 = float(features.get("return_20d") or 0.0)
    r60 = float(features.get("return_60d") or 0.0)
    near_high = float(features.get("near_high_60d") or 0.0)
    rs_spy = float(features.get("relative_strength_spy") or 0.0)
    momentum = _clamp((r20 + 0.05) / 0.15, 0.0, 1.0) * 8.0
    longer = _clamp((r60 + 0.10) / 0.30, 0.0, 1.0) * 6.0
    proximity = _clamp(1.0 + near_high / 0.10, 0.0, 1.0) * 3.0
    relative = _clamp((rs_spy + 0.05) / 0.15, 0.0, 1.0) * 3.0
    return _clamp(momentum + longer + proximity + relative, 0.0, 20.0)


def _fundamental_score(context: dict) -> float:
    baseline = float(context.get("baseline_score") or 0.0)
    return _clamp(baseline / 100.0 * 20.0, 0.0, 20.0)


def _news_event_score(context: dict) -> float:
    events = context.get("events") or []
    if not events:
        return 7.5
    sentiments = [float(event.get("sentiment_score") or 0.0) for event in events[:5]]
    risks = [float(event.get("risk_score") or 0.0) for event in events[:5]]
    avg_sentiment = sum(sentiments) / len(sentiments) if sentiments else 0.0
    avg_risk = sum(risks) / len(risks) if risks else 0.0
    base = 7.5 + avg_sentiment * 7.5 - avg_risk * 5.0
    return _clamp(base, 0.0, 15.0)


def _flow_volume_score(features: dict) -> float:
    volume_ratio = float(features.get("volume_ratio_20d") or 0.0)
    return _clamp((volume_ratio - 0.8) / 1.2, 0.0, 1.0) * 15.0


def _score_payload(
    math_score_value: float,
    ev: float | None,
    reward_risk: float | None,
    volatility: float,
    context: dict,
) -> dict[str, float]:
    features = context.get("features") or {}
    rr_component = _clamp((((reward_risk or 0.0) - 1.0) / 2.0) * 20.0, 0.0, 20.0)
    stability_component = _clamp((1.0 - volatility / 0.08) * 10.0, 0.0, 10.0)
    price_trend = _price_trend_score(features)
    fundamental = _fundamental_score(context)
    news_event = _news_event_score(context)
    flow_volume = _flow_volume_score(features)
    total = price_trend + fundamental + news_event + flow_volume + stability_component + rr_component
    return {
        "price_trend": price_trend,
        "fundamental": fundamental,
        "news_event": news_event,
        "flow_volume": flow_volume,
        "risk": stability_component,
        "reward_risk": rr_component,
        "math_score": float(math_score_value),
        "expected_value_pct": (ev or 0.0) * 100.0 if ev is not None else 0.0,
        "total": _clamp(total, 0.0, 100.0),
    }
