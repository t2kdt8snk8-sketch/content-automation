from __future__ import annotations

import json
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from datetime import datetime

from app.learning.model_registry import create_model_candidate
from app.math.calibration_metrics import brier_score, expected_calibration_error, log_loss
from app.math.probability import FEATURE_NAMES, starter_probability
from app.models import Candidate, Feature, TrainingExample


@dataclass(frozen=True)
class CandidateProbability:
    p_raw: float | None
    probability_status: str
    training_sample_count: int


def _feature_dict(feature: Feature | None) -> dict:
    if not feature:
        return {}
    return {name: float(getattr(feature, name, 0.0) or 0.0) for name in FEATURE_NAMES}


def _training_rows(db: Session, universe_name: str = "user_watchlist", horizon: int = 10) -> list[dict]:
    examples = db.scalars(
        select(TrainingExample)
        .where(TrainingExample.universe_name == universe_name)
        .where(TrainingExample.horizon_days == horizon)
        .order_by(TrainingExample.as_of_date.asc())
    )
    rows = []
    for example in examples:
        try:
            features = json.loads(example.feature_json)
        except json.JSONDecodeError:
            continue
        row = {name: float(features.get(name) or 0.0) for name in FEATURE_NAMES}
        row["label"] = int(example.label)
        rows.append(row)
    return rows


def _row_from_example(example: TrainingExample) -> dict | None:
    try:
        features = json.loads(example.feature_json)
    except json.JSONDecodeError:
        return None
    row = {name: float(features.get(name) or 0.0) for name in FEATURE_NAMES}
    row["label"] = int(example.label)
    return row


def predict_candidate_probability(db: Session, candidate: Candidate, horizon: int = 10) -> CandidateProbability:
    feature = db.scalar(
        select(Feature).where(
            Feature.ticker == candidate.ticker,
            Feature.as_of_date == candidate.as_of_date,
        )
    )
    training_rows = _training_rows(db, candidate.universe_name, horizon)
    result = starter_probability(_feature_dict(feature), training_rows)
    return CandidateProbability(
        p_raw=result.p_raw,
        probability_status=result.status,
        training_sample_count=result.sample_count,
    )


def refresh_training_example_probabilities(
    db: Session,
    universe_name: str = "user_watchlist",
    horizon: int = 10,
) -> int:
    examples = list(
        db.scalars(
            select(TrainingExample)
            .where(TrainingExample.universe_name == universe_name)
            .where(TrainingExample.horizon_days == horizon)
            .order_by(TrainingExample.as_of_date.asc())
        )
    )
    updated = 0
    for target in examples:
        if target.p_raw is not None:
            continue
        feature_row = _row_from_example(target)
        if feature_row is None:
            continue
        training_rows = []
        for example in examples:
            if example.id == target.id:
                continue
            row = _row_from_example(example)
            if row is not None:
                training_rows.append(row)
        result = starter_probability(feature_row, training_rows)
        if result.p_raw is not None:
            target.p_raw = result.p_raw
            updated += 1
    db.commit()
    if updated:
        record_calibration_snapshot(db, universe_name, horizon=horizon)
    return updated


def calibration_metrics(db: Session, universe_name: str = "user_watchlist", horizon: int = 10) -> dict:
    rows = []
    for example in db.scalars(
        select(TrainingExample).where(
            TrainingExample.universe_name == universe_name,
            TrainingExample.horizon_days == horizon,
            TrainingExample.p_raw.is_not(None),
        )
    ):
        rows.append({"p": float(example.p_raw), "label": int(example.label)})
    if len(rows) < 30:
        return {"sample_count": len(rows), "status": "insufficient"}
    return {
        "sample_count": len(rows),
        "status": "ok",
        "brier": brier_score(rows),
        "log_loss": log_loss(rows),
        "expected_calibration_error": expected_calibration_error(rows),
    }


def record_calibration_snapshot(
    db: Session,
    universe_name: str = "user_watchlist",
    horizon: int = 10,
    model_name: str = "starter_logreg",
) -> dict:
    metrics = calibration_metrics(db, universe_name, horizon)
    if metrics.get("status") != "ok":
        return metrics
    version = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    create_model_candidate(
        db,
        model_name=model_name,
        model_version=version,
        training_sample_count=metrics["sample_count"],
        validation_summary=metrics,
    )
    return metrics
