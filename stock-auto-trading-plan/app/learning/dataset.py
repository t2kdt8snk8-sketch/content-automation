from __future__ import annotations

import json
import statistics

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.math.labels import triple_barrier_label
from app.models import PriceBar, TrainingExample, Watchlist


FEATURE_NAMES = [
    "return_5d",
    "return_20d",
    "return_60d",
    "volatility_20d",
    "volume_ratio_20d",
    "relative_strength_spy",
    "relative_strength_qqq",
    "near_high_60d",
    "near_low_60d",
    "spy_return_20d",
    "market_risk_on",
]

DEFAULT_HORIZONS = (5, 10, 20, 30)


def _pct_change(current: float, previous: float | None) -> float:
    if previous is None or previous == 0:
        return 0.0
    return current / previous - 1


def _returns(closes: list[float]) -> list[float]:
    return [_pct_change(closes[index], closes[index - 1]) for index in range(1, len(closes))]


def _bars(db: Session, ticker: str) -> list[PriceBar]:
    return list(
        db.scalars(
            select(PriceBar)
            .where(PriceBar.ticker == ticker.upper())
            .order_by(PriceBar.date.asc())
        )
    )


def _tags(value: str | None) -> set[str]:
    return {item.strip() for item in (value or "").split(",") if item.strip()}


def _watchlist_tickers(db: Session, universe_name: str, benchmark: str) -> list[str]:
    items = db.scalars(select(Watchlist).where(Watchlist.is_active.is_(True)))
    tickers: list[str] = []
    for item in items:
        ticker = item.ticker.upper()
        if ticker == benchmark.upper():
            continue
        tags = _tags(getattr(item, "universe_tags", None) or "user_watchlist")
        if universe_name in tags:
            tickers.append(ticker)
    return tickers


def feature_row_at(
    ticker: str,
    closes: list[float],
    volumes: list[float],
    benchmark_closes: list[float],
    index: int,
) -> dict[str, float | str]:
    history = closes[: index + 1]
    benchmark_history = benchmark_closes[: index + 1]
    volume_history = volumes[: index + 1]
    recent_returns = _returns(history)[-20:]
    benchmark_recent_returns = _returns(benchmark_history)[-20:]
    volatility = statistics.pstdev(recent_returns) if len(recent_returns) >= 2 else 0.0
    benchmark_volatility = statistics.pstdev(benchmark_recent_returns) if len(benchmark_recent_returns) >= 2 else 0.0
    avg_volume_20 = sum(volume_history[-21:-1]) / len(volume_history[-21:-1]) if len(volume_history[-21:-1]) else 0.0
    high_60 = max(history[-60:])
    low_60 = min(history[-60:])
    return_20d = _pct_change(history[-1], history[-21] if len(history) > 20 else None)
    benchmark_return_20d = _pct_change(benchmark_history[-1], benchmark_history[-21] if len(benchmark_history) > 20 else None)
    return {
        "ticker": ticker.upper(),
        "return_5d": _pct_change(history[-1], history[-6] if len(history) > 5 else None),
        "return_20d": return_20d,
        "return_60d": _pct_change(history[-1], history[-61] if len(history) > 60 else None),
        "volatility_20d": volatility,
        "volume_ratio_20d": volume_history[-1] / avg_volume_20 if avg_volume_20 else 0.0,
        "relative_strength_spy": return_20d - benchmark_return_20d,
        "relative_strength_qqq": 0.0,
        "near_high_60d": history[-1] / high_60 - 1 if high_60 else 0.0,
        "near_low_60d": history[-1] / low_60 - 1 if low_60 else 0.0,
        "spy_return_20d": benchmark_return_20d,
        "spy_volatility_20d": benchmark_volatility,
        "market_risk_on": 1.0 if benchmark_return_20d > 0 else 0.0,
    }


def build_training_examples(
    db: Session,
    horizon: int = 10,
    benchmark: str = "SPY",
    universe_name: str = "user_watchlist",
) -> int:
    benchmark_bars = _bars(db, benchmark)
    benchmark_by_date = {bar.date: bar for bar in benchmark_bars}
    if len(benchmark_by_date) < horizon + 21:
        return 0

    inserted = 0
    tickers = _watchlist_tickers(db, universe_name, benchmark)
    for ticker in tickers:
        aligned = [
            (bar, benchmark_by_date[bar.date])
            for bar in _bars(db, ticker)
            if bar.date in benchmark_by_date
        ]
        if len(aligned) < horizon + 21:
            continue
        dates = [bar.date for bar, _ in aligned]
        closes = [bar.adjusted_close for bar, _ in aligned]
        volumes = [bar.volume for bar, _ in aligned]
        benchmark_closes = [bench.adjusted_close for _, bench in aligned]
        for index in range(20, len(aligned) - horizon):
            label = triple_barrier_label(closes, benchmark_closes, index, feature_row_at(ticker, closes, volumes, benchmark_closes, index)["volatility_20d"], horizon)
            if label is None:
                continue
            existing = db.scalar(
                select(TrainingExample).where(
                    TrainingExample.ticker == ticker,
                    TrainingExample.as_of_date == dates[index],
                    TrainingExample.horizon_days == horizon,
                    TrainingExample.universe_name == universe_name,
                )
            )
            if existing:
                continue
            db.add(
                TrainingExample(
                    ticker=ticker,
                    as_of_date=dates[index],
                    feature_json=json.dumps(feature_row_at(ticker, closes, volumes, benchmark_closes, index)),
                    label=int(label),
                    horizon_days=horizon,
                    benchmark_ticker=benchmark,
                    universe_name=universe_name,
                )
            )
            inserted += 1
    db.commit()
    return inserted


def build_training_examples_for_horizons(
    db: Session,
    horizons: tuple[int, ...] = DEFAULT_HORIZONS,
    universe_names: tuple[str, ...] = ("user_watchlist", "sp500", "nasdaq100"),
    benchmark: str = "SPY",
) -> int:
    inserted = 0
    for universe_name in universe_names:
        for horizon in horizons:
            inserted += build_training_examples(
                db,
                horizon=horizon,
                benchmark=benchmark,
                universe_name=universe_name,
            )
    return inserted
