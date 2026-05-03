from __future__ import annotations

import json
from datetime import date, timedelta

from app.ai.scoring import attach_deterministic_math
from app.learning.calibration_store import calibrate_candidate_probability, historical_probability_rows
from app.models import TrainingExample


def add_probability_rows(db_session, count: int = 120):
    for index in range(count):
        db_session.add(
            TrainingExample(
                ticker=f"T{index}",
                as_of_date=date(2024, 1, 1) + timedelta(days=index),
                feature_json=json.dumps({}),
                label=1 if index % 2 == 0 else 0,
                horizon_days=10,
                benchmark_ticker="SPY",
                universe_name="user_watchlist",
                p_raw=0.65,
            )
        )
    db_session.commit()


def memo_payload():
    return {
        "recommendation": "buy",
        "confidence": 80,
        "holding_period": "5~20 trading days",
        "entry_price": 100,
        "stop_price": 94,
        "review_price": 112,
        "max_weight": 0.03,
        "key_reasons": ["a", "b", "c"],
        "counter_reasons": ["a", "b", "c"],
        "bull_case": "up",
        "bear_case": "down",
        "do_not_trade_if": ["a"],
    }


def test_historical_probability_rows_returns_p_raw_and_label(db_session):
    add_probability_rows(db_session, 2)

    rows = historical_probability_rows(db_session)

    assert rows == [{"p_raw": 0.65, "label": 1}, {"p_raw": 0.65, "label": 0}]


def test_calibrate_candidate_probability_requires_history(db_session):
    result = calibrate_candidate_probability(db_session, 0.65)

    assert result.status == "uncalibrated"
    assert result.p_calibrated is None


def test_attach_math_with_calibrated_probability_creates_ev_and_score():
    result = attach_deterministic_math(
        memo_payload(),
        {
            "features": {"volatility_20d": 0.02},
            "latest_dollar_volume": 10_000_000,
            "learning": {
                "p_raw": 0.65,
                "p_calibrated": 0.65,
                "probability_status": "calibrated",
                "training_sample_count": 120,
                "calibration_sample_count": 30,
            },
        },
    )

    assert result["math"]["expected_value"] is not None
    assert result["math"]["math_score"] > 0
    assert result["decision_mode"] in {"approval_ready", "paper_only"}


def test_attach_math_negative_ev_is_blocked():
    result = attach_deterministic_math(
        memo_payload(),
        {
            "features": {"volatility_20d": 0.02},
            "latest_dollar_volume": 10_000_000,
            "learning": {
                "p_raw": 0.1,
                "p_calibrated": 0.1,
                "probability_status": "calibrated",
                "training_sample_count": 120,
                "calibration_sample_count": 30,
            },
        },
    )

    assert result["math"]["expected_value"] < 0
    assert result["decision_mode"] == "blocked"
