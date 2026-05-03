from __future__ import annotations

from app.ai.scoring import attach_deterministic_math, merge_provider_payloads


def memo_payload():
    return {
        "recommendation": "buy",
        "confidence": 82,
        "scores": {"total": 99},
        "holding_period": "5~20 trading days",
        "entry_price": 100,
        "stop_price": 94,
        "review_price": 108,
        "max_weight": 0.03,
        "key_reasons": ["a", "b", "c"],
        "counter_reasons": ["a", "b", "c"],
        "bull_case": "up",
        "bear_case": "down",
        "do_not_trade_if": ["a", "b", "c"],
    }


def test_merge_provider_payloads_does_not_pick_highest_score_by_default():
    low_score_more_complete = memo_payload()
    low_score_more_complete["scores"]["total"] = 10
    low_score_more_complete["key_reasons"] = ["a", "b", "c", "d"]
    high_score_less_complete = memo_payload()
    high_score_less_complete["scores"]["total"] = 99
    high_score_less_complete["key_reasons"] = ["a"]

    result = merge_provider_payloads([high_score_less_complete, low_score_more_complete])

    assert result is not high_score_less_complete
    assert result["key_reasons"] == ["a", "b", "c", "d"]


def test_attach_deterministic_math_overwrites_ai_score_and_blocks_without_calibration():
    result = attach_deterministic_math(
        memo_payload(),
        {"features": {"volatility_20d": 0.02}, "latest_dollar_volume": 10_000_000},
    )

    assert result["scores"]["math_score"] == 0
    assert result["scores"]["total"] < 70
    assert result["math"]["probability_status"] == "unavailable"
    assert result["math"]["decision_mode"] == "paper_only"
    assert result["math"]["p_break_even"] > 0
    assert result["max_weight"] == 0
