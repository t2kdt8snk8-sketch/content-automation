from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import InvestmentMemo, PerformanceSnapshot


def ai_quality_summary(db: Session) -> dict:
    rows = db.execute(
        select(InvestmentMemo, PerformanceSnapshot)
        .join(PerformanceSnapshot, PerformanceSnapshot.memo_id == InvestmentMemo.id)
        .where(PerformanceSnapshot.horizon_days == 10, PerformanceSnapshot.status == "ready")
    ).all()
    strong = [
        snapshot.conservative_return_pct or snapshot.return_pct or 0.0
        for memo, snapshot in rows
        if memo.recommendation in {"buy", "strong_buy"} and memo.confidence >= 80
    ]
    watch_outperformed = [
        snapshot.excess_return_pct or 0.0
        for memo, snapshot in rows
        if memo.recommendation in {"watch", "hold"} and (snapshot.excess_return_pct or 0.0) > 0
    ]
    return {
        "strong_buy_count": len(strong),
        "strong_buy_avg_conservative_return": sum(strong) / len(strong) if strong else 0.0,
        "watch_outperformed_count": len(watch_outperformed),
    }
