from __future__ import annotations

import os
from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
db_dir = os.path.dirname(settings.sqlite_path)
if db_dir:
    os.makedirs(db_dir, exist_ok=True)

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db() -> None:
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _ensure_sqlite_columns()


def _ensure_sqlite_columns() -> None:
    if engine.dialect.name != "sqlite":
        return
    additions = {
        "watchlist": {
            "universe_tags": "TEXT DEFAULT 'user_watchlist'",
            "auto_managed": "BOOLEAN DEFAULT 0",
            "universe_updated_at": "DATETIME",
        },
        "features": {
            "spy_return_20d": "FLOAT DEFAULT 0",
            "qqq_return_20d": "FLOAT DEFAULT 0",
            "spy_volatility_20d": "FLOAT DEFAULT 0",
            "qqq_volatility_20d": "FLOAT DEFAULT 0",
            "market_risk_on": "FLOAT DEFAULT 0",
        },
        "candidates": {
            "universe_name": "VARCHAR(80) DEFAULT 'user_watchlist'",
        },
        "investment_memos": {
            "decision_mode": "VARCHAR(30) DEFAULT 'paper_only'",
            "valid_until": "DATETIME",
            "max_entry_drift_pct": "FLOAT DEFAULT 0.015",
            "invalidated_by_event": "BOOLEAN DEFAULT 1",
        },
        "performance_snapshots": {
            "paper_return_pct": "FLOAT",
            "conservative_return_pct": "FLOAT",
            "cost_assumption_pct": "FLOAT DEFAULT 0.005",
            "market_regime": "VARCHAR(40) DEFAULT 'unknown'",
            "universe_name": "VARCHAR(80) DEFAULT 'user_watchlist'",
        },
    }
    inspector = inspect(engine)
    with engine.begin() as connection:
        for table_name, columns in additions.items():
            if table_name not in inspector.get_table_names():
                continue
            existing = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, column_type in columns.items():
                if column_name not in existing:
                    connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"))


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
