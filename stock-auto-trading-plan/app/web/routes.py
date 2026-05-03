from __future__ import annotations

import asyncio
import csv
import io
import json
import math
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, Form, Query, Request, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response, StreamingResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.orchestrator import generate_memo_for_candidate
from app.config import get_settings
from app.data.collector import collect_prices
from app.data.features import calculate_all_features, generate_candidates
from app.data.imports import import_price_csv, import_watchlist_csv
from app.data.reliability import data_reliability_status
from app.data.universe import refresh_configured_universes, refresh_nasdaq100_universe, refresh_sp500_universe
from app.db import get_db
from app.events.ingest import ingest_event_csv
from app.learning.dataset import DEFAULT_HORIZONS, build_training_examples_for_horizons
from app.learning.model_registry import promote_model
from app.learning.predict import (
    calibration_metrics,
    refresh_training_example_probabilities,
)
from app.models import (
    ApprovalRecord,
    Candidate,
    DataRun,
    EventFeature,
    InvestmentMemo,
    LearningNote,
    ModelVersion,
    PerformanceSnapshot,
    PriceBar,
    TrainingExample,
    Watchlist,
)
from app.reports.ai_quality import ai_quality_summary
from app.reports.lean_export import export_lean_signals
from app.reports.performance import (
    regime_summary,
    score_bucket_summary,
    update_performance_snapshots,
)
from app.security import COOKIE_NAME, create_session_cookie, password_matches, require_login
from app.telegram.bot import send_memo
from app.telegram.callbacks import handle_callback
from app.web import run_state

router = APIRouter()
templates = Jinja2Templates(directory="app/web/templates")


def _polar(cx: float, cy: float, r: float, index: int, total: int) -> tuple[float, float]:
    angle = -math.pi / 2 + (index * 2 * math.pi / total)
    return (cx + r * math.cos(angle), cy + r * math.sin(angle))


templates.env.globals["polar"] = _polar
templates.env.globals["math"] = math


