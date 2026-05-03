from __future__ import annotations

import json
import re
from datetime import datetime, time, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.providers import AIProvider, default_providers
from app.ai.prompts import PROMPT_VERSION
from app.ai.schema import validate_memo_payload
from app.ai.scoring import attach_deterministic_math, merge_provider_payloads
from app.learning.calibration_store import calibrate_candidate_probability
from app.learning.predict import predict_candidate_probability
from app.models import Candidate, EventFeature, Feature, InvestmentMemo, PriceBar
from app.risk.rules import evaluate_memo_payload


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def build_candidate_context(db: Session, candidate: Candidate) -> dict[str, Any]:
    feature = db.scalar(
        select(Feature).where(Feature.ticker == candidate.ticker, Feature.as_of_date == candidate.as_of_date)
    )
    latest_bar = db.scalar(
        select(PriceBar)
        .where(PriceBar.ticker == candidate.ticker)
        .order_by(PriceBar.date.desc())
        .limit(1)
    )
    events = list(
        db.scalars(
            select(EventFeature)
            .where(
                EventFeature.ticker == candidate.ticker,
                EventFeature.usable_from <= datetime.combine(candidate.as_of_date, time.max),
            )
            .order_by(EventFeature.usable_from.desc())
            .limit(5)
        )
    )
    probability = predict_candidate_probability(db, candidate)
    calibration = calibrate_candidate_probability(db, probability.p_raw, candidate.universe_name)
    probability_status = calibration.status if probability.p_raw is not None else probability.probability_status
    return {
        "ticker": candidate.ticker,
        "as_of_date": candidate.as_of_date.isoformat(),
        "universe_name": candidate.universe_name,
        "baseline_score": candidate.baseline_score,
        "candidate_reason": candidate.candidate_reason,
        "latest_close": latest_bar.adjusted_close if latest_bar else None,
        "latest_dollar_volume": (latest_bar.adjusted_close * latest_bar.volume) if latest_bar else None,
        "features": {
            "return_5d": feature.return_5d if feature else None,
            "return_20d": feature.return_20d if feature else None,
            "return_60d": feature.return_60d if feature else None,
            "volatility_20d": feature.volatility_20d if feature else None,
            "volume_ratio_20d": feature.volume_ratio_20d if feature else None,
            "relative_strength_spy": feature.relative_strength_spy if feature else None,
            "relative_strength_qqq": feature.relative_strength_qqq if feature else None,
            "near_high_60d": feature.near_high_60d if feature else None,
            "near_low_60d": feature.near_low_60d if feature else None,
            "spy_return_20d": feature.spy_return_20d if feature else None,
            "qqq_return_20d": feature.qqq_return_20d if feature else None,
            "market_risk_on": feature.market_risk_on if feature else None,
        },
        "learning": {
            "p_raw": probability.p_raw,
            "p_calibrated": calibration.p_calibrated,
            "probability_status": probability_status,
            "training_sample_count": probability.training_sample_count,
            "calibration_sample_count": calibration.sample_count,
        },
        "events": [
            {
                "event_date": event.event_date.isoformat(),
                "usable_from": event.usable_from.isoformat(),
                "event_type": event.event_type,
                "sentiment_score": event.sentiment_score,
                "uncertainty_score": event.uncertainty_score,
                "guidance_score": event.guidance_score,
                "risk_score": event.risk_score,
                "summary": event.summary,
            }
            for event in events
        ],
    }


def _holding_period_days(holding_period: str | None, default_days: int = 10) -> int:
    if not holding_period:
        return default_days
    numbers = [int(match) for match in re.findall(r"\d+", holding_period)]
    if not numbers:
        return default_days
    return max(numbers)


def _default_valid_until(candidate: Candidate, holding_period: str | None = None) -> datetime:
    trading_days = _holding_period_days(holding_period)
    calendar_days = max(1, int(round(trading_days * 1.4)))
    return datetime.combine(
        candidate.as_of_date + timedelta(days=calendar_days),
        time(hour=10, minute=0),
    )


async def generate_memo_for_candidate(
    db: Session,
    candidate: Candidate,
    providers: list[AIProvider] | None = None,
) -> InvestmentMemo:
    providers = providers or default_providers()
    context = build_candidate_context(db, candidate)
    results = []
    payloads = []
    for provider in providers:
        result = await provider.generate(context)
        results.append(result.__dict__)
        if result.ok and result.content:
            try:
                payload = _extract_json(result.content)
                if validate_memo_payload(payload).ok:
                    payloads.append(payload)
            except Exception:
                continue
    final_payload = merge_provider_payloads(payloads)
    final_payload = attach_deterministic_math(final_payload, context)
    validation = validate_memo_payload(final_payload)
    if not validation.ok:
        raise ValueError("; ".join(validation.errors))
    risk_result = evaluate_memo_payload(final_payload)
    scores = final_payload["scores"]
    source_summary = {**context, "math": final_payload.get("math", {})}
    memo = InvestmentMemo(
        candidate_id=candidate.id,
        ticker=candidate.ticker,
        as_of_date=candidate.as_of_date,
        recommendation=final_payload["recommendation"],
        confidence=float(final_payload["confidence"]),
        total_score=float(scores["total"]),
        score_price_trend=float(scores.get("price_trend", 0)),
        score_fundamental=float(scores.get("fundamental", 0)),
        score_news_event=float(scores.get("news_event", 0)),
        score_flow_volume=float(scores.get("flow_volume", 0)),
        score_risk=float(scores.get("risk", 0)),
        score_reward_risk=float(scores.get("reward_risk", 0)),
        entry_price=float(final_payload["entry_price"]),
        stop_price=float(final_payload["stop_price"]),
        review_price=float(final_payload["review_price"]),
        max_weight=float(final_payload["max_weight"]),
        holding_period=final_payload["holding_period"],
        bull_case=final_payload["bull_case"],
        bear_case=final_payload["bear_case"],
        key_reasons_json=json.dumps(final_payload["key_reasons"], ensure_ascii=False),
        counter_reasons_json=json.dumps(final_payload["counter_reasons"], ensure_ascii=False),
        do_not_trade_if_json=json.dumps(final_payload["do_not_trade_if"], ensure_ascii=False),
        model_stack_json=json.dumps([r for r in results if r["enabled"]], ensure_ascii=False),
        prompt_version=PROMPT_VERSION,
        source_summary_json=json.dumps(source_summary, ensure_ascii=False, default=str),
        raw_outputs_json=json.dumps(results, ensure_ascii=False),
        risk_status=risk_result.status,
        decision_mode=risk_result.decision_mode,
        risk_messages_json=json.dumps(risk_result.messages + validation.warnings, ensure_ascii=False),
        valid_until=_default_valid_until(candidate, final_payload.get("holding_period")),
        max_entry_drift_pct=0.015,
        invalidated_by_event=True,
    )
    db.add(memo)
    db.commit()
    db.refresh(memo)
    return memo
