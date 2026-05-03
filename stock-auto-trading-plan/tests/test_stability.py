from __future__ import annotations

from app.math.stability import coefficient_sign_stability, period_return_concentration, top_feature_overlap


def test_top_feature_overlap_extremes():
    assert top_feature_overlap(["a", "b", "c"], ["a", "b", "c"], k=3) == 1.0
    assert top_feature_overlap(["a", "b", "c"], ["d", "e", "f"], k=3) == 0.0


def test_coefficient_sign_stability_detects_stable_signs():
    rows = [
        {"feature": "return_20d", "coefficient": 0.1},
        {"feature": "return_20d", "coefficient": 0.2},
        {"feature": "return_20d", "coefficient": -0.1},
    ]
    assert coefficient_sign_stability(rows)["return_20d"] == 2 / 3


def test_period_return_concentration_detects_single_period_domination():
    assert period_return_concentration([0.9, 0.05, 0.05]) == 0.9
