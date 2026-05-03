from __future__ import annotations


def triple_barrier_label(
    closes: list[float],
    benchmark_closes: list[float],
    entry_index: int,
    volatility: float,
    horizon: int = 10,
) -> int | None:
    if entry_index < 0 or entry_index >= len(closes) or entry_index >= len(benchmark_closes):
        return None
    entry = closes[entry_index]
    benchmark_entry = benchmark_closes[entry_index]
    if entry <= 0 or benchmark_entry <= 0 or volatility <= 0:
        return None
    upper = entry * (1 + 2.0 * volatility)
    lower = entry * (1 - 1.0 * volatility)
    future = closes[entry_index + 1 : entry_index + horizon + 1]
    benchmark_future = benchmark_closes[entry_index + 1 : entry_index + horizon + 1]
    if len(future) < horizon or len(benchmark_future) < horizon:
        return None
    for close in future:
        if close >= upper:
            return 1
        if close <= lower:
            return 0
    stock_return = future[-1] / entry - 1
    benchmark_return = benchmark_future[-1] / benchmark_entry - 1
    return 1 if stock_return - benchmark_return > 0 else 0

