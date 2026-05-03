from __future__ import annotations

import math


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def trade_terms(entry: float, stop: float, target: float, cost: float) -> dict[str, float]:
    if entry <= 0:
        raise ValueError("entry must be positive")
    gain = (target - entry) / entry
    loss = (entry - stop) / entry
    if gain <= 0:
        raise ValueError("target must be above entry")
    if loss <= 0:
        raise ValueError("stop must be below entry")
    if cost < 0:
        raise ValueError("cost cannot be negative")
    return {
        "gain": gain,
        "loss": loss,
        "cost": cost,
        "p_break_even": (loss + cost) / (gain + loss),
        "reward_risk": gain / loss,
    }


def expected_value(p: float, gain: float, loss: float, cost: float) -> float:
    if not 0 <= p <= 1:
        raise ValueError("probability must be 0..1")
    return p * gain - (1 - p) * loss - cost


def math_score(
    ev: float,
    p: float,
    p_break_even: float,
    reward_risk: float,
    dollar_volume: float,
    volatility_20d: float,
) -> float:
    ev_score = clamp(ev / 0.03, 0, 1) * 35
    prob_score = clamp((p - p_break_even) / 0.20, 0, 1) * 25
    rr_score = clamp((reward_risk - 1.0) / 2.0, 0, 1) * 20
    liquidity_score = clamp(math.log10(max(dollar_volume, 1)) / 9, 0, 1) * 10
    stability_score = clamp(1 - volatility_20d / 0.08, 0, 1) * 10
    return clamp(ev_score + prob_score + rr_score + liquidity_score + stability_score, 0, 100)


def capped_fractional_kelly(
    p: float,
    gain: float,
    loss: float,
    sector_remaining: float = 0.25,
    account_remaining: float = 0.70,
    k: float = 0.10,
    single_name_cap: float = 0.07,
) -> float:
    if gain <= 0 or loss <= 0 or not 0 <= p <= 1:
        return 0.0
    raw = p / loss - (1 - p) / gain
    scaled = k * max(raw, 0.0)
    return max(0.0, min(scaled, single_name_cap, sector_remaining, account_remaining))


DEFAULT_COST = 0.003

