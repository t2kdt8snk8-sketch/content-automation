from __future__ import annotations

from app.ai.schema import validate_memo_payload


def valid_payload():
    return {
        "recommendation": "buy",
        "confidence": 82,
        "scores": {
            "price_trend": 18,
            "fundamental": 10,
            "news_event": 8,
            "flow_volume": 12,
            "risk": -5,
            "reward_risk": 20,
            "total": 73,
        },
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


def test_validate_memo_payload_accepts_valid_payload():
    result = validate_memo_payload(valid_payload())
    assert result.ok


def test_validate_memo_payload_accepts_payload_without_ai_scores():
    payload = valid_payload()
    payload.pop("scores")
    result = validate_memo_payload(payload)
    assert result.ok


def test_validate_memo_payload_rejects_stop_above_entry():
    payload = valid_payload()
    payload["stop_price"] = 101
    result = validate_memo_payload(payload)
    assert not result.ok
    assert "stop_price must be lower than entry_price" in result.errors


def test_validate_memo_payload_rejects_large_weight():
    payload = valid_payload()
    payload["max_weight"] = 0.08
    result = validate_memo_payload(payload)
    assert not result.ok
    assert "max_weight cannot exceed 0.07" in result.errors
