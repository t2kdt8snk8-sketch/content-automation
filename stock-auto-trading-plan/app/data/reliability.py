from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import PriceBar


@dataclass(frozen=True)
class DataReliability:
    status: str
    reasons: list[str]


def data_reliability_status(db: Session) -> DataReliability:
    total_bars = db.scalar(select(func.count(PriceBar.id))) or 0
    adjusted_count = db.scalar(select(func.count(PriceBar.id)).where(PriceBar.adjusted_close > 0)) or 0
    tickers = db.scalars(select(PriceBar.ticker).distinct()).all()
    if total_bars == 0:
        return DataReliability("research_only", ["가격 데이터가 아직 없습니다."])
    if adjusted_count < total_bars:
        return DataReliability("research_only", ["수정주가가 없는 가격 행이 있습니다."])
    if "SPY" not in tickers:
        return DataReliability("research_only", ["SPY 벤치마크 데이터가 없습니다."])
    return DataReliability("paper_trading_ok", ["수정주가와 벤치마크가 있어 모의 추적은 가능합니다."])
