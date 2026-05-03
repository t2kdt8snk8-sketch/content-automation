from __future__ import annotations

import asyncio

from apscheduler.schedulers.background import BackgroundScheduler

from app.config import get_settings
from app.data.collector import collect_prices
from app.data.features import calculate_all_features, generate_candidates
from app.data.universe import refresh_configured_universes
from app.db import SessionLocal
from app.learning.dataset import DEFAULT_HORIZONS, build_training_examples_for_horizons
from app.learning.predict import refresh_training_example_probabilities
from app.models import Candidate
from app.ai.orchestrator import generate_memo_for_candidate
from app.reports.performance import update_performance_snapshots

_scheduler: BackgroundScheduler | None = None


async def run_daily_pipeline() -> None:
    db = SessionLocal()
    try:
        await refresh_configured_universes(db)
        await collect_prices(db)
        calculate_all_features(db)
        generate_candidates(db)
        build_training_examples_for_horizons(db)
        for universe_name in ("user_watchlist", "sp500", "nasdaq100"):
            for horizon in DEFAULT_HORIZONS:
                refresh_training_example_probabilities(db, universe_name=universe_name, horizon=horizon)
        top_n = get_settings().auto_memo_top_n
        candidates = (
            db.query(Candidate)
            .order_by(Candidate.baseline_score.desc(), Candidate.created_at.desc())
            .limit(top_n)
            .all()
        )
        for candidate in candidates:
            if not candidate.memos:
                await generate_memo_for_candidate(db, candidate)
        update_performance_snapshots(db)
    finally:
        db.close()


def run_daily_pipeline_sync() -> None:
    asyncio.run(run_daily_pipeline())


def start_scheduler() -> None:
    global _scheduler
    if _scheduler:
        return
    settings = get_settings()
    _scheduler = BackgroundScheduler(timezone="Asia/Seoul")
    _scheduler.add_job(
        run_daily_pipeline_sync,
        trigger="cron",
        hour=settings.auto_collect_cron_hour,
        minute=settings.auto_collect_cron_minute,
        id="daily_pipeline",
        replace_existing=True,
    )
    _scheduler.start()
