from __future__ import annotations

import csv
import hashlib
from datetime import datetime
from io import StringIO

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.data.validators import parse_date, validate_price_columns, validate_price_row
from app.models import DataRun, PriceBar, Watchlist
from app.schemas import PriceInput


def file_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def import_watchlist_csv(db: Session, content: bytes) -> int:
    reader = csv.DictReader(StringIO(content.decode("utf-8-sig")))
    count = 0
    for raw in reader:
        ticker = (raw.get("ticker") or "").strip().upper()
        if not ticker:
            continue
        existing = db.scalar(select(Watchlist).where(Watchlist.ticker == ticker))
        if existing:
            existing.name = (raw.get("name") or existing.name or "").strip()
            existing.sector = (raw.get("sector") or existing.sector or "").strip()
            existing.notes = (raw.get("notes") or existing.notes or "").strip()
            existing.is_active = True
            tags = {item.strip() for item in (existing.universe_tags or "").split(",") if item.strip()}
            tags.add("user_watchlist")
            existing.universe_tags = ",".join(sorted(tags))
            existing.auto_managed = False
        else:
            db.add(
                Watchlist(
                    ticker=ticker,
                    name=(raw.get("name") or "").strip(),
                    sector=(raw.get("sector") or "").strip(),
                    notes=(raw.get("notes") or "").strip(),
                )
            )
        count += 1
    db.commit()
    return count


def import_price_csv(db: Session, content: bytes, source: str = "csv") -> tuple[int, list[str]]:
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(StringIO(text))
    columns_result = validate_price_columns(set(reader.fieldnames or []))
    if not columns_result.ok:
        raise ValueError("; ".join(columns_result.errors))

    run = DataRun(run_type="csv_upload", source=source, status="running", file_hash=file_hash(content))
    db.add(run)
    db.commit()

    inserted = 0
    warnings: list[str] = []
    previous_by_ticker: dict[str, float] = {}
    try:
        for line_no, raw in enumerate(reader, start=2):
            row = PriceInput(
                ticker=(raw["ticker"] or "").strip().upper(),
                date=parse_date(raw["date"]),
                open=float(raw["open"]),
                high=float(raw["high"]),
                low=float(raw["low"]),
                close=float(raw["close"]),
                volume=float(raw["volume"]),
                adjusted_close=float(raw["adjusted_close"]),
                source=source,
            )
            result = validate_price_row(row, previous_by_ticker.get(row.ticker))
            if not result.ok:
                raise ValueError(f"line {line_no}: {'; '.join(result.errors)}")
            warnings.extend([f"line {line_no}: {warning}" for warning in result.warnings])
            previous_by_ticker[row.ticker] = row.adjusted_close

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
        run.status = "success"
        run.message = f"inserted {inserted} bars"
        run.finished_at = datetime.utcnow()
        db.commit()
        return inserted, warnings
    except Exception as exc:
        run.status = "failed"
        run.message = str(exc)
        run.finished_at = datetime.utcnow()
        db.commit()
        raise
