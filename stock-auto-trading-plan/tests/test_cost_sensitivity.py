from __future__ import annotations

from app.math.cost_sensitivity import cost_sensitivity, passes_stress_cost


def test_ev_decreases_as_cost_increases():
    rows = cost_sensitivity(0.6, 0.06, 0.03, [0.001, 0.003, 0.005])
    assert rows[0]["ev"] > rows[1]["ev"] > rows[2]["ev"]


def test_strategy_that_only_works_at_low_cost_fails_stress():
    rows = cost_sensitivity(0.50, 0.02, 0.015, [0.001, 0.003, 0.005])
    assert not passes_stress_cost(rows)


def test_strategy_positive_at_stress_cost_passes():
    rows = cost_sensitivity(0.7, 0.08, 0.03, [0.001, 0.003, 0.005])
    assert passes_stress_cost(rows)
