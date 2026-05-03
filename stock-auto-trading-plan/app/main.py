from __future__ import annotations

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.db import init_db
from app.scheduler import start_scheduler
from app.web.routes import router as web_router


def create_app() -> FastAPI:
    app = FastAPI(title="AI Stock Assistant")
    app.mount("/static", StaticFiles(directory="app/web/static"), name="static")
    app.include_router(web_router)

    @app.on_event("startup")
    def _startup() -> None:
        init_db()
        settings = get_settings()
        if settings.scheduler_enabled:
            start_scheduler()

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()

