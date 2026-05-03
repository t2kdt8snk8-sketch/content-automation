from __future__ import annotations

from datetime import date, timedelta

import httpx

from app.schemas import PriceInput


def stooq_symbol(ticker: str) -> str:
    ticker = ticker.strip().lower()
    if "." not in ticker:
        ticker = f"{ticker}.us"
    return ticker


async def fetch_stooq_daily(ticker: str, start: date | None = None, end: date | None = None) -> list[PriceInput]:
    start = start or date.today() - timedelta(days=180)
    end = end or date.today()
    url = "https://stooq.com/q/d/l/"
    params = {
        "s": stooq_symbol(ticker),
        "i": "d",
        "d1": start.strftime("%Y%m%d"),
        "d2": end.strftime("%Y%m%d"),
    }
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
    lines = response.text.strip().splitlines()
    if len(lines) <= 1 or "No data" in response.text:
        return []
    rows: list[PriceInput] = []
    for line in lines[1:]:
        raw_date, open_, high, low, close, volume = line.split(",")
        rows.append(
            PriceInput(
                ticker=ticker.upper(),
                date=date.fromisoformat(raw_date),
                open=float(open_),
                high=float(high),
                low=float(low),
                close=float(close),
                volume=float(volume),
                adjusted_close=float(close),
                source="stooq",
            )
        )
    return rows

