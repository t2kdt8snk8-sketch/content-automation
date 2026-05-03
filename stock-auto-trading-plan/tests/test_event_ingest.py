from __future__ import annotations

import pytest

from app.events.ingest import ingest_event_csv, parse_event_csv


CSV = """ticker,event_date,available_at,event_type,sentiment_score,uncertainty_score,guidance_score,risk_score,summary,source_url
AAPL,2024-01-02,2024-01-02T16:30:00,earnings,0.2,0.4,0.1,0.3,ok,https://example.com
"""


def test_parse_event_csv_requires_available_at():
    bad = CSV.replace("2024-01-02T16:30:00", "")

    with pytest.raises(ValueError):
        parse_event_csv(bad)


def test_ingest_event_csv_saves_event(db_session):
    count = ingest_event_csv(db_session, CSV)

    assert count == 1
