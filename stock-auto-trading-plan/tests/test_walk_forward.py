from __future__ import annotations

from datetime import date

from app.math.walk_forward import purged_walk_forward_splits


def test_purged_walk_forward_has_no_overlap_and_embargo_between_train_test():
    splits = purged_walk_forward_splits(date(2026, 1, 1), date(2026, 4, 30), train_days=30, test_days=10, embargo_days=14)
    assert splits
    first = splits[0]
    assert first.train_end < first.embargo_start <= first.embargo_end < first.test_start <= first.test_end


def test_purged_walk_forward_does_not_extend_beyond_end():
    end = date(2026, 3, 31)
    splits = purged_walk_forward_splits(date(2026, 1, 1), end, train_days=30, test_days=10, embargo_days=14)
    assert all(split.test_end <= end for split in splits)

