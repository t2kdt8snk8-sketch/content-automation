from __future__ import annotations


SCORE_BUCKETS = [(0, 60), (60, 75), (75, 85), (85, 101)]


def score_bucket_summary(rows: list[dict]) -> list[dict]:
    result = []
    for low, high in SCORE_BUCKETS:
        bucket = [row for row in rows if low <= float(row["score"]) < high]
        returns = [float(row["excess_return"]) for row in bucket]
        avg = sum(returns) / len(returns) if returns else None
        result.append({"low": low, "high": high, "count": len(bucket), "avg_excess_return": avg})
    return result


def monotonicity_pass(summary: list[dict], min_count: int = 20, tolerance: float = 0.002) -> bool:
    valid = [row for row in summary if row["count"] >= min_count and row["avg_excess_return"] is not None]
    if len(valid) < 3:
        return False
    for left, right in zip(valid, valid[1:]):
        if right["avg_excess_return"] + tolerance < left["avg_excess_return"]:
            return False
    return True

