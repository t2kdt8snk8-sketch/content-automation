from __future__ import annotations

from datetime import date

from app.ai.orchestrator import _default_valid_until
from app.models import Candidate


def test_default_valid_until_uses_holding_period_when_provided():
    candidate = Candidate(ticker="AAA", as_of_date=date(2024, 1, 2))

    valid_until = _default_valid_until(candidate, "5~20 trading days")

    assert valid_until.date() == date(2024, 1, 30)
    assert valid_until.hour == 10
    assert valid_until.minute == 0


def test_default_valid_until_falls_back_to_default_when_missing():
    candidate = Candidate(ticker="AAA", as_of_date=date(2024, 1, 2))

    valid_until = _default_valid_until(candidate)

    assert valid_until.date() == date(2024, 1, 16)
    assert valid_until.hour == 10
