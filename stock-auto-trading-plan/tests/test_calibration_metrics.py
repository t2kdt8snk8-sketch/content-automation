from __future__ import annotations

from app.math.calibration_metrics import brier_score, expected_calibration_error, log_loss


def test_perfect_predictions_have_lower_brier_than_bad_predictions():
    perfect = [{"p": 0.9, "label": 1}, {"p": 0.1, "label": 0}]
    poor = [{"p": 0.1, "label": 1}, {"p": 0.9, "label": 0}]
    assert brier_score(perfect) < brier_score(poor)


def test_log_loss_clips_extreme_probabilities():
    assert log_loss([{"p": 0, "label": 0}, {"p": 1, "label": 1}]) >= 0


def test_ece_zero_when_bucket_probability_matches_outcome_rate():
    rows = [{"p": 0.55, "label": 1}] * 11 + [{"p": 0.55, "label": 0}] * 9
    assert expected_calibration_error(rows) == 0.0

