from __future__ import annotations

from datetime import date

from app.schemas import PriceInput, ValidationResult

REQUIRED_PRICE_COLUMNS = {"date", "ticker", "open", "high", "low", "close", "volume", "adjusted_close"}


def validate_price_columns(columns: set[str]) -> ValidationResult:
    missing = sorted(REQUIRED_PRICE_COLUMNS - columns)
    if missing:
        return ValidationResult(False, [f"missing columns: {', '.join(missing)}"], [])
    return ValidationResult(True, [], [])


def validate_price_row(row: PriceInput, previous_adjusted_close: float | None = None) -> ValidationResult:
    errors: list[str] = []
    warnings: list[str] = []

    if not row.ticker:
        errors.append("ticker is required")
    if row.high < row.low:
        errors.append("high cannot be lower than low")
    if row.close <= 0 or row.adjusted_close <= 0:
        errors.append("close and adjusted_close must be positive")
    if row.open <= 0 or row.high <= 0 or row.low <= 0:
        errors.append("open, high, and low must be positive")
    if row.volume < 0:
        errors.append("volume cannot be negative")
    if row.volume == 0:
        warnings.append("zero volume")
    if previous_adjusted_close and previous_adjusted_close > 0:
        move = abs(row.adjusted_close / previous_adjusted_close - 1)
        if move > 0.40:
            warnings.append("adjusted close moved more than 40% from previous bar")

    return ValidationResult(not errors, errors, warnings)


def parse_date(value: str) -> date:
    return date.fromisoformat(value.strip())

