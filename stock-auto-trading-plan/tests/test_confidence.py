from __future__ import annotations

from app.math.confidence import mean_ci_95, quantile


def test_mean_ci_requires_minimum_samples():
    result = mean_ci_95([0.01] * 29)
    assert result["status"] == "insufficient"


def test_stable_positive_ev_has_positive_lower_bound():
    result = mean_ci_95([0.01] * 30)
    assert result["lower"] > 0


def test_noisy_positive_ev_can_have_negative_lower_bound():
    result = mean_ci_95([0.20, -0.18] * 20)
    assert result["mean"] > 0
    assert result["lower"] < 0


def test_quantile_returns_expected_item():
    assert quantile([5, 1, 3, 2, 4], 0.25) == 2

