from __future__ import annotations

from datetime import date

from app.models import InvestmentMemo
from app.telegram.callbacks import handle_callback


def test_handle_callback_records_approval(db_session, monkeypatch):
    monkeypatch.setenv("TELEGRAM_ALLOWED_CHAT_ID", "123")
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
    result = handle_callback(db_session, "123", f"approve:{memo.id}")
    assert result == "approved"
    assert memo.approval_status == "approved"

