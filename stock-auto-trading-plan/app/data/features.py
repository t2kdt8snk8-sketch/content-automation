from __future__ import annotations

import math
import statistics
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Candidate, Feature, PriceBar, Watchlist


def pct_change(current: float, previous: float | None) -> float:
    if previous is None or previous == 0:
        return 0.0
    return current / previous - 1


def _bars(db: Session, ticker: str) -> list[PriceBar]:
    return list(
        db.scalars(
            select(PriceBar)
            .where(PriceBar.ticker == ticker.upper())
            .order_by(PriceBar.date.asc())
        )
    )


def calculate_feature_for_ticker(db: Session, ticker: str) -> Feature | None:
    bars = _bars(db, ticker)
    if len(bars) < 21:
        return None
    latest = bars[-1]
    closes = [bar.adjusted_close for bar in bars]
    volumes = [bar.volume for bar in bars]
    returns = [pct_change(closes[i], closes[i - 1]) for i in range(1, len(closes))]
    recent_returns = returns[-20:]
    volatility = statistics.pstdev(recent_returns) if len(recent_returns) >= 2 else 0.0
    avg_volume_20 = sum(volumes[-21:-1]) / min(20, len(volumes[-21:-1])) if len(volumes) > 1 else 0.0
    volume_ratio = volumes[-1] / avg_volume_20 if avg_volume_20 else 0.0
    high_60 = max(closes[-60:])
    low_60 = min(closes[-60:])
    feature = Feature(
        ticker=ticker.upper(),
        as_of_date=latest.date,
        return_1d=pct_change(closes[-1], closes[-2]),
        return_5d=pct_change(closes[-1], closes[-6] if len(closes) > 5 else None),
        return_20d=pct_change(closes[-1], closes[-21]),
        return_60d=pct_change(closes[-1], closes[-61] if len(closes) > 60 else None),
        volatility_20d=volatility,
        volume_ratio_20d=volume_ratio,
        relative_strength_spy=0.0,
        relative_strength_qqq=0.0,
        near_high_60d=closes[-1] / high_60 - 1 if high_60 else 0.0,
        near_low_60d=closes[-1] / low_60 - 1 if low_60 else 0.0,
    )
    return feature


def calculate_all_features(db: Session) -> int:
    count = 0
    tickers = [item.ticker for item in db.scalars(select(Watchlist).where(Watchlist.is_active.is_(True)))]
    benchmark_features = {
        ticker: calculate_feature_for_ticker(db, ticker)
        for ticker in ("SPY", "QQQ")
    }
    for ticker in tickers:
        feature = calculate_feature_for_ticker(db, ticker)
        if not feature:
            continue
        if benchmark_features.get("SPY"):
            feature.relative_strength_spy = feature.return_20d - benchmark_features["SPY"].return_20d
            feature.spy_return_20d = benchmark_features["SPY"].return_20d
            feature.spy_volatility_20d = benchmark_features["SPY"].volatility_20d
        if benchmark_features.get("QQQ"):
            feature.relative_strength_qqq = feature.return_20d - benchmark_features["QQQ"].return_20d
            feature.qqq_return_20d = benchmark_features["QQQ"].return_20d
            feature.qqq_volatility_20d = benchmark_features["QQQ"].volatility_20d
        feature.market_risk_on = 1.0 if feature.spy_return_20d > 0 and feature.qqq_return_20d > 0 else 0.0
        existing = db.scalar(
            select(Feature).where(Feature.ticker == feature.ticker, Feature.as_of_date == feature.as_of_date)
        )
        if existing:
            for attr in (
                "return_1d",
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
                "qqq_return_20d",
                "spy_volatility_20d",
                "qqq_volatility_20d",
                "market_risk_on",
            ):
                setattr(existing, attr, getattr(feature, attr))
        else:
            db.add(feature)
        count += 1
    db.commit()
    return count


def _tags(value: str | None) -> set[str]:
    return {item.strip() for item in (value or "").split(",") if item.strip()}


def _candidate_universe(db: Session, ticker: str) -> str:
    item = db.scalar(select(Watchlist).where(Watchlist.ticker == ticker.upper()))
    tags = _tags(getattr(item, "universe_tags", "user_watchlist") if item else "user_watchlist")
    if "sp500" in tags:
        return "sp500"
    if "nasdaq100" in tags:
        return "nasdaq100"
    return "user_watchlist"


def baseline_score(feature: Feature) -> tuple[float, str]:
    score = 0.0
    reasons: list[str] = []
    if feature.return_20d > 0:
        score += 15
        reasons.append("20일 수익률 양수")
    if feature.return_60d > 0:
        score += 10
        reasons.append("60일 수익률 양수")
    if feature.relative_strength_spy > 0:
        score += 15
        reasons.append("SPY 대비 상대강도 양수")
    if feature.relative_strength_qqq > 0:
        score += 10
        reasons.append("QQQ 대비 상대강도 양수")
    if feature.volume_ratio_20d >= 1.5:
        score += 10
        reasons.append("거래량 증가")
    if feature.near_high_60d >= -0.10:
        score += 10
        reasons.append("60일 고점 근접")
    if feature.volatility_20d > 0.06:
        score -= 10
        reasons.append("20일 변동성 과도")
    if feature.return_5d > 0.15:
        score -= 10
        reasons.append("최근 5일 급등")
    return max(score, 0.0), ", ".join(reasons) or "기준 점수 부족"


def _latest_dollar_volume(db: Session, ticker: str, as_of: date) -> float:
    bar = db.scalar(
        select(PriceBar)
        .where(PriceBar.ticker == ticker.upper(), PriceBar.date == as_of)
        .order_by(PriceBar.ingested_at.desc())
    )
    if not bar:
        return 0.0
    return float(bar.adjusted_close or bar.close or 0.0) * float(bar.volume or 0.0)


def generate_candidates(db: Session, minimum_score: float | None = None, min_dollar_volume: float | None = None) -> int:
    settings = get_settings()
    if minimum_score is None:
        minimum_score = settings.candidate_min_score
    if min_dollar_volume is None:
        min_dollar_volume = settings.candidate_min_dollar_volume

    count = 0
    skipped_liquidity = 0
    features = list(db.scalars(select(Feature).order_by(Feature.as_of_date.desc())))
    # Bucket by universe so each universe has its own candidate pool
    seen: set[tuple[str, date, str]] = set()
    for feature in features:
        universe = _candidate_universe(db, feature.ticker)
        key = (feature.ticker, feature.as_of_date, universe)
        if key in seen:
            continue
        seen.add(key)
        score, reason = baseline_score(feature)
        if score < minimum_score:
            continue
        dollar_volume = _latest_dollar_volume(db, feature.ticker, feature.as_of_date)
        if dollar_volume < min_dollar_volume:
            skipped_liquidity += 1
            continue
        reason_with_liquidity = f"{reason} · 거래대금 {dollar_volume / 1_000_000:.0f}M"
        existing = db.scalar(
            select(Candidate).where(
                Candidate.ticker == feature.ticker,
                Candidate.as_of_date == feature.as_of_date,
                Candidate.universe_name == universe,
            )
        )
        if existing:
            existing.baseline_score = score
            existing.candidate_reason = reason_with_liquidity
            existing.universe_name = universe
        else:
            db.add(
                Candidate(
                    ticker=feature.ticker,
                    as_of_date=feature.as_of_date,
                    baseline_score=score,
                    candidate_reason=reason_with_liquidity,
                    risk_status="ok",
                    universe_name=universe,
                )
            )
        count += 1
    db.commit()
    return count
