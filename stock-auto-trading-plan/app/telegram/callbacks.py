from __future__ import annotations

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import ApprovalRecord, InvestmentMemo


def handle_callback(db: Session, chat_id: str, data: str) -> str:
    settings = get_settings()
    if settings.telegram_allowed_chat_id and str(chat_id) != str(settings.telegram_allowed_chat_id):
        return "unauthorized"
    if ":" not in data:
        return "ignored"
    action, raw_id = data.split(":", 1)
    if action not in {"approve", "reject"}:
        return "ignored"
    memo = db.get(InvestmentMemo, int(raw_id))
    if not memo:
        return "not found"
    if memo.approval_status in {"approved", "rejected"}:
        return f"already {memo.approval_status}"
    if action == "approve" and memo.risk_status == "blocked":
        return "blocked by risk rules"
    decision = "approved" if action == "approve" else "rejected"
    memo.approval_status = decision
    db.add(ApprovalRecord(memo_id=memo.id, decision=decision, channel="telegram"))
    db.commit()
    return decision

