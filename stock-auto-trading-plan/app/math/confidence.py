from __future__ import annotations

import math
import statistics


def mean_ci_95(values: list[float]) -> dict:
    if len(values) < 30:
        return {"status": "insufficient", "mean": None, "lower": None, "upper": None, "sample_count": len(values)}
    mean = statistics.fmean(values)
    stdev = statistics.stdev(values)
    half_width = 1.96 * stdev / math.sqrt(len(values))
    return {"status": "ok", "mean": mean, "lower": mean - half_width, "upper": mean + half_width, "sample_count": len(values)}


def quantile(values: list[float], q: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, int(q * (len(ordered) - 1))))
    return ordered[index]

