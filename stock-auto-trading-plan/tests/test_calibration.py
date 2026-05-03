from __future__ import annotations

from app.math.calibration import calibrate_probability


def test_calibration_requires_enough_history():
    result = calibrate_probability(0.55, [{"p_raw": 0.55, "label": 1}] * 99)
    assert result.status == "uncalibrated"
    assert result.p_calibrated is None


def test_calibration_requires_enough_selected_bucket_samples():
    rows = [{"p_raw": 0.15, "label": 1}] * 100
    result = calibrate_probability(0.55, rows)
    assert result.status == "uncalibrated"


def test_calibration_returns_bucket_success_rate():
    rows = [{"p_raw": 0.55, "label": 1}] * 30 + [{"p_raw": 0.55, "label": 0}] * 20 + [{"p_raw": 0.15, "label": 0}] * 50
    result = calibrate_probability(0.55, rows)
    assert result.status == "calibrated"
    assert result.p_calibrated == 0.6

