from __future__ import annotations

from app.math.trade_math import expected_value


DEFAULT_COST_GRID = [0.001, 0.003, 0.005]


def cost_sensitivity(p: float, gain: float, loss: float, costs: list[float] = DEFAULT_COST_GRID) -> list[dict]:
    rows = []
    for cost in costs:
        ev = expected_value(p, gain, loss, cost)
        rows.append({"cost": cost, "ev": ev, "pass": ev > 0})
    return rows


def passes_stress_cost(rows: list[dict], stress_cost: float = 0.005) -> bool:
    stress_rows = [row for row in rows if abs(float(row["cost"]) - stress_cost) < 1e-12]
    return bool(stress_rows) and all(float(row["ev"]) > 0 for row in stress_rows)

