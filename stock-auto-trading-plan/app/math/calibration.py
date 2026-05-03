from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CalibrationResult:
    p_calibrated: float | None
    sample_count: int
    status: str


def calibrate_probability(p_raw: float | None, historical_rows: list[dict], bins: int = 10) -> CalibrationResult:
    if p_raw is None or not 0 <= p_raw <= 1:
        return CalibrationResult(None, 0, "unavailable")
    if len(historical_rows) < 100:
        return CalibrationResult(None, len(historical_rows), "uncalibrated")
    bin_index = min(bins - 1, int(p_raw * bins))
    low = bin_index / bins
    high = (bin_index + 1) / bins
    bucket = [
        row
        for row in historical_rows
        if low <= float(row["p_raw"]) < high or (bin_index == bins - 1 and float(row["p_raw"]) == 1.0)
    ]
    if len(bucket) < 20:
        return CalibrationResult(None, len(bucket), "uncalibrated")
    rate = sum(int(row["label"]) for row in bucket) / len(bucket)
    return CalibrationResult(rate, len(bucket), "calibrated")

