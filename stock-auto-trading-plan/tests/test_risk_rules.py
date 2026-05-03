from __future__ import annotations

from app.risk.rules import evaluate_memo_payload


def payload(total=80, max_weight=0.03, entry=100, stop=94, math=None):
    return {
        "scores": {"total": total},
        "max_weight": max_weight,
        "entry_price": entry,
        "stop_price": stop,
        **({"math": math} if math is not None else {}),
    }


def test_risk_blocks_low_score():
    result = evaluate_memo_payload(payload(total=65))
    assert result.status == "blocked"
    assert not result.approval_allowed


def test_risk_blocks_too_much_single_name_weight():
    result = evaluate_memo_payload(payload(max_weight=0.08))
    assert result.status == "blocked"
    assert "한 종목 최대 비중 7% 초과" in result.messages


def test_risk_allows_clean_payload():
    result = evaluate_memo_payload(payload())
    assert result.status == "ok"
    assert result.approval_allowed


def test_risk_marks_uncalibrated_probability_paper_only():
    result = evaluate_memo_payload(
        payload(
            total=90,
            math={
                "probability_status": "unavailable",
                "expected_value": None,
                "p_break_even": 0.4,
                "p_calibrated": None,
                "reward_risk": 2.0,
                "cost_stress_pass": False,
            },
        )
    )
    assert result.status == "paper_only"
    assert not result.approval_allowed
    assert "보정 확률 표본 부족: 모의 추적만 가능" in result.messages


def test_risk_allows_calibrated_positive_ev_payload():
    result = evaluate_memo_payload(
        payload(
            total=90,
            math={
                "probability_status": "calibrated",
                "expected_value": 0.01,
                "p_break_even": 0.4,
                "p_calibrated": 0.5,
                "reward_risk": 2.0,
                "cost_stress_pass": True,
            },
        )
    )
    assert result.status == "ok"
