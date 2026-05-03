from __future__ import annotations

import csv
from io import StringIO

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import InvestmentMemo

LEAN_COLUMNS = [
    "date",
    "ticker",
    "recommendation",
    "decision_mode",
    "universe_name",
    "horizon_days",
    "score",
    "confidence",
    "max_weight",
    "entry_price",
    "stop_price",
    "review_price",
    "memo_id",
]


def export_lean_signals(db: Session) -> str:
    memos = list(
        db.scalars(
            select(InvestmentMemo)
            .where(InvestmentMemo.approval_status == "approved")
            .order_by(InvestmentMemo.as_of_date.asc(), InvestmentMemo.ticker.asc())
        )
    )
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=LEAN_COLUMNS)
    writer.writeheader()
    for memo in memos:
        if not all([memo.entry_price, memo.stop_price, memo.review_price]):
            raise ValueError(f"memo {memo.id} missing required price fields")
        universe_name = memo.candidate.universe_name if memo.candidate else "user_watchlist"
        writer.writerow(
            {
                "date": memo.as_of_date.isoformat(),
                "ticker": memo.ticker,
                "recommendation": memo.recommendation,
                "decision_mode": memo.decision_mode,
                "universe_name": universe_name,
                "horizon_days": 10,
                "score": memo.total_score,
                "confidence": memo.confidence,
                "max_weight": memo.max_weight,
                "entry_price": memo.entry_price,
                "stop_price": memo.stop_price,
                "review_price": memo.review_price,
                "memo_id": memo.id,
            }
        )
    return output.getvalue()