# ===== JSON helpers =====
def _json_list(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    if isinstance(parsed, list):
        return [str(item) for item in parsed]
    return []


def _json_raw_list(value: str | None) -> list:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def _json_dict(value: str | None) -> dict:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


# ===== Base context =====
def _scheduler_on(db: Session) -> bool:
    settings = get_settings()
    return bool(getattr(settings, "scheduler_enabled", False))


def _base_context(request: Request, db: Session) -> dict[str, Any]:
    return {
        "request": request,
        "data_reliability": data_reliability_status(db),
        "scheduler_on": _scheduler_on(db),
        "run_running": run_state.is_running(),
    }


def _guard(request: Request):
    redirect = require_login(request)
    if redirect:
        return redirect
    return None


# ===== Dashboard helpers =====
def _risk_tier(memo: InvestmentMemo) -> str:
    """Map risk_status + decision_mode to 4-tier (ok/warning/paper_only/blocked)."""
    if memo.risk_status == "blocked":
        return "blocked"
    if memo.decision_mode == "paper_only":
        return "paper_only"
    if memo.risk_status == "warning":
        return "warning"
    return "ok"


def _score_tier(score: float) -> str:
    if score >= 70:
        return "high"
    if score >= 50:
        return "mid"
    return "low"


def _performance_summary_for_horizon(db: Session, horizon: int) -> dict:
    snapshots = list(
        db.scalars(
            select(PerformanceSnapshot).where(
                PerformanceSnapshot.horizon_days == horizon,
                PerformanceSnapshot.status == "ready",
            )
        )
    )
    if not snapshots:
        return {"count": 0, "average_return": 0.0, "average_excess_return": 0.0, "series": []}
    returns = [s.return_pct or 0 for s in snapshots]
    excess = [s.excess_return_pct or 0 for s in snapshots]
    return {
        "count": len(snapshots),
        "average_return": sum(returns) / len(returns),
        "average_excess_return": sum(excess) / len(excess),
        "series": returns,
    }


def _dashboard_context(db: Session) -> dict[str, Any]:
    watchlist_count = db.query(Watchlist).count()
    candidate_count = db.query(Candidate).count()
    memo_count = db.query(InvestmentMemo).count()
    pending_count = db.query(InvestmentMemo).filter(InvestmentMemo.approval_status == "pending").count()
    blocked_count = db.query(InvestmentMemo).filter(InvestmentMemo.risk_status == "blocked").count()
    approved_count = db.query(InvestmentMemo).filter(InvestmentMemo.approval_status == "approved").count()

    memos = list(db.scalars(select(InvestmentMemo)))
    math_contexts = [_json_dict(memo.source_summary_json).get("math") or {} for memo in memos]
    calibrated_count = sum(1 for item in math_contexts if item.get("probability_status") == "calibrated")
    math_attached_count = sum(1 for item in math_contexts if item)
    stress_pass_count = sum(1 for item in math_contexts if item.get("cost_stress_pass") is True)
    positive_ev_count = sum(
        1 for item in math_contexts
        if isinstance(item.get("expected_value"), (int, float)) and item["expected_value"] > 0
    )

    latest_runs = list(
        db.scalars(select(DataRun).order_by(DataRun.started_at.desc()).limit(5))
    )
    latest_run = latest_runs[0] if latest_runs else None
    training_count = db.query(TrainingExample).count()
    active_model = db.scalar(
        select(ModelVersion)
        .where(ModelVersion.status == "paper_active")
        .order_by(ModelVersion.trained_at.desc())
    )

    pending_memos = list(
        db.scalars(
            select(InvestmentMemo)
            .where(InvestmentMemo.approval_status == "pending")
            .order_by(InvestmentMemo.total_score.desc())
            .limit(3)
        )
    )

    perf_5 = _performance_summary_for_horizon(db, 5)
    perf_10 = _performance_summary_for_horizon(db, 10)
    perf_20 = _performance_summary_for_horizon(db, 20)

    cal_metrics = calibration_metrics(db)

    flow = [
        {"name": "유니버스 갱신", "detail": "자동 후보군", "state": "ok" if watchlist_count else "wait"},
        {"name": "데이터 수집", "detail": latest_run.status if latest_run else "기록 없음", "state": "ok" if latest_run and latest_run.status == "success" else "wait"},
        {"name": "후보 선별", "detail": f"{candidate_count}개", "state": "ok" if candidate_count else "wait"},
        {"name": "AI 의견서", "detail": f"{memo_count}개", "state": "ok" if memo_count else "wait"},
        {"name": "수학 검증", "detail": f"{math_attached_count}/{memo_count}", "state": "ok" if memo_count and math_attached_count == memo_count else "wait"},
        {"name": "승인 대기", "detail": f"{pending_count}개", "state": "warn" if pending_count else "wait"},
        {"name": "LEAN 내보내기", "detail": f"승인 {approved_count}개", "state": "ok" if approved_count else "wait"},
    ]
    quality = [
        {"name": "확률 보정", "value": f"{calibrated_count}/{memo_count}", "state": "ok" if calibrated_count else "blocked"},
        {"name": "양수 EV", "value": f"{positive_ev_count}/{memo_count}", "state": "ok" if positive_ev_count else "blocked"},
        {"name": "비용 스트레스", "value": f"{stress_pass_count}/{memo_count}", "state": "ok" if stress_pass_count else "blocked"},
        {"name": "10일 성과 표본", "value": str(perf_10.get("count", 0)), "state": "ok" if perf_10.get("count", 0) >= 30 else "warn"},
    ]

    settings = get_settings()
    next_run_label = (
        f"{settings.auto_collect_cron_hour:02d}:{settings.auto_collect_cron_minute:02d}"
        if getattr(settings, "auto_collect_cron_hour", None) is not None else "미설정"
    )

    return {
        "watchlist_count": watchlist_count,
        "candidate_count": candidate_count,
        "memo_count": memo_count,
        "pending_count": pending_count,
        "blocked_count": blocked_count,
        "approved_count": approved_count,
        "latest_run": latest_run,
        "latest_runs": latest_runs,
        "flow": flow,
        "quality": quality,
        "math_attached_count": math_attached_count,
        "training_count": training_count,
        "active_model": active_model,
        "ai_quality": ai_quality_summary(db),
        "regime_rows": regime_summary(db),
        "pending_memos": [
            {
                "id": m.id,
                "ticker": m.ticker,
                "score": m.total_score,
                "score_tier": _score_tier(m.total_score),
                "risk_status": m.risk_status,
                "valid_until": m.valid_until,
            }
            for m in pending_memos
        ],
        "perf_5": perf_5,
        "perf_10": perf_10,
        "perf_20": perf_20,
        "calibration": cal_metrics,
        "next_run_label": next_run_label,
        "pipeline_steps": run_state.PIPELINE_STEPS,
        "pipeline_history": run_state.latest_progress(),
    }


# ===== Routes =====
@router.get("/", response_class=HTMLResponse)
def root() -> RedirectResponse:
    return RedirectResponse("/dashboard", status_code=303)


@router.get("/login", response_class=HTMLResponse)
def login_form(request: Request):
    return templates.TemplateResponse(request, "login.html", {"error": ""})


@router.post("/login")
def login(request: Request, password: Annotated[str, Form()]):
    if not password_matches(password):
        return templates.TemplateResponse(request, "login.html", {"error": "비밀번호가 맞지 않습니다."})
    response = RedirectResponse("/dashboard", status_code=303)
    response.set_cookie(COOKIE_NAME, create_session_cookie(), httponly=True, samesite="lax")
    return response


@router.get("/logout")
def logout() -> RedirectResponse:
    response = RedirectResponse("/login", status_code=303)
    response.delete_cookie(COOKIE_NAME)
    return response


@router.get("/dashboard", response_class=HTMLResponse)
def dashboard(request: Request, db: Session = Depends(get_db)):
    if redirect := _guard(request):
        return redirect
    ctx = _base_context(request, db)
    ctx.update(_dashboard_context(db))
    return templates.TemplateResponse(request, "dashboard.html", ctx)


# ===== Uploads =====
@router.get("/uploads", response_class=HTMLResponse)
def uploads(request: Request, db: Session = Depends(get_db)):
    if redirect := _guard(request):
        return redirect
    items = list(db.scalars(select(Watchlist).order_by(Watchlist.ticker.asc())))
    event_count = db.query(EventFeature).count()
    recent_events = list(
        db.scalars(select(EventFeature).order_by(EventFeature.created_at.desc()).limit(5))
    )
    ctx = _base_context(request, db)
    ctx.update({
        "items": items,
        "event_count": event_count,
        "sp500_count": sum(1 for item in items if "sp500" in (item.universe_tags or "")),
        "nasdaq100_count": sum(1 for item in items if "nasdaq100" in (item.universe_tags or "")),
        "recent_events": recent_events,
        "message": "",
        "warnings": [],
    })
    return templates.TemplateResponse(request, "uploads.html", ctx)


@router.post("/watchlist")
def add_watchlist(
    request: Request,
    ticker: Annotated[str, Form()],
    name: Annotated[str, Form()] = "",
    sector: Annotated[str, Form()] = "",
    notes: Annotated[str, Form()] = "",
    db: Session = Depends(get_db),
):
    if redirect := _guard(request):
        return redirect
    ticker = ticker.strip().upper()
    existing = db.scalar(select(Watchlist).where(Watchlist.ticker == ticker))
    if existing:
        existing.name = name
        existing.sector = sector
        existing.notes = notes
        existing.is_active = True
        tags = {item.strip() for item in (existing.universe_tags or "").split(",") if item.strip()}
        tags.add("user_watchlist")
        existing.universe_tags = ",".join(sorted(tags))
        existing.auto_managed = False
    else:
        db.add(Watchlist(ticker=ticker, name=name, sector=sector, notes=notes))
    db.commit()
    return RedirectResponse("/uploads?flash=watchlist_added", status_code=303)


@router.post("/uploads/watchlist")
async def upload_watchlist(request: Request, file: UploadFile, db: Session = Depends(get_db)):
    if redirect := _guard(request):
        return redirect
    count = import_watchlist_csv(db, await file.read())
    items = list(db.scalars(select(Watchlist).order_by(Watchlist.ticker.asc())))
    ctx = _base_context(request, db)
    ctx.update({
        "items": items,
        "event_count": db.query(EventFeature).count(),
        "sp500_count": sum(1 for item in items if "sp500" in (item.universe_tags or "")),
        "nasdaq100_count": sum(1 for item in items if "nasdaq100" in (item.universe_tags or "")),
        "recent_events": list(db.scalars(select(EventFeature).order_by(EventFeature.created_at.desc()).limit(5))),
        "message": f"관심종목 {count}개 반영. 다음: 데이터 수집 →",
        "warnings": [],
    })
    return templates.TemplateResponse(request, "uploads.html", ctx)


@router.post("/uploads/prices")
async def upload_prices(request: Request, file: UploadFile, db: Session = Depends(get_db)):
    if redirect := _guard(request):
        return redirect
    inserted, warnings = import_price_csv(db, await file.read())
    items = list(db.scalars(select(Watchlist).order_by(Watchlist.ticker.asc())))
    ctx = _base_context(request, db)
    ctx.update({
        "items": items,
        "event_count": db.query(EventFeature).count(),
        "sp500_count": sum(1 for item in items if "sp500" in (item.universe_tags or "")),
        "nasdaq100_count": sum(1 for item in items if "nasdaq100" in (item.universe_tags or "")),
        "recent_events": list(db.scalars(select(EventFeature).order_by(EventFeature.created_at.desc()).limit(5))),
        "message": f"가격 {inserted}개 저장 / 경고 {len(warnings)}개",
        "warnings": warnings,
    })
    return templates.TemplateResponse(request, "uploads.html", ctx)


@router.post("/uploads/events")
async def upload_events(request: Request, file: UploadFile, db: Session = Depends(get_db)):
    if redirect := _guard(request):
        return redirect
    message = ""
    warnings: list[str] = []
    try:
        content = (await file.read()).decode("utf-8")
        inserted = ingest_event_csv(db, content)
        message = f"이벤트 {inserted}개 저장. AI 의견서 생성 시 자동 참조됩니다."
    except (ValueError, UnicodeDecodeError) as error:
        message = f"이벤트 업로드 실패: {error}"
        warnings = [str(error)]
    items = list(db.scalars(select(Watchlist).order_by(Watchlist.ticker.asc())))
    ctx = _base_context(request, db)
    ctx.update({
        "items": items,
        "event_count": db.query(EventFeature).count(),
        "sp500_count": sum(1 for item in items if "sp500" in (item.universe_tags or "")),
        "nasdaq100_count": sum(1 for item in items if "nasdaq100" in (item.universe_tags or "")),
        "recent_events": list(db.scalars(select(EventFeature).order_by(EventFeature.created_at.desc()).limit(5))),
        "message": message,
        "warnings": warnings,
    })
    return templates.TemplateResponse(request, "uploads.html", ctx)


# ===== Pipeline =====
def _collect_pipeline_sync() -> None:
    from app.db import SessionLocal

    db = SessionLocal()
    try:
        run_state.pipeline_started()
        run_state.step_started("universe", "자동 유니버스 갱신")
        try:
            asyncio.run(refresh_configured_universes(db))
            run_state.step_done("universe", "자동 유니버스 갱신 완료")
        except Exception as e:
            run_state.step_error("universe", str(e))
            run_state.pipeline_failed(str(e))
            return
        run_state.step_started("collect", "가격 데이터 수집 시작")
        try:
            asyncio.run(collect_prices(db))
            run_state.step_done("collect", "가격 수집 완료")
        except Exception as e:
            run_state.step_error("collect", str(e))
            run_state.pipeline_failed(str(e))
            return
        run_state.step_started("features", "지표 계산")
        try:
            calculate_all_features(db)
            run_state.step_done("features", "지표 계산 완료")
        except Exception as e:
            run_state.step_error("features", str(e))
            run_state.pipeline_failed(str(e))
            return
        run_state.step_started("candidates", "후보 선별")
        try:
            generate_candidates(db)
            run_state.step_done("candidates", "후보 선별 완료")
        except Exception as e:
            run_state.step_error("candidates", str(e))
            run_state.pipeline_failed(str(e))
            return
        run_state.step_started("training", "학습 표본 갱신")
        try:
            build_training_examples_for_horizons(db)
            run_state.step_done("training", "학습 표본 갱신 완료")
        except Exception as e:
            run_state.step_error("training", str(e))
            run_state.pipeline_failed(str(e))
            return
        run_state.step_started("probability", "확률 보정")
        try:
            for universe_name in ("user_watchlist", "sp500", "nasdaq100"):
                for horizon in DEFAULT_HORIZONS:
                    refresh_training_example_probabilities(db, universe_name=universe_name, horizon=horizon)
            run_state.step_done("probability", "확률 보정 완료")
        except Exception as e:
            run_state.step_error("probability", str(e))
            run_state.pipeline_failed(str(e))
            return
        run_state.step_started("memo", "AI 의견서 생성 (수동 단계)")
        run_state.step_done("memo", "후보 검토 → 의견서 생성")
        run_state.pipeline_done("파이프라인 완료. 후보 검토를 시작하세요.")
    finally:
        db.close()


@router.post("/run/collect")
def run_collect(request: Request, background_tasks: BackgroundTasks):
    if redirect := _guard(request):
        return redirect
    if run_state.is_running():
        return JSONResponse({"ok": False, "reason": "already_running"}, status_code=409)
    run_state.reset()
    background_tasks.add_task(_collect_pipeline_sync)
    if request.headers.get("accept", "").startswith("application/json"):
        return JSONResponse({"ok": True, "queued": True})
    return RedirectResponse("/dashboard?flash=collect_started", status_code=303)


@router.post("/universe/refresh")
async def refresh_universe(
    request: Request,
    source: Annotated[str, Form()],
    db: Session = Depends(get_db),
):
    if redirect := _guard(request):
        return redirect
    source = source.strip().lower()
    if source == "sp500":
        await refresh_sp500_universe(db)
    elif source in {"nasdaq100", "nasdaq_100"}:
        await refresh_nasdaq100_universe(db)
    else:
        await refresh_configured_universes(db)
    return RedirectResponse("/uploads?flash=universe_refreshed", status_code=303)


@router.get("/api/run/stream")
async def run_stream(request: Request):
    if redirect := _guard(request):
        return Response(status_code=401)
    return StreamingResponse(run_state.event_stream(), media_type="text/event-stream")


@router.get("/api/run/status")
def run_status(request: Request):
    if redirect := _guard(request):
        return Response(status_code=401)
    return {"running": run_state.is_running(), "history": run_state.latest_progress()}


@router.get("/api/scheduler/status")
def scheduler_status(request: Request, db: Session = Depends(get_db)):
    if redirect := _guard(request):
        return Response(status_code=401)
    settings = get_settings()
    next_label = (
        f"{settings.auto_collect_cron_hour:02d}:{settings.auto_collect_cron_minute:02d}"
        if getattr(settings, "auto_collect_cron_hour", None) is not None else None
    )
    last = db.scalar(select(DataRun).order_by(DataRun.started_at.desc()))
    return {
        "scheduler_on": _scheduler_on(db),
        "next_run_at": next_label,
        "last_run": last.status if last else None,
    }


# ===== Candidates =====
@router.get("/candidates", response_class=HTMLResponse)
def candidates(
    request: Request,
    sort: str = Query("date", pattern="^(date|score|risk)$"),
    db: Session = Depends(get_db),
):
    if redirect := _guard(request):
        return redirect
    query = select(Candidate)
    if sort == "score":
        query = query.order_by(Candidate.baseline_score.desc())
    elif sort == "risk":
        query = query.order_by(Candidate.risk_status.asc(), Candidate.created_at.desc())
    else:
        query = query.order_by(Candidate.created_at.desc())
    items = list(db.scalars(query))
    cards = []
    for c in items:
        latest_memo = db.scalar(
            select(InvestmentMemo)
            .where(InvestmentMemo.candidate_id == c.id)
            .order_by(InvestmentMemo.created_at.desc())
        )
        cards.append({
            "candidate": c,
            "latest_memo": latest_memo,
            "score_tier": _score_tier(c.baseline_score),
        })

    diagnose = None
    if not cards:
        watch = db.query(Watchlist).count()
        bars = db.query(PriceBar).count()
        if watch == 0:
            diagnose = ("관심종목이 없음", "데이터 화면에서 관심종목부터 추가하세요.", "/uploads")
        elif bars == 0:
            diagnose = ("가격 데이터 없음", "대시보드에서 데이터 수집을 실행하세요.", "/dashboard")
        else:
            diagnose = ("후보 조건 미충족", "데이터는 있으나 후보 조건을 통과한 종목이 없습니다. 더 많은 종목 또는 더 긴 기간이 필요합니다.", "/uploads")

    ctx = _base_context(request, db)
    ctx.update({
        "cards": cards,
        "sort": sort,
        "diagnose": diagnose,
    })
    return templates.TemplateResponse(request, "candidates.html", ctx)


@router.post("/candidates/{candidate_id}/memo")
async def create_memo(request: Request, candidate_id: int, db: Session = Depends(get_db)):
    if redirect := _guard(request):
        return redirect
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        if request.headers.get("accept", "").startswith("application/json"):
            return JSONResponse({"ok": False, "error": "candidate_not_found"}, status_code=404)
        return RedirectResponse("/candidates", status_code=303)
    try:
        memo = await generate_memo_for_candidate(db, candidate)
    except Exception as e:
        if request.headers.get("accept", "").startswith("application/json"):
            return JSONResponse({"ok": False, "error": str(e)}, status_code=500)
        return RedirectResponse("/candidates?flash=memo_failed", status_code=303)
    if request.headers.get("accept", "").startswith("application/json"):
        return {"ok": True, "memo_id": memo.id}
    return RedirectResponse(f"/memos/{memo.id}", status_code=303)


# ===== Memo =====
def _memo_context(memo: InvestmentMemo, db: Session) -> dict:
    if not memo:
        return {"memo": None}
    source = _json_dict(memo.source_summary_json)
    math_data = source.get("math") or {}
    learning = source.get("learning") or {}
    cost_sensitivity = math_data.get("cost_sensitivity") or []
    approvals = list(
        db.scalars(
            select(ApprovalRecord)
            .where(ApprovalRecord.memo_id == memo.id)
            .order_by(ApprovalRecord.decided_at.desc())
        )
    )
    providers = _json_raw_list(memo.raw_outputs_json)
    score_axes = [
        {"label": "가격추세", "value": memo.score_price_trend, "max": 20},
        {"label": "실적", "value": memo.score_fundamental, "max": 20},
        {"label": "뉴스", "value": memo.score_news_event, "max": 15},
        {"label": "수급", "value": memo.score_flow_volume, "max": 15},
        {"label": "위험", "value": memo.score_risk, "max": 10},
        {"label": "손익비", "value": memo.score_reward_risk, "max": 20},
    ]
    return {
        "memo": memo,
        "key_reasons": _json_list(memo.key_reasons_json),
        "counter_reasons": _json_list(memo.counter_reasons_json),
        "risk_messages": _json_list(memo.risk_messages_json),
        "do_not_trade": _json_list(memo.do_not_trade_if_json),
        "model_stack": _json_raw_list(memo.model_stack_json),
        "math": math_data,
        "learning": learning,
        "cost_sensitivity": cost_sensitivity,
        "approvals": approvals,
        "providers": providers,
        "score_axes": score_axes,
        "risk_tier": _risk_tier(memo),
    }


@router.get("/memos/{memo_id}", response_class=HTMLResponse)
def memo_detail(request: Request, memo_id: int, db: Session = Depends(get_db)):
    if redirect := _guard(request):
        return redirect
    memo = db.get(InvestmentMemo, memo_id)
    ctx = _base_context(request, db)
    ctx.update(_memo_context(memo, db))
    return templates.TemplateResponse(request, "memo_detail.html", ctx)


@router.post("/memos/{memo_id}/decision")
def decide_memo(
    request: Request,
    memo_id: int,
    decision: Annotated[str, Form()],
    db: Session = Depends(get_db),
):
    if redirect := _guard(request):
        return redirect
    memo = db.get(InvestmentMemo, memo_id)
    if memo and decision in {"approved", "rejected"}:
        if decision == "approved" and memo.risk_status == "blocked":
            return RedirectResponse(f"/memos/{memo_id}?flash=blocked", status_code=303)
        memo.approval_status = decision
        db.add(ApprovalRecord(memo_id=memo.id, decision=decision, channel="web"))
        db.commit()
    return RedirectResponse(f"/memos/{memo_id}?flash={decision}", status_code=303)


@router.post("/memos/{memo_id}/telegram")
async def send_telegram(request: Request, memo_id: int, db: Session = Depends(get_db)):
    if redirect := _guard(request):
        return redirect
    memo = db.get(InvestmentMemo, memo_id)
    sent = False
    if memo:
        sent = await send_memo(memo)
    return RedirectResponse(
        f"/memos/{memo_id}?flash={'telegram_sent' if sent else 'telegram_failed'}",
        status_code=303,
    )


@router.post("/telegram/webhook")
async def telegram_webhook(payload: dict, db: Session = Depends(get_db)):
    callback = payload.get("callback_query") or {}
    message = callback.get("message") or {}
    chat = message.get("chat") or {}
    data = callback.get("data") or ""
    result = handle_callback(db, str(chat.get("id", "")), data)
    return {"ok": True, "result": result}


@router.post("/run/performance")
def run_performance(request: Request, db: Session = Depends(get_db)):
    if redirect := _guard(request):
        return redirect
    update_performance_snapshots(db)
    return RedirectResponse("/dashboard?flash=perf_updated", status_code=303)


# ===== Operations =====
@router.get("/operations", response_class=HTMLResponse)
def operations(request: Request, db: Session = Depends(get_db)):
    if redirect := _guard(request):
        return redirect

    settings = get_settings()
    active_model = db.scalar(
        select(ModelVersion)
        .where(ModelVersion.status == "paper_active")
        .order_by(ModelVersion.trained_at.desc())
    )
    active_metrics = _json_dict(active_model.validation_summary_json) if active_model else {}
    candidate_models = list(
        db.scalars(
            select(ModelVersion)
            .where(ModelVersion.status == "candidate")
            .order_by(ModelVersion.trained_at.desc())
            .limit(20)
        )
    )
    learning_notes = list(
        db.scalars(select(LearningNote).order_by(LearningNote.created_at.desc()).limit(20))
    )
    latest_runs = list(
        db.scalars(select(DataRun).order_by(DataRun.started_at.desc()).limit(5))
    )

    telegram_connected = bool(
        getattr(settings, "telegram_bot_token", None) and getattr(settings, "telegram_allowed_chat_id", None)
    )
    public_base = getattr(settings, "public_base_url", "") or ""
    webhook_url = (public_base.rstrip("/") + "/telegram/webhook") if public_base else "/telegram/webhook"

    next_label = (
        f"{settings.auto_collect_cron_hour:02d}:{settings.auto_collect_cron_minute:02d}"
        if getattr(settings, "auto_collect_cron_hour", None) is not None else "미설정"
    )

    ctx = _base_context(request, db)
    ctx.update({
        "active_model": active_model,
        "active_metrics": active_metrics,
        "candidate_models": [
            {"model": m, "metrics": _json_dict(m.validation_summary_json)}
            for m in candidate_models
        ],
        "learning_notes": learning_notes,
        "latest_runs": latest_runs,
        "telegram_connected": telegram_connected,
        "webhook_url": webhook_url,
        "next_run_label": next_label,
    })
    return templates.TemplateResponse(request, "operations.html", ctx)


@router.post("/models/{model_id}/promote")
def model_promote(request: Request, model_id: int, db: Session = Depends(get_db)):
    if redirect := _guard(request):
        return redirect
    try:
        promote_model(db, model_id, user_approved=True)
        return RedirectResponse("/operations?flash=model_promoted", status_code=303)
    except ValueError:
        return RedirectResponse("/operations?flash=promote_failed", status_code=303)


# ===== Exports =====
@router.get("/exports", response_class=HTMLResponse)
def exports_page(request: Request, db: Session = Depends(get_db)):
    if redirect := _guard(request):
        return redirect
    approved = list(
        db.scalars(
            select(InvestmentMemo)
            .where(InvestmentMemo.approval_status == "approved")
            .order_by(InvestmentMemo.as_of_date.desc())
        )
    )
    avg_score = sum(m.total_score for m in approved) / len(approved) if approved else 0.0
    avg_weight = sum(m.max_weight for m in approved) / len(approved) if approved else 0.0
    preview_rows = []
    if approved:
        try:
            csv_text = export_lean_signals(db)
            reader = csv.reader(io.StringIO(csv_text))
            preview_rows = list(reader)[:6]
        except Exception:
            preview_rows = []
    ctx = _base_context(request, db)
    ctx.update({
        "approved": approved,
        "approved_count": len(approved),
        "avg_score": avg_score,
        "avg_weight": avg_weight,
        "preview_rows": preview_rows,
    })
    return templates.TemplateResponse(request, "exports.html", ctx)


@router.get("/exports/lean.csv")
def lean_csv(request: Request, db: Session = Depends(get_db)):
    if redirect := _guard(request):
        return redirect
    csv_text = export_lean_signals(db)
    return Response(
        csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=lean_signals.csv"},
    )
