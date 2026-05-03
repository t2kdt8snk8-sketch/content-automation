from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from html.parser import HTMLParser

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Watchlist


SP500_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
NASDAQ100_URL = "https://en.wikipedia.org/wiki/Nasdaq-100"

SP500_FALLBACK = ["AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "GOOG", "BRK.B", "LLY", "AVGO"]
NASDAQ100_FALLBACK = ["AAPL", "MSFT", "NVDA", "AMZN", "META", "AVGO", "GOOGL", "GOOG", "COST", "TSLA"]
BENCHMARK_TICKERS = ("SPY", "QQQ", "IWM")


@dataclass(frozen=True)
class UniverseRefreshResult:
    universe_name: str
    inserted: int
    updated: int
    total: int
    source: str


class _WikiTableParser(HTMLParser):
    def __init__(self, header_names: set[str]) -> None:
        super().__init__()
        self.header_names = {name.lower() for name in header_names}
        self.in_table = False
        self.in_cell = False
        self.current_cell = ""
        self.current_row: list[str] = []
        self.rows: list[list[str]] = []
        self.header: list[str] | None = None
        self.symbol_index: int | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "table" and any(name == "class" and value and "wikitable" in value for name, value in attrs):
            self.in_table = True
        if self.in_table and tag in {"td", "th"}:
            self.in_cell = True
            self.current_cell = ""

    def handle_data(self, data: str) -> None:
        if self.in_cell:
            self.current_cell += data

    def handle_endtag(self, tag: str) -> None:
        if self.in_table and tag in {"td", "th"} and self.in_cell:
            self.current_row.append(" ".join(self.current_cell.split()))
            self.in_cell = False
        if self.in_table and tag == "tr":
            if self.current_row:
                if self.header is None:
                    lowered = [cell.lower() for cell in self.current_row]
                    for index, cell in enumerate(lowered):
                        if cell in self.header_names:
                            self.header = self.current_row
                            self.symbol_index = index
                            break
                elif self.symbol_index is not None and len(self.current_row) > self.symbol_index:
                    self.rows.append(self.current_row)
            self.current_row = []
        if self.in_table and tag == "table":
            if self.symbol_index is not None:
                self.in_table = False
            else:
                self.current_row = []


def _normalize_ticker(value: str) -> str:
    return value.strip().upper().replace(".", "-")


def parse_wikipedia_tickers(html: str, header_names: set[str]) -> list[str]:
    parser = _WikiTableParser(header_names)
    parser.feed(html)
    tickers: list[str] = []
    for row in parser.rows:
        if parser.symbol_index is None:
            continue
        ticker = _normalize_ticker(row[parser.symbol_index])
        if ticker and ticker not in tickers:
            tickers.append(ticker)
    return tickers


async def fetch_wikipedia_tickers(url: str, header_names: set[str]) -> list[str]:
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        response = await client.get(url)
        response.raise_for_status()
    return parse_wikipedia_tickers(response.text, header_names)


def _tags(value: str | None) -> set[str]:
    return {item.strip() for item in (value or "").split(",") if item.strip()}


def _upsert_universe_tickers(db: Session, tickers: list[str], universe_name: str, source: str) -> UniverseRefreshResult:
    inserted = 0
    updated = 0
    now = datetime.utcnow()
    for ticker in tickers:
        existing = db.scalar(select(Watchlist).where(Watchlist.ticker == ticker))
        if existing:
            tags = _tags(existing.universe_tags or "user_watchlist")
            if universe_name not in tags:
                tags.add(universe_name)
                updated += 1
            existing.universe_tags = ",".join(sorted(tags))
            existing.is_active = True
            existing.universe_updated_at = now
            if not existing.notes:
                existing.notes = f"auto universe: {universe_name}"
            continue
        db.add(
            Watchlist(
                ticker=ticker,
                notes=f"auto universe: {universe_name}",
                universe_tags=universe_name,
                auto_managed=True,
                universe_updated_at=now,
            )
        )
        inserted += 1
    for benchmark in BENCHMARK_TICKERS:
        existing = db.scalar(select(Watchlist).where(Watchlist.ticker == benchmark))
        if not existing:
            db.add(
                Watchlist(
                    ticker=benchmark,
                    notes="benchmark",
                    universe_tags="benchmark",
                    auto_managed=True,
                    universe_updated_at=now,
                )
            )
            inserted += 1
    db.commit()
    return UniverseRefreshResult(universe_name, inserted, updated, len(tickers), source)


async def refresh_sp500_universe(db: Session) -> UniverseRefreshResult:
    try:
        tickers = await fetch_wikipedia_tickers(SP500_URL, {"symbol"})
        source = "wikipedia"
    except Exception:
        tickers = SP500_FALLBACK
        source = "fallback"
    return _upsert_universe_tickers(db, tickers, "sp500", source)


async def refresh_nasdaq100_universe(db: Session) -> UniverseRefreshResult:
    try:
        tickers = await fetch_wikipedia_tickers(NASDAQ100_URL, {"ticker", "symbol"})
        source = "wikipedia"
    except Exception:
        tickers = NASDAQ100_FALLBACK
        source = "fallback"
    return _upsert_universe_tickers(db, tickers, "nasdaq100", source)


async def refresh_configured_universes(db: Session) -> list[UniverseRefreshResult]:
    sources = {item.strip().lower() for item in get_settings().auto_universe_sources.split(",") if item.strip()}
    results: list[UniverseRefreshResult] = []
    if "sp500" in sources:
        results.append(await refresh_sp500_universe(db))
    if "nasdaq100" in sources or "nasdaq_100" in sources:
        results.append(await refresh_nasdaq100_universe(db))
    return results
