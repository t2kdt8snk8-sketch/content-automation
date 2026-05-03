from __future__ import annotations

from datetime import date

from app.models import InvestmentMemo
from app.reports.lean_export import LEAN_COLUMNS, export_lean_signals


def test_export_lean_signals_includes_approved_memos_only(db_session):
    approved = InvestmentMemo(
        ticker="AAPL",
        as_of_date=date(2026, 1, 1),
        recommendation="buy",
        confidence=80,
        total_score=80,
        entry_price=100,
        stop_price=94,
        review_price=108,
        max_weight=0.03,
        approval_status="approved",
    )
    pending = InvestmentMemo(
        ticker="MSFT",
        as_of_date=date(2026, 1, 1),
        recommendation="buy",
        confidence=80,
        total_score=80,
        entry_price=100,
        stop_price=94,
        review_price=108,
        max_weight=0.03,
        approval_status="pending",
    )
    db_session.add_all([approved, pending])
    db_session.commit()
    output = export_lean_signals(db_session)
    assert ",".join(LEAN_COLUMNS) in output
    assert "decision_mode" in output
    assert "horizon_days" in output
    assert "AAPL" in output
    assert "MSFT" not in output
