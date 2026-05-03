from __future__ import annotations

import pytest

from app.math.trade_math import capped_fractional_kelly, expected_value, math_score, trade_terms


def test_trade_terms_calculates_break_even_probability():
    terms = trade_terms(entry=100, stop=97, target=106, cost=0.003)
    assert terms["gain"] == pytest.approx(0.06)
    assert terms["loss"] == pytest.approx(0.03)
    assert terms["p_break_even"] == pytest.approx(0.033 / 0.09)
    assert terms["reward_risk"] == pytest.approx(2.0)


@pytest.mark.parametrize(
    ("entry", "stop", "target"),
    [(0, 94, 108), (100, 101, 108), (100, 94, 99)],
)
def test_trade_terms_rejects_invalid_price_structure(entry, stop, target):
    with pytest.raises(ValueError):
        trade_terms(entry=entry, stop=stop, target=target, cost=0.003)


def test_expected_value_positive_and_negative_examples():
    assert expected_value(0.45, 0.05, 0.02, 0.003) == pytest.approx(0.0085)
    assert expected_value(0.60, 0.01, 0.02, 0.003) == pytest.approx(-0.005)


def test_math_score_is_clamped_to_0_100():
    assert 0 <= math_score(-1, 0, 1, 0, 0, 1) <= 100
    assert math_score(1, 1, 0, 10, 10**12, 0) == pytest.approx(100)


def test_capped_fractional_kelly_respects_caps():
    weight = capped_fractional_kelly(0.7, gain=0.08, loss=0.04, sector_remaining=0.20, account_remaining=0.50)
    assert 0 <= weight <= 0.07
    assert capped_fractional_kelly(0.2, gain=0.04, loss=0.08) == 0
