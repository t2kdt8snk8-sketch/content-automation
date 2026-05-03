from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ModelVersion


ALLOWED_STATUSES = {"candidate", "paper_active", "retired", "rejected"}


def create_model_candidate(
    db: Session,
    model_name: str,
    model_version: str,
    training_sample_count: int,
    validation_summary: dict,
) -> ModelVersion:
    model = ModelVersion(
        model_name=model_name,
        model_version=model_version,
        training_sample_count=training_sample_count,
        validation_summary_json=json.dumps(validation_summary),
        status="candidate",
        approved_by_user=False,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return model


def promote_model(db: Session, model_id: int, user_approved: bool) -> ModelVersion:
    model = db.get(ModelVersion, model_id)
    if not model:
        raise ValueError("model not found")
    if not user_approved:
        raise ValueError("user approval required")
    for active in db.scalars(select(ModelVersion).where(ModelVersion.status == "paper_active")):
        active.status = "retired"
    model.status = "paper_active"
    model.approved_by_user = True
    db.commit()
    db.refresh(model)
    return model
