from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta


@dataclass(frozen=True)
class WalkForwardSplit:
    train_start: date
    train_end: date
    test_start: date
    test_end: date
    embargo_start: date
    embargo_end: date


def purged_walk_forward_splits(
    start: date,
    end: date,
    train_days: int,
    test_days: int,
    embargo_days: int,
) -> list[WalkForwardSplit]:
    if train_days <= 0 or test_days <= 0 or embargo_days < 0:
        raise ValueError("invalid split lengths")
    splits: list[WalkForwardSplit] = []
    train_start = start
    while True:
        train_end = train_start + timedelta(days=train_days - 1)
        embargo_start = train_end + timedelta(days=1)
        embargo_end = train_end + timedelta(days=embargo_days)
        test_start = embargo_end + timedelta(days=1)
        test_end = test_start + timedelta(days=test_days - 1)
        if test_end > end:
            break
        splits.append(WalkForwardSplit(train_start, train_end, test_start, test_end, embargo_start, embargo_end))
        train_start = train_start + timedelta(days=test_days)
    return splits

