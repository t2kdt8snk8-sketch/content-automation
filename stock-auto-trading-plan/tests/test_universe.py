from __future__ import annotations

import pytest
from sqlalchemy import select

from app.data.universe import parse_wikipedia_tickers, refresh_nasdaq100_universe, refresh_sp500_universe
from app.models import Watchlist


def test_parse_wikipedia_tickers_extracts_symbol_column():
    html = """
    <table class="wikitable">
      <tr><th>Symbol</th><th>Security</th></tr>
      <tr><td>AAPL</td><td>Apple</td></tr>
      <tr><td>BRK.B</td><td>Berkshire</td></tr>
    </table>
    """
    assert parse_wikipedia_tickers(html, {"symbol"}) == ["AAPL", "BRK-B"]


@pytest.mark.asyncio
async def test_refresh_sp500_universe_uses_fallback_when_fetch_fails(db_session, monkeypatch):
    async def fail(*args, **kwargs):
        raise RuntimeError("network unavailable")

    monkeypatch.setattr("app.data.universe.fetch_wikipedia_tickers", fail)

    result = await refresh_sp500_universe(db_session)

    assert result.universe_name == "sp500"
    assert result.source == "fallback"
    aapl = db_session.scalar(select(Watchlist).where(Watchlist.ticker == "AAPL"))
    assert aapl is not None
    assert "sp500" in aapl.universe_tags


@pytest.mark.asyncio
async def test_refresh_nasdaq100_universe_preserves_manual_watchlist_tag(db_session, monkeypatch):
    db_session.add(Watchlist(ticker="AAPL", universe_tags="user_watchlist", auto_managed=False))
    db_session.commit()

    async def fail(*args, **kwargs):
        raise RuntimeError("network unavailable")

    monkeypatch.setattr("app.data.universe.fetch_wikipedia_tickers", fail)

    await refresh_nasdaq100_universe(db_session)

    aapl = db_session.scalar(select(Watchlist).where(Watchlist.ticker == "AAPL"))
    assert aapl is not None
    assert "user_watchlist" in aapl.universe_tags
    assert "nasdaq100" in aapl.universe_tags

