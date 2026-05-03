from __future__ import annotations

import pytest

from app.reports.learning_notes import create_learning_note


def test_learning_note_rejects_invalid_confidence(db_session):
    with pytest.raises(ValueError):
        create_learning_note(db_session, "bad", "certain", "none", "change")


def test_hypothesis_note_marks_rule_change_test_only(db_session):
    note = create_learning_note(db_session, "earnings risk", "hypothesis", "sample small", "avoid earnings")

    assert note.suggested_rule_change.startswith("[TEST_ONLY]")
