from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class PriceInput:
    ticker: str
    date: date
    open: float
    high: float
    low: float
    close: float
    volume: float
    adjusted_close: float
    source: str = "csv"


@dataclass(frozen=True)
class ValidationResult:
    ok: bool
    errors: list[str]
    warnings: list[str]


@dataclass(frozen=True)
class RiskResult:
    status: str
    messages: list[str]
    approval_allowed: bool
    decision_mode: str = "blocked"
