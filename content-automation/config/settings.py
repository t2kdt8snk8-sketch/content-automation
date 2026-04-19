from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # LLM proxy routing — points to free-claude-code proxy
    llm_base_url: str = Field(default="http://localhost:8082", alias="LLM_BASE_URL")
    # Proxy forwards the key; set "dummy-proxied" locally, real key on Railway if direct
    anthropic_api_key: str = Field(default="dummy-proxied", alias="ANTHROPIC_API_KEY")

    # Model identifiers — proxy maps these to the actual backend models
    model_opus: str = Field(default="claude-opus-4-6", alias="MODEL_OPUS")
    model_sonnet: str = Field(default="claude-sonnet-4-6", alias="MODEL_SONNET")
    model_haiku: str = Field(default="claude-haiku-4-5-20251001", alias="MODEL_HAIKU")

    # Gemini — 콘텐츠 제작 전용
    gemini_api_key: str | None = Field(default=None, alias="GEMINI_API_KEY")
    model_production: str = Field(default="gemini-3.1-pro-preview", alias="MODEL_PRODUCTION")
    model_production_fast: str = Field(default="gemini-3.1-flash-lite-preview", alias="MODEL_PRODUCTION_FAST")

    # External research sources
    news_api_key: str | None = Field(default=None, alias="NEWS_API_KEY")
    youtube_data_api_key: str | None = Field(
        default=None, alias="YOUTUBE_DATA_API_KEY"
    )
    reddit_client_id: str | None = Field(default=None, alias="REDDIT_CLIENT_ID")
    reddit_client_secret: str | None = Field(
        default=None, alias="REDDIT_CLIENT_SECRET"
    )

    # Telegram (없으면 텔레그램 봇 비활성화, 웹 UI만 실행)
    telegram_bot_token: str | None = Field(default=None, alias="TELEGRAM_BOT_TOKEN")
    allowed_telegram_user_id: str | None = Field(
        default=None, alias="ALLOWED_TELEGRAM_USER_ID"
    )

    # Web UI
    web_password: str = Field(default="changeme", alias="WEB_PASSWORD")
    web_port: int = Field(default=8000, alias="PORT")  # Railway가 PORT를 자동 주입

    # Storage
    outputs_dir: str = Field(default="outputs", alias="OUTPUTS_DIR")
    scan_categories: str = Field(
        default="neo-soul,k-hip-hop,indie pop,jazz,lifestyle trends",
        alias="SCAN_CATEGORIES",
    )
    scan_interval_hours: int = Field(default=6, alias="SCAN_INTERVAL_HOURS")
    scan_interval_minutes: int | None = Field(
        default=None, alias="SCAN_INTERVAL_MINUTES"
    )

    # 자율 리서치 누적 루프 (research_loop)
    research_interval_minutes: int = Field(default=30, alias="RESEARCH_INTERVAL_MINUTES")

    # 전략 분석 루프 (strategy_loop)
    strategy_interval_minutes: int = Field(default=60, alias="STRATEGY_INTERVAL_MINUTES")
    strategy_min_new_items: int = Field(default=3, alias="STRATEGY_MIN_NEW_ITEMS")

    # Logging
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    model_config = SettingsConfigDict(
        env_file=(".env",),
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
