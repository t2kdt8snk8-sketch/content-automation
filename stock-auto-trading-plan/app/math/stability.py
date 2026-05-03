from __future__ import annotations


def top_feature_overlap(left: list[str], right: list[str], k: int = 5) -> float:
    if k <= 0:
        raise ValueError("k must be positive")
    left_top = set(left[:k])
    right_top = set(right[:k])
    return len(left_top & right_top) / k


def coefficient_sign_stability(rows: list[dict]) -> dict[str, float]:
    result: dict[str, float] = {}
    features = sorted({row["feature"] for row in rows})
    for feature in features:
        signs = [
            1 if float(row["coefficient"]) > 0 else -1 if float(row["coefficient"]) < 0 else 0
            for row in rows
            if row["feature"] == feature
        ]
        dominant = max(set(signs), key=signs.count)
        result[feature] = signs.count(dominant) / len(signs)
    return result


def period_return_concentration(period_returns: list[float]) -> float:
    total_abs = sum(abs(value) for value in period_returns)
    if total_abs == 0:
        return 0.0
    return max(abs(value) for value in period_returns) / total_abs
