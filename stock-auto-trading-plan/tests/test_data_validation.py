from __future__ import annotations

from datetime import date

from app.data.validators import validate_price_columns, validate_price_row
from app.schemas import PriceInput


def test_validate_price_columns_rejects_missing_required_column():
    result = validate_price_columns({"date", "ticker", "open"})
    assert not result.ok
    assert "missing columns" in result.errors[0]


def test_validate_price_row_rejects_bad_high_low():
    row = PriceInput(
        ticker="AAPL",
        date=date(2026, 1, 2),
        open=100,
        high=90,
        low=95,
        close=98,
        volume=1000,
        adjusted_close=98,
    )
    result = validate_price_row(row)
    assert not result.ok
    assert "high cannot be lower than low" in result.errors


def test_validate_price_row_warns_on_zero_volume():
    row = PriceInput(
        ticker="AAPL",
        date=date(2026, 1, 2),
        open=100,
        high=105,
        low=95,
        close=98,
        volume=0,
        adjusted_close=98,
    )
    result = validate_price_row(row)
    assert result.ok
    assert "zero volume" in result.warnings

