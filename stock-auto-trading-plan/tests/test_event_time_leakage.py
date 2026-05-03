from __future__ import annotations

from datetime import date, datetime

from app.ai.orchestrator import build_candidate_context
from app.models import Candidate, EventFeature, Feature


def test_candidate_context_excludes_future_event(db_session):
    candidate = Candidate(ticker="AAA", as_of_date=date(2024, 1, 2), baseline_score=80)
    db_session.add(candidate)
    db_session.add(Feature(ticker="AAA", as_of_date=date(2024, 1, 2)))
    db_session.add(
        EventFeature(
            ticker="AAA",
            event_date=date(2024, 1, 2),
            available_at=datetime(2024, 1, 3, 8, 0),
            usable_from=datetime(2024, 1, 3, 8, 0),
            event_type="post_market",
            summary="future",
        )
    )
    db_session.add(
        EventFeature(
            ticker="AAA",
            event_date=date(2024, 1, 1),
            available_at=datetime(2024, 1, 1, 8, 0),
            usable_from=datetime(2024, 1, 1, 8, 0),
            event_type="known",
            summary="past",
        )
    )
    db_session.commit()
    db_session.refresh(candidate)

    context = build_candidate_context(db_session, candidate)

    assert [event["summary"] for event in context["events"]] == ["past"]
