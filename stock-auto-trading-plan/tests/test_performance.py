from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select

from app.models import InvestmentMemo, PerformanceSnapshot, PriceBar
from app.reports.performance import regime_summary, update_performance_snapshots


def add_bars(db, ticker):
    base = date(2026, 1, 1)
    for idx in range(25):
        price = 100 + idx
        db.add(
            PriceBar(
                ticker=ticker,
                date=base + timedelta(days=idx),
                open=price,
                high=price + 1,
                low=price - 1,
                close=price,
                adjusted_close=price,
                volume=1000,
                source="test",
            )
        )
    db.commit()


def test_update_performance_snapshots_calculates_horizons(db_session):
    add_bars(db_session, "AAPL")
    add_bars(db_session, "SPY")
    memo = InvestmentMemo(
        ticker="AAPL",
        as_of_date=date(2026, 1, 1),
        recommendation="buy",
        confidence=80,
        total_score=80,
        entry_price=100,
        stop_price=94,
        review_price=108,
        max_weight=0.03,
    )
    db_session.add(memo)
    db_session.commit()
    count = update_performance_snapshots(db_session)
    assert count == 3
    snapshot = db_session.scalar(select(PerformanceSnapshot).where(PerformanceSnapshot.horizon_days == 10))
    assert snapshot.paper_return_pct == snapshot.return_pct
    assert snapshot.conservative_return_pct == snapshot.return_pct - 0.005
    assert snapshot.market_regime in {"benchmark_up", "benchmark_down"}
    assert regime_summary(db_session)
