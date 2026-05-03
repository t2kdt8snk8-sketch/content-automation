from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Watchlist(Base):
    __tablename__ = "watchlist"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticker: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    sector: Mapped[str] = mapped_column(String(80), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    universe_tags: Mapped[str] = mapped_column(Text, default="user_watchlist")
    auto_managed: Mapped[bool] = mapped_column(Boolean, default=False)
    universe_updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PriceBar(Base):
    __tablename__ = "price_bars"
    __table_args__ = (UniqueConstraint("ticker", "date", "source", name="uq_price_ticker_date_source"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticker: Mapped[str] = mapped_column(String(20), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    open: Mapped[float] = mapped_column(Float)
    high: Mapped[float] = mapped_column(Float)
    low: Mapped[float] = mapped_column(Float)
    close: Mapped[float] = mapped_column(Float)
    volume: Mapped[float] = mapped_column(Float)
    adjusted_close: Mapped[float] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(80), default="csv")
    ingested_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DataRun(Base):
    __tablename__ = "data_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_type: Mapped[str] = mapped_column(String(30))
    source: Mapped[str] = mapped_column(String(80))
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="running")
    message: Mapped[str] = mapped_column(Text, default="")
    file_hash: Mapped[str] = mapped_column(String(128), default="")


class Feature(Base):
    __tablename__ = "features"
    __table_args__ = (UniqueConstraint("ticker", "as_of_date", name="uq_feature_ticker_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticker: Mapped[str] = mapped_column(String(20), index=True)
    as_of_date: Mapped[date] = mapped_column(Date, index=True)
    return_1d: Mapped[float] = mapped_column(Float, default=0)
    return_5d: Mapped[float] = mapped_column(Float, default=0)
    return_20d: Mapped[float] = mapped_column(Float, default=0)
    return_60d: Mapped[float] = mapped_column(Float, default=0)
    volatility_20d: Mapped[float] = mapped_column(Float, default=0)
    volume_ratio_20d: Mapped[float] = mapped_column(Float, default=0)
    relative_strength_spy: Mapped[float] = mapped_column(Float, default=0)
    relative_strength_qqq: Mapped[float] = mapped_column(Float, default=0)
    near_high_60d: Mapped[float] = mapped_column(Float, default=0)
    near_low_60d: Mapped[float] = mapped_column(Float, default=0)
    spy_return_20d: Mapped[float] = mapped_column(Float, default=0)
    qqq_return_20d: Mapped[float] = mapped_column(Float, default=0)
    spy_volatility_20d: Mapped[float] = mapped_column(Float, default=0)
    qqq_volatility_20d: Mapped[float] = mapped_column(Float, default=0)
    market_risk_on: Mapped[float] = mapped_column(Float, default=0)


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticker: Mapped[str] = mapped_column(String(20), index=True)
    as_of_date: Mapped[date] = mapped_column(Date, index=True)
    baseline_score: Mapped[float] = mapped_column(Float, default=0)
    candidate_reason: Mapped[str] = mapped_column(Text, default="")
    risk_status: Mapped[str] = mapped_column(String(30), default="ok")
    universe_name: Mapped[str] = mapped_column(String(80), default="user_watchlist")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    memos: Mapped[list["InvestmentMemo"]] = relationship(back_populates="candidate")


class InvestmentMemo(Base):
    __tablename__ = "investment_memos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    candidate_id: Mapped[int | None] = mapped_column(ForeignKey("candidates.id"), nullable=True)
    ticker: Mapped[str] = mapped_column(String(20), index=True)
    as_of_date: Mapped[date] = mapped_column(Date, index=True)
    recommendation: Mapped[str] = mapped_column(String(20))
    confidence: Mapped[float] = mapped_column(Float)
    total_score: Mapped[float] = mapped_column(Float)
    score_price_trend: Mapped[float] = mapped_column(Float, default=0)
    score_fundamental: Mapped[float] = mapped_column(Float, default=0)
    score_news_event: Mapped[float] = mapped_column(Float, default=0)
    score_flow_volume: Mapped[float] = mapped_column(Float, default=0)
    score_risk: Mapped[float] = mapped_column(Float, default=0)
    score_reward_risk: Mapped[float] = mapped_column(Float, default=0)
    entry_price: Mapped[float] = mapped_column(Float)
    stop_price: Mapped[float] = mapped_column(Float)
    review_price: Mapped[float] = mapped_column(Float)
    max_weight: Mapped[float] = mapped_column(Float)
    holding_period: Mapped[str] = mapped_column(String(80), default="")
    bull_case: Mapped[str] = mapped_column(Text, default="")
    bear_case: Mapped[str] = mapped_column(Text, default="")
    key_reasons_json: Mapped[str] = mapped_column(Text, default="[]")
    counter_reasons_json: Mapped[str] = mapped_column(Text, default="[]")
    do_not_trade_if_json: Mapped[str] = mapped_column(Text, default="[]")
    model_stack_json: Mapped[str] = mapped_column(Text, default="[]")
    prompt_version: Mapped[str] = mapped_column(String(40), default="v1")
    source_summary_json: Mapped[str] = mapped_column(Text, default="{}")
    raw_outputs_json: Mapped[str] = mapped_column(Text, default="{}")
    approval_status: Mapped[str] = mapped_column(String(30), default="pending")
    risk_status: Mapped[str] = mapped_column(String(30), default="ok")
    decision_mode: Mapped[str] = mapped_column(String(30), default="paper_only")
    risk_messages_json: Mapped[str] = mapped_column(Text, default="[]")
    valid_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    max_entry_drift_pct: Mapped[float] = mapped_column(Float, default=0.015)
    invalidated_by_event: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    candidate: Mapped[Candidate | None] = relationship(back_populates="memos")
    approvals: Mapped[list["ApprovalRecord"]] = relationship(back_populates="memo")


class ApprovalRecord(Base):
    __tablename__ = "approval_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    memo_id: Mapped[int] = mapped_column(ForeignKey("investment_memos.id"), index=True)
    decision: Mapped[str] = mapped_column(String(30))
    channel: Mapped[str] = mapped_column(String(30))
    decided_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    notes: Mapped[str] = mapped_column(Text, default="")
    memo: Mapped[InvestmentMemo] = relationship(back_populates="approvals")


class PerformanceSnapshot(Base):
    __tablename__ = "performance_snapshots"
    __table_args__ = (UniqueConstraint("memo_id", "horizon_days", name="uq_performance_memo_horizon"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    memo_id: Mapped[int] = mapped_column(ForeignKey("investment_memos.id"), index=True)
    ticker: Mapped[str] = mapped_column(String(20), index=True)
    horizon_days: Mapped[int] = mapped_column(Integer)
    entry_close: Mapped[float | None] = mapped_column(Float, nullable=True)
    future_close: Mapped[float | None] = mapped_column(Float, nullable=True)
    return_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    paper_return_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    conservative_return_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    cost_assumption_pct: Mapped[float] = mapped_column(Float, default=0.005)
    benchmark_return_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    excess_return_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    market_regime: Mapped[str] = mapped_column(String(40), default="unknown")
    universe_name: Mapped[str] = mapped_column(String(80), default="user_watchlist")
    status: Mapped[str] = mapped_column(String(30), default="pending")


class TrainingExample(Base):
    __tablename__ = "training_examples"
    __table_args__ = (
        UniqueConstraint("ticker", "as_of_date", "horizon_days", "universe_name", name="uq_training_ticker_date_horizon_universe"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticker: Mapped[str] = mapped_column(String(20), index=True)
    as_of_date: Mapped[date] = mapped_column(Date, index=True)
    feature_json: Mapped[str] = mapped_column(Text)
    label: Mapped[int] = mapped_column(Integer)
    horizon_days: Mapped[int] = mapped_column(Integer, default=10)
    benchmark_ticker: Mapped[str] = mapped_column(String(20), default="SPY")
    universe_name: Mapped[str] = mapped_column(String(80), default="user_watchlist")
    p_raw: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class EventFeature(Base):
    __tablename__ = "event_features"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticker: Mapped[str] = mapped_column(String(20), index=True)
    event_date: Mapped[date] = mapped_column(Date, index=True)
    available_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    usable_from: Mapped[datetime] = mapped_column(DateTime, index=True)
    event_type: Mapped[str] = mapped_column(String(80), default="")
    sentiment_score: Mapped[float] = mapped_column(Float, default=0)
    uncertainty_score: Mapped[float] = mapped_column(Float, default=0)
    guidance_score: Mapped[float] = mapped_column(Float, default=0)
    risk_score: Mapped[float] = mapped_column(Float, default=0)
    summary: Mapped[str] = mapped_column(Text, default="")
    source_url: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    model_name: Mapped[str] = mapped_column(String(80), index=True)
    model_version: Mapped[str] = mapped_column(String(80), index=True)
    trained_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    training_sample_count: Mapped[int] = mapped_column(Integer, default=0)
    validation_summary_json: Mapped[str] = mapped_column(Text, default="{}")
    status: Mapped[str] = mapped_column(String(30), default="candidate")
    approved_by_user: Mapped[bool] = mapped_column(Boolean, default=False)


class LearningNote(Base):
    __tablename__ = "learning_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    memo_id: Mapped[int | None] = mapped_column(ForeignKey("investment_memos.id"), nullable=True, index=True)
    ticker: Mapped[str] = mapped_column(String(20), default="", index=True)
    failure_reason: Mapped[str] = mapped_column(Text, default="")
    confidence_tier: Mapped[str] = mapped_column(String(40), default="insufficient_data")
    evidence: Mapped[str] = mapped_column(Text, default="")
    suggested_rule_change: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
