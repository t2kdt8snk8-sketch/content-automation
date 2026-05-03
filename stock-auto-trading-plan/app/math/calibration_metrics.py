from __future__ import annotations

import math


def brier_score(rows: list[dict]) -> float:
    if not rows:
        raise ValueError("rows cannot be empty")
    return sum((float(row["p"]) - int(row["label"])) ** 2 for row in rows) / len(rows)


def log_loss(rows: list[dict], eps: float = 1e-12) -> float:
    if not rows:
        raise ValueError("rows cannot be empty")
    total = 0.0
    for row in rows:
        p = min(1 - eps, max(eps, float(row["p"])))
        y = int(row["label"])
        total += y * math.log(p) + (1 - y) * math.log(1 - p)
    return -total / len(rows)


def expected_calibration_error(rows: list[dict], bins: int = 10) -> float:
    if not rows:
        raise ValueError("rows cannot be empty")
    total = 0.0
    n = len(rows)
    for bin_index in range(bins):
        low = bin_index / bins
        high = (bin_index + 1) / bins
        bucket = [
            row
            for row in rows
            if low <= float(row["p"]) < high or (bin_index == bins - 1 and float(row["p"]) == 1.0)
        ]
        if not bucket:
            continue
        avg_p = sum(float(row["p"]) for row in bucket) / len(bucket)
        avg_y = sum(int(row["label"]) for row in bucket) / len(bucket)
        total += len(bucket) / n * abs(avg_p - avg_y)
    return total

