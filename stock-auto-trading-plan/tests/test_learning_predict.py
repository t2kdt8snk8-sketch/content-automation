from __future__ import annotations

import json
from datetime import date, timedelta

from app.learning.predict import predict_candidate_probability, refresh_training_example_probabilities
from app.math.probability import FEATURE_NAMES
from app.models import Candidate, Feature, TrainingExample


def training_row(index: int, label: int) -> TrainingExample:
    features = {name: 0.0 for name in FEATURE_NAMES}
    features["return_20d"] = 0.01 * label + index * 0.0001
    features["volume_ratio_20d"] = 1.0 + label
    return TrainingExample(
        ticker=f"T{index}",
        as_of_date=date(2024, 1, 1) + timedelta(days=index),
        feature_json=json.dumps(features),
        label=label,
        horizon_days=10,
        benchmark_ticker="SPY",
        universe_name="user_watchlist",
    )


def add_candidate_with_feature(db_session):
    candidate = Candidate(ticker="AAA", as_of_date=date(2024, 5, 1), baseline_score=80, universe_name="user_watchlist")
    db_session.add(candidate)
    db_session.add(
        Feature(
            ticker="AAA",
            as_of_date=date(2024, 5, 1),
            return_5d=0.01,
            return_20d=0.04,
            return_60d=0.08,
            volatility_20d=0.02,
            volume_ratio_20d=1.7,
            relative_strength_spy=0.02,
            relative_strength_qqq=0.01,
            near_high_60d=-0.03,
            near_low_60d=0.12,
        )
    )
    db_session.commit()
    db_session.refresh(candidate)
    return candidate


def test_predict_candidate_probability_requires_training_rows(db_session):
    candidate = add_candidate_with_feature(db_session)

    result = predict_candidate_probability(db_session, candidate)

    assert result.p_raw is None
    assert result.probability_status == "unavailable"


def test_predict_candidate_probability_returns_bounded_probability(db_session):
    candidate = add_candidate_with_feature(db_session)
    for index in range(120):
        db_session.add(training_row(index, index % 2))
    db_session.commit()

    result = predict_candidate_probability(db_session, candidate)

    assert result.probability_status == "available"
    assert result.p_raw is not None
    assert 0 <= result.p_raw <= 1


def test_predict_candidate_probability_uses_features_not_ai_text(db_session):
    candidate = add_candidate_with_feature(db_session)
    candidate.candidate_reason = "AI says probability is 99%"
    for index in range(120):
        db_session.add(training_row(index, index % 2))
    db_session.commit()

    result = predict_candidate_probability(db_session, candidate)

    assert result.p_raw is not None


def test_refresh_training_example_probabilities_fills_p_raw(db_session):
    for index in range(130):
        db_session.add(training_row(index, index % 2))
    db_session.commit()

    updated = refresh_training_example_probabilities(db_session)

    assert updated > 0
