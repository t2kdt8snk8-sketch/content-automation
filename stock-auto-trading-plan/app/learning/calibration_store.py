from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.math.calibration import CalibrationResult, calibrate_probability
from app.models import TrainingExample


def historical_probability_rows(db: Session, universe_name: str = "user_watchlist", horizon: int = 10) -> list[dict]:
    rows = []
    examples = db.scalars(
        select(TrainingExample).where(
            TrainingExample.universe_name == universe_name,
            TrainingExample.horizon_days == horizon,
            TrainingExample.p_raw.is_not(None),
        )
    )
    for example in examples:
        rows.append({"p_raw": float(example.p_raw), "label": int(example.label)})
    return rows


def calibrate_candidate_probability(
    db: Session,
    p_raw: float | None,
    universe_name: str = "user_watchlist",
    horizon: int = 10,
) -> CalibrationResult:
    return calibrate_probability(p_raw, historical_probability_rows(db, universe_name, horizon))
