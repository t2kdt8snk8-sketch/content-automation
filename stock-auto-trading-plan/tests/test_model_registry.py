from __future__ import annotations

import pytest

from app.learning.model_registry import create_model_candidate, promote_model


def test_model_promotion_requires_user_approval(db_session):
    model = create_model_candidate(db_session, "starter", "v1", 120, {"ev": 0.01})

    with pytest.raises(ValueError):
        promote_model(db_session, model.id, user_approved=False)


def test_model_promotion_marks_paper_active(db_session):
    model = create_model_candidate(db_session, "starter", "v1", 120, {"ev": 0.01})

    promoted = promote_model(db_session, model.id, user_approved=True)

    assert promoted.status == "paper_active"
    assert promoted.approved_by_user is True
