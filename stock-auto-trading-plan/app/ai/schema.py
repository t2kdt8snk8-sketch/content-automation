from __future__ import annotations

from dataclasses import dataclass
from typing import Any

VALID_RECOMMENDATIONS = {"buy", "hold", "sell", "watch"}


@dataclass(frozen=True)
class MemoValidation:
    ok: bool
    errors: list[str]
    warnings: list[str]


def validate_memo_payload(payload: dict[str, Any]) -> MemoValidation:
    errors: list[str] = []
    warnings: list[str] = []

    recommendation = payload.get("recommendation")
    if recommendation not in VALID_RECOMMENDATIONS:
        errors.append("recommendation must be buy, hold, sell, or watch")

    confidence = payload.get("confidence")
    if not isinstance(confidence, (int, float)) or not 0 <= confidence <= 100:
        errors.append("confidence must be 0..100")

    scores = payload.get("scores")
    if scores is not None:
        if not isinstance(scores, dict):
            errors.append("scores must be an object")
        else:
            total = scores.get("total")
            if not isinstance(total, (int, float)) or not 0 <= total <= 100:
                errors.append("scores.total must be 0..100")

    math_data = payload.get("math")
    if math_data is not None:
        if not isinstance(math_data, dict):
            errors.append("math must be an object")
        elif "math_score" in math_data:
            score = math_data["math_score"]
            if not isinstance(score, (int, float)) or not 0 <= score <= 100:
                errors.append("math.math_score must be 0..100")

    if isinstance(scores, dict):
        total = scores.get("total")
        if isinstance(total, (int, float)) and payload.get("recommendation") == "buy" and total < 70:
            warnings.append("buy recommendation below 70 is approval-blocked")

    for key in ("entry_price", "stop_price", "review_price", "max_weight"):
        if not isinstance(payload.get(key), (int, float)):
            errors.append(f"{key} must be numeric")

    if isinstance(payload.get("entry_price"), (int, float)) and isinstance(payload.get("stop_price"), (int, float)):
        if payload["stop_price"] >= payload["entry_price"]:
            errors.append("stop_price must be lower than entry_price")

    if isinstance(payload.get("max_weight"), (int, float)) and payload["max_weight"] > 0.07:
        errors.append("max_weight cannot exceed 0.07")

    for key in ("key_reasons", "counter_reasons", "do_not_trade_if"):
        value = payload.get(key)
        if not isinstance(value, list):
            errors.append(f"{key} must be a list")
        elif len(value) < 3:
            errors.append(f"{key} must have at least 3 items")

    for key in ("bull_case", "bear_case", "holding_period"):
        if not isinstance(payload.get(key), str) or not payload[key].strip():
            errors.append(f"{key} is required")

    return MemoValidation(not errors, errors, warnings)
