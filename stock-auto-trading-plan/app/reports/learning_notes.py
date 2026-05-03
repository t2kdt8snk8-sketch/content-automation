from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import LearningNote


CONFIDENCE_TIERS = {"confirmed", "likely", "hypothesis", "insufficient_data"}


def create_learning_note(
    db: Session,
    failure_reason: str,
    confidence_tier: str,
    evidence: str,
    suggested_rule_change: str,
    memo_id: int | None = None,
    ticker: str = "",
) -> LearningNote:
    if confidence_tier not in CONFIDENCE_TIERS:
        raise ValueError("invalid confidence tier")
    if confidence_tier == "hypothesis" and not suggested_rule_change.startswith("[TEST_ONLY]"):
        suggested_rule_change = f"[TEST_ONLY] {suggested_rule_change}"
    note = LearningNote(
        memo_id=memo_id,
        ticker=ticker,
        failure_reason=failure_reason,
        confidence_tier=confidence_tier,
        evidence=evidence,
        suggested_rule_change=suggested_rule_change,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note
