from __future__ import annotations

import csv
from datetime import datetime
from io import StringIO

from sqlalchemy.orm import Session

from app.models import EventFeature


REQUIRED_COLUMNS = {
    "ticker",
    "event_date",
    "available_at",
    "event_type",
    "sentiment_score",
    "uncertainty_score",
    "guidance_score",
    "risk_score",
    "summary",
    "source_url",
}


def _clamp(value: float, low: float = -1.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def parse_event_csv(content: str) -> list[dict]:
    reader = csv.DictReader(StringIO(content))
    if not reader.fieldnames or not REQUIRED_COLUMNS.issubset(set(reader.fieldnames)):
        missing = sorted(REQUIRED_COLUMNS - set(reader.fieldnames or []))
        raise ValueError(f"missing columns: {', '.join(missing)}")
    rows = []
    for row in reader:
        if not row.get("available_at"):
            raise ValueError("available_at is required")
        available_at = datetime.fromisoformat(row["available_at"])
        event_date = datetime.fromisoformat(row["event_date"]).date()
        rows.append(
            {
                "ticker": row["ticker"].strip().upper(),
                "event_date": event_date,
                "available_at": available_at,
                "usable_from": available_at,
                "event_type": row["event_type"].strip(),
                "sentiment_score": _clamp(float(row["sentiment_score"])),
                "uncertainty_score": _clamp(float(row["uncertainty_score"]), 0.0, 1.0),
                "guidance_score": _clamp(float(row["guidance_score"])),
                "risk_score": _clamp(float(row["risk_score"]), 0.0, 1.0),
                "summary": row["summary"].strip(),
                "source_url": row["source_url"].strip(),
            }
        )
    return rows


def ingest_event_csv(db: Session, content: str) -> int:
    rows = parse_event_csv(content)
    for row in rows:
        db.add(EventFeature(**row))
    db.commit()
    return len(rows)
