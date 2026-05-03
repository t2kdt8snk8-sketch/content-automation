from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.data.sources import fetch_stooq_daily
from app.data.validators import validate_price_row
from app.models import DataRun, PriceBar, Watchlist

BENCHMARK_TICKERS = ("SPY", "QQQ", "IWM")


async def _fetch_with_retry(ticker: str, start: date, max_retries: int):
    last_exc: Exception | None = None
    for attempt in range(max_retries):
        try:
            return await fetch_stooq_daily(ticker, start=start)
        except Exception as exc:
            last_exc = exc
            await asyncio.sleep(0.5 * (2 ** attempt))
    if last_exc:
        raise last_exc
    return []


async def collect_prices(db: Session) -> DataRun:
    settings = get_settings()
    run = DataRun(run_type="auto", source="stooq", status="running")
    db.add(run)
    db.commit()
    tickers = {item.ticker for item in db.scalars(select(Watchlist).where(Watchlist.is_active.is_(True)))}
    tickers.update(BENCHMARK_TICKERS)
    inserted = 0
    warnings: list[str] = []
    fail_count = 0
    delay_seconds = max(0.0, settings.collector_request_delay_ms / 1000.0)
    try:
        for ticker in sorted(tickers):
            start = date.today() - timedelta(days=settings.price_history_days)
            try:
                rows = await _fetch_with_retry(ticker, start, settings.collector_max_retries)
            except Exception as exc:
                fail_count += 1
                warnings.append(f"{ticker}: fetch failed ({exc})")
                if delay_seconds:
                    await asyncio.sleep(delay_seconds)
                continue
            previous_close: float | None = None
            for row in rows:
                result = validate_price_row(row, previous_close)
                previous_close = row.adjusted_close
                if not result.ok:
                    warnings.extend([f"{ticker} {row.date}: {error}" for error in result.errors])
                    continue
                exists = db.scalar(
                    select(PriceBar).where(
                        PriceBar.ticker == row.ticker,
                        PriceBar.date == row.date,
                        PriceBar.source == row.source,
                    )
                )
                if exists:
                    continue
                db.add(
                    PriceBar(
                        ticker=row.ticker,
                        date=row.date,
                        open=row.open,
                        high=row.high,
                        low=row.low,
                        close=row.close,
                        volume=row.volume,
                        adjusted_close=row.adjusted_close,
                        source=row.source,
                    )
                )
                inserted += 1
            if delay_seconds:
                await asyncio.sleep(delay_seconds)
        run.status = "success" if not warnings else "partial"
        run.message = (
            f"inserted {inserted} bars; tickers fetched: {len(tickers) - fail_count}/{len(tickers)}"
            + (f"; warnings: {len(warnings)}" if warnings else "")
        )
        run.finished_at = datetime.utcnow()
        db.commit()
    except Exception as exc:
        run.status = "failed"
        run.message = str(exc)
        run.finished_at = datetime.utcnow()
        db.commit()
    return run
