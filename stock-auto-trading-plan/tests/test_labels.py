from __future__ import annotations

from app.math.labels import triple_barrier_label


def test_triple_barrier_returns_one_when_upper_touched_first():
    closes = [100, 103, 105, 104]
    benchmark = [100, 100, 100, 100]
    assert triple_barrier_label(closes, benchmark, entry_index=0, volatility=0.02, horizon=3) == 1


def test_triple_barrier_returns_zero_when_lower_touched_first():
    closes = [100, 99, 97, 106]
    benchmark = [100, 100, 100, 100]
    assert triple_barrier_label(closes, benchmark, entry_index=0, volatility=0.02, horizon=3) == 0


def test_triple_barrier_returns_none_for_insufficient_future_data():
    assert triple_barrier_label([100, 101], [100, 101], entry_index=0, volatility=0.02, horizon=3) is None


def test_triple_barrier_uses_benchmark_relative_return_when_no_barrier_touched():
    assert triple_barrier_label([100, 101, 101, 101], [100, 100, 100, 100], 0, 0.05, 3) == 1
    assert triple_barrier_label([100, 101, 101, 101], [100, 102, 102, 102], 0, 0.05, 3) == 0

