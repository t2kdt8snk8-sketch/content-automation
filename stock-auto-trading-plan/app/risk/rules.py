from __future__ import annotations

from typing import Any

from app.schemas import RiskResult


def evaluate_memo_payload(payload: dict[str, Any], current_sector_exposure: float = 0.0, current_total_exposure: float = 0.0) -> RiskResult:
    messages: list[str] = []
    blocked = False
    paper_only = False
    scores = payload.get("scores") or {}
    total = float(scores.get("total") or 0)
    entry = float(payload.get("entry_price") or 0)
    stop = float(payload.get("stop_price") or 0)
    max_weight = float(payload.get("max_weight") or 0)
    math_data = payload.get("math") or {}

    if total < 70:
        blocked = True
        messages.append("70점 미만이라 승인 불가")
    if math_data:
        probability_status = str(math_data.get("probability_status") or "")
        ev = math_data.get("expected_value")
        p_break_even = math_data.get("p_break_even")
        p_calibrated = math_data.get("p_calibrated")
        reward_risk = math_data.get("reward_risk")
        cost_stress_pass = bool(math_data.get("cost_stress_pass"))
        if probability_status in {"unavailable", "uncalibrated"}:
            paper_only = True
            messages.append("보정 확률 표본 부족: 모의 추적만 가능")
        elif probability_status != "calibrated":
            blocked = True
            messages.append("확률 상태가 유효하지 않아 승인 불가")
        if probability_status == "calibrated" and (ev is None or float(ev) <= 0):
            blocked = True
            messages.append("기대값이 양수가 아니라 승인 불가")
        if probability_status == "calibrated" and (
            p_break_even is None or p_calibrated is None or float(p_calibrated) < float(p_break_even) + 0.05
        ):
            blocked = True
            messages.append("보정 확률이 손익분기 확률보다 충분히 높지 않음")
        if probability_status == "calibrated" and (reward_risk is None or float(reward_risk) < 1.5):
            blocked = True
            messages.append("손익비 1.5 미만")
        if probability_status == "calibrated" and not cost_stress_pass:
            paper_only = True
            messages.append("0.5% 비용 스트레스 통과 전까지 주의")
    if max_weight > 0.07:
        blocked = True
        messages.append("한 종목 최대 비중 7% 초과")
    if current_total_exposure + max_weight > 0.70:
        blocked = True
        messages.append("AI 보조 계좌 전체 주식 노출 70% 초과")
    if current_sector_exposure + max_weight > 0.25:
        messages.append("섹터 노출 25% 초과 경고")
    if stop >= entry:
        blocked = True
        messages.append("손절가가 진입가보다 낮아야 함")
    if entry > 0 and (entry - stop) / entry > 0.12:
        blocked = True
        messages.append("진입가 대비 손절폭 12% 초과")

    if blocked:
        return RiskResult("blocked", messages, False, "blocked")
    if paper_only:
        return RiskResult("paper_only", messages, False, "paper_only")
    if messages:
        return RiskResult("warning", messages, True, "approval_ready")
    return RiskResult("ok", ["승인 가능"], True, "approval_ready")
