from __future__ import annotations

from datetime import date, timedelta

from app.data.features import baseline_score, calculate_feature_for_ticker
from app.models import PriceBar


def seed_bars(db, ticker="AAPL", start=100.0, days=80):
    base = date(2026, 1, 1)
    for idx in range(days):
        close = start + idx
        db.add(
            PriceBar(
                ticker=ticker,
                date=base + timedelta(days=idx),
                open=close - 1,
                high=close + 1,
                low=close - 2,
                close=close,
                adjusted_close=close,
                volume=1000 + idx * 10,
                source="test",
            )
        )
    db.commit()


def test_calculate_feature_for_ticker_returns_recent_returns(db_session):
    seed_bars(db_session)
    feature = calculate_feature_for_ticker(db_session, "AAPL")
    assert feature is not None
    assert feature.return_20d > 0
    assert feature.volume_ratio_20d > 1


def test_baseline_score_rewards_positive_momentum(db_session):
    seed_bars(db_session)
    feature = calculate_feature_for_ticker(db_session, "AAPL")
    feature.relative_strength_spy = 0.02
    feature.relative_strength_qqq = 0.01
    score, reason = baseline_score(feature)
    assert score >= 40
    assert "20일 수익률 양수" in reason

