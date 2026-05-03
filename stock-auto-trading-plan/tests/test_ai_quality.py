from __future__ import annotations

from datetime import date

from app.reports.ai_quality import ai_quality_summary
from app.models import InvestmentMemo, PerformanceSnapshot


def test_ai_quality_summary_tracks_strong_buy(db_session):
    memo = InvestmentMemo(
        ticker="AAA",
        as_of_date=date(2024, 1, 1),
        recommendation="buy",
        confidence=85,
        total_score=80,
        entry_price=100,
        stop_price=95,
        review_price=110,
        max_weight=0.03,
    )
    db_session.add(memo)
    db_session.commit()
    db_session.refresh(memo)
    db_session.add(
        PerformanceSnapshot(
            memo_id=memo.id,
            ticker="AAA",
            horizon_days=10,
            return_pct=0.03,
            conservative_return_pct=0.025,
            status="ready",
        )
    )
    db_session.commit()

    result = ai_quality_summary(db_session)

    assert result["strong_buy_count"] == 1
    assert result["strong_buy_avg_conservative_return"] == 0.025
