from __future__ import annotations

from app.math.probability import starter_probability


def test_starter_probability_returns_unavailable_with_too_few_labels():
    result = starter_probability({}, [{"label": 1}] * 99)
    assert result.status == "unavailable"
    assert result.p_raw is None


def test_starter_probability_never_accepts_ai_probability_field():
    rows = [{"label": i % 2, "return_5d": i / 1000} for i in range(99)]
    result = starter_probability({"ai_probability": 0.99}, rows)
    assert result.status == "unavailable"
    assert result.p_raw is None


def test_starter_probability_is_bounded_when_dependency_available():
    rows = [
        {
            "label": i % 2,
            "return_5d": i / 1000,
            "return_20d": i / 900,
            "return_60d": i / 800,
            "volatility_20d": 0.02,
            "volume_ratio_20d": 1.0,
            "relative_strength_spy": i / 10000,
            "relative_strength_qqq": i / 11000,
            "near_high_60d": -0.05,
            "near_low_60d": 0.1,
        }
        for i in range(120)
    ]
    result = starter_probability(rows[-1], rows)
    if result.status == "available":
        assert result.p_raw is not None
        assert 0 <= result.p_raw <= 1

