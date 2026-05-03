from __future__ import annotations

from app.math.monotonicity import monotonicity_pass, score_bucket_summary


def rows_for_bucket(score: float, excess: float, count: int = 20):
    return [{"score": score, "excess_return": excess} for _ in range(count)]


def test_increasing_bucket_returns_pass():
    rows = rows_for_bucket(65, 0.001) + rows_for_bucket(80, 0.005) + rows_for_bucket(90, 0.010)
    assert monotonicity_pass(score_bucket_summary(rows))


def test_higher_score_underperforming_fails():
    rows = rows_for_bucket(65, 0.010) + rows_for_bucket(80, 0.005) + rows_for_bucket(90, 0.001)
    assert not monotonicity_pass(score_bucket_summary(rows))


def test_not_enough_samples_fails():
    rows = rows_for_bucket(65, 0.001, 5) + rows_for_bucket(80, 0.005, 5) + rows_for_bucket(90, 0.010, 5)
    assert not monotonicity_pass(score_bucket_summary(rows))

