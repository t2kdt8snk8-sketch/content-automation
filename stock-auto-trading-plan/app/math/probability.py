from __future__ import annotations

from dataclasses import dataclass


FEATURE_NAMES = [
    "return_5d",
    "return_20d",
    "return_60d",
    "volatility_20d",
    "volume_ratio_20d",
    "relative_strength_spy",
    "relative_strength_qqq",
    "near_high_60d",
    "near_low_60d",
]


@dataclass(frozen=True)
class ProbabilityResult:
    p_raw: float | None
    status: str
    sample_count: int


def starter_probability(feature_row: dict, training_rows: list[dict]) -> ProbabilityResult:
    if len(training_rows) < 100:
        return ProbabilityResult(None, "unavailable", len(training_rows))
    try:
        from sklearn.linear_model import LogisticRegression
    except ImportError:
        return ProbabilityResult(None, "unavailable", len(training_rows))

    x_train = [[float(row.get(name) or 0.0) for name in FEATURE_NAMES] for row in training_rows]
    y_train = [int(row["label"]) for row in training_rows]
    if len(set(y_train)) < 2:
        return ProbabilityResult(None, "unavailable", len(training_rows))
    model = LogisticRegression(max_iter=1000)
    model.fit(x_train, y_train)
    x_live = [[float(feature_row.get(name) or 0.0) for name in FEATURE_NAMES]]
    p_raw = float(model.predict_proba(x_live)[0][1])
    return ProbabilityResult(p_raw, "available", len(training_rows))

