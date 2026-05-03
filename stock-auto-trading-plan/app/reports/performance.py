from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import InvestmentMemo, LearningNote, PerformanceSnapshot, PriceBar
from app.reports.learning_notes import create_learning_note

HORIZONS = (5, 10, 20)
STRESS_COST = 0.005
LOSS_NOTE_THRESHOLD = -0.08


def _bars_after(db: Session, ticker: str, as_of_date) -> list[PriceBar]:
    return list(
        db.scalars(
            select(PriceBar)
            .where(PriceBar.ticker == ticker, PriceBar.date >= as_of_date)
            .order_by(PriceBar.date.asc())
        )
    )


def update_performance_snapshots(db: Session, benchmark: str = "SPY") -> int:
    updated = 0
    memos = list(db.scalars(select(InvestmentMemo)))
    for memo in memos:
        bars = _bars_after(db, memo.ticker, memo.as_of_date)
        bench_bars = _bars_after(db, benchmark, memo.as_of_date)
        if not bars:
            continue
        entry = bars[0].adjusted_close
        bench_entry = bench_bars[0].adjusted_close if bench_bars else None
        for horizon in HORIZONS:
            existing = db.scalar(
                select(PerformanceSnapshot).where(
                    PerformanceSnapshot.memo_id == memo.id,
                    PerformanceSnapshot.horizon_days == horizon,
                )
            )
            if len(bars) <= horizon:
                status = "pending"
                future = None
                ret = None
                bench_ret = None
                excess = None
            else:
                status = "ready"
                future = bars[horizon].adjusted_close
                ret = future / entry - 1 if entry else None
                if bench_entry and len(bench_bars) > horizon:
                    bench_ret = bench_bars[horizon].adjusted_close / bench_entry - 1
                    excess = (ret or 0) - bench_ret
                else:
                    bench_ret = None
                    excess = None
            conservative = (ret - STRESS_COST) if ret is not None else None
            regime = "benchmark_up" if (bench_ret or 0) > 0 else "benchmark_down" if bench_ret is not None else "unknown"
            universe_name = memo.candidate.universe_name if memo.candidate else "user_watchlist"
            if existing:
                existing.entry_close = entry
                existing.future_close = future
                existing.return_pct = ret
                existing.paper_return_pct = ret
                existing.conservative_return_pct = conservative
                existing.cost_assumption_pct = STRESS_COST
                existing.benchmark_return_pct = bench_ret
                existing.excess_return_pct = excess
                existing.market_regime = regime
                existing.universe_name = universe_name
                existing.status = status
            else:
                db.add(
                    PerformanceSnapshot(
                        memo_id=memo.id,
                        ticker=memo.ticker,
                        horizon_days=horizon,
                        entry_close=entry,
                        future_close=future,
                        return_pct=ret,
                        paper_return_pct=ret,
                        conservative_return_pct=conservative,
                        cost_assumption_pct=STRESS_COST,
                        benchmark_return_pct=bench_ret,
                        excess_return_pct=excess,
                        market_regime=regime,
                        universe_name=universe_name,
                        status=status,
                    )
                )
            updated += 1
            if (
                horizon == 10
                and status == "ready"
                and conservative is not None
                and conservative <= LOSS_NOTE_THRESHOLD
            ):
                _record_loss_note(db, memo, conservative, bench_ret)
    db.commit()
    return updated


def _record_loss_note(
    db: Session,
    memo: InvestmentMemo,
    conservative_return: float,
    benchmark_return: float | None,
) -> None:
    existing = db.scalar(
        select(LearningNote).where(
            LearningNote.memo_id == memo.id,
            LearningNote.failure_reason == "loss_below_threshold",
        )
    )
    if existing:
        return
    bench_text = f"{benchmark_return * 100:.1f}%" if benchmark_return is not None else "N/A"
    evidence = (
        f"보수적 수익 {conservative_return * 100:.1f}% / 벤치마크 {bench_text} / "
        f"점수 {memo.total_score:.0f} / 위험상태 {memo.risk_status}"
    )
    create_learning_note(
        db,
        failure_reason="loss_below_threshold",
        confidence_tier="hypothesis",
        evidence=evidence,
        suggested_rule_change=f"점수 {memo.total_score:.0f} 이하 / 위험상태 {memo.risk_status} 메모 재검토",
        memo_id=memo.id,
        ticker=memo.ticker,
    )


def score_bucket_summary(db: Session) -> dict[str, float | int]:
    snapshots = list(
        db.scalars(
            select(PerformanceSnapshot).where(
                PerformanceSnapshot.horizon_days == 10,
                PerformanceSnapshot.status == "ready",
            )
        )
    )
    if not snapshots:
        return {"count": 0, "average_return": 0.0, "average_excess_return": 0.0}
    returns = [s.return_pct or 0 for s in snapshots]
    excess = [s.excess_return_pct or 0 for s in snapshots]
    return {
        "count": len(snapshots),
        "average_return": sum(returns) / len(returns),
        "average_excess_return": sum(excess) / len(excess),
    }


def regime_summary(db: Session, horizon_days: int = 10) -> list[dict]:
    snapshots = list(
        db.scalars(
            select(PerformanceSnapshot).where(
                PerformanceSnapshot.horizon_days == horizon_days,
                PerformanceSnapshot.status == "ready",
            )
        )
    )
    regimes = sorted({snapshot.market_regime for snapshot in snapshots})
    result = []
    for regime in regimes:
        bucket = [snapshot for snapshot in snapshots if snapshot.market_regime == regime]
        conservative = [snapshot.conservative_return_pct or 0 for snapshot in bucket]
        result.append(
            {
                "market_regime": regime,
                "count": len(bucket),
                "average_conservative_return": sum(conservative) / len(conservative) if conservative else 0.0,
            }
        )
    return result
