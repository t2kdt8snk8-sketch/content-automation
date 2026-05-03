from __future__ import annotations

import os
from dataclasses import dataclass


def _bool_env(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    app_secret: str
    admin_password: str
    sqlite_path: str
    public_base_url: str
    telegram_bot_token: str | None
    telegram_allowed_chat_id: str | None
    openai_api_key: str | None
    anthropic_api_key: str | None
    gemini_api_key: str | None
    openai_model: str
    anthropic_model: str
    gemini_model: str
    scheduler_enabled: bool
    auto_collect_cron_hour: int
    auto_collect_cron_minute: int
    price_history_days: int
    auto_universe_sources: str
    candidate_min_score: float
    candidate_min_dollar_volume: float
    collector_request_delay_ms: int
    collector_max_retries: int
    auto_memo_top_n: int

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.sqlite_path}"


def get_settings() -> Settings:
    return Settings(
        app_secret=os.getenv("APP_SECRET", "dev-secret-change-me"),
        admin_password=os.getenv("ADMIN_PASSWORD", "admin"),
        sqlite_path=os.getenv("SQLITE_PATH", "./data/app.db"),
        public_base_url=os.getenv("PUBLIC_BASE_URL", "http://localhost:8000"),
        telegram_bot_token=os.getenv("TELEGRAM_BOT_TOKEN") or None,
        telegram_allowed_chat_id=os.getenv("TELEGRAM_ALLOWED_CHAT_ID") or None,
        openai_api_key=os.getenv("OPENAI_API_KEY") or None,
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY") or None,
        gemini_api_key=os.getenv("GEMINI_API_KEY") or None,
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
        anthropic_model=os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-latest"),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-1.5-flash"),
        scheduler_enabled=_bool_env("SCHEDULER_ENABLED", True),
        auto_collect_cron_hour=int(os.getenv("AUTO_COLLECT_CRON_HOUR", "7")),
        auto_collect_cron_minute=int(os.getenv("AUTO_COLLECT_CRON_MINUTE", "30")),
        price_history_days=int(os.getenv("PRICE_HISTORY_DAYS", "1825")),
        auto_universe_sources=os.getenv("AUTO_UNIVERSE_SOURCES", "user_watchlist,sp500,nasdaq100"),
        candidate_min_score=float(os.getenv("CANDIDATE_MIN_SCORE", "50")),
        candidate_min_dollar_volume=float(os.getenv("CANDIDATE_MIN_DOLLAR_VOLUME", "20000000")),
        collector_request_delay_ms=int(os.getenv("COLLECTOR_REQUEST_DELAY_MS", "300")),
        collector_max_retries=int(os.getenv("COLLECTOR_MAX_RETRIES", "3")),
        auto_memo_top_n=int(os.getenv("AUTO_MEMO_TOP_N", "5")),
    )
