from __future__ import annotations

from datetime import date

from app.data.reliability import data_reliability_status
from app.models import PriceBar


def test_data_reliability_defaults_to_research_only(db_session):
    result = data_reliability_status(db_session)

    assert result.status == "research_only"


def test_data_reliability_allows_paper_when_adjusted_and_benchmark_exist(db_session):
    db_session.add(
        PriceBar(
            ticker="SPY",
            date=date(2024, 1, 1),
            open=100,
            high=101,
            low=99,
            close=100,
            volume=1_000_000,
            adjusted_close=100,
            source="test",
        )
    )
    db_session.commit()

    result = data_reliability_status(db_session)

    assert result.status == "paper_trading_ok"
