from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select

from app.learning.dataset import build_training_examples, build_training_examples_for_horizons
from app.models import PriceBar, TrainingExample, Watchlist


def add_series(db, ticker: str, start: float, days: int = 45, step: float = 1.0):
    base = date(2024, 1, 1)
    for index in range(days):
        close = start + index * step
        db.add(
            PriceBar(
                ticker=ticker,
                date=base + timedelta(days=index),
                open=close,
                high=close * 1.01,
                low=close * 0.99,
                close=close,
                adjusted_close=close,
                volume=1_000_000 + index,
                source="test",
            )
        )
    db.commit()


def test_build_training_examples_creates_historical_rows(db_session):
    db_session.add(Watchlist(ticker="AAA"))
    add_series(db_session, "AAA", 100, step=1.3)
    add_series(db_session, "SPY", 100, step=0.2)

    count = build_training_examples(db_session, horizon=10)

    rows = db_session.scalars(select(TrainingExample)).all()
    assert count > 0
    assert len(rows) == count
    assert rows[0].ticker == "AAA"
    assert rows[0].label in {0, 1}


def test_build_training_examples_skips_insufficient_future_data(db_session):
    db_session.add(Watchlist(ticker="AAA"))
    add_series(db_session, "AAA", 100, days=25)
    add_series(db_session, "SPY", 100, days=25)

    count = build_training_examples(db_session, horizon=10)

    assert count == 0


def test_build_training_examples_is_idempotent(db_session):
    db_session.add(Watchlist(ticker="AAA"))
    add_series(db_session, "AAA", 100, step=1.3)
    add_series(db_session, "SPY", 100, step=0.2)

    first = build_training_examples(db_session, horizon=10)
    second = build_training_examples(db_session, horizon=10)

    assert first > 0
    assert second == 0


def test_build_training_examples_for_horizons_creates_multiple_horizons(db_session):
    db_session.add(Watchlist(ticker="AAA"))
    add_series(db_session, "AAA", 100, days=70, step=1.3)
    add_series(db_session, "SPY", 100, days=70, step=0.2)

    count = build_training_examples_for_horizons(db_session, horizons=(5, 10), universe_names=("user_watchlist",))

    horizons = {row.horizon_days for row in db_session.scalars(select(TrainingExample)).all()}
    assert count > 0
    assert horizons == {5, 10}
