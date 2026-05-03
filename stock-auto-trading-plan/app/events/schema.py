from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime


@dataclass(frozen=True)
class EventInput:
    ticker: str
    event_date: date
    available_at: datetime
    event_type: str
    sentiment_score: float
    uncertainty_score: float
    guidance_score: float
    risk_score: float
    summary: str
    source_url: str = ""
