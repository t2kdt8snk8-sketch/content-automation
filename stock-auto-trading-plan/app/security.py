from __future__ import annotations

import hashlib
import hmac
import time

from fastapi import Request
from fastapi.responses import RedirectResponse

from app.config import get_settings

COOKIE_NAME = "stock_assistant_session"


def _sign(value: str) -> str:
    secret = get_settings().app_secret.encode()
    return hmac.new(secret, value.encode(), hashlib.sha256).hexdigest()


def create_session_cookie() -> str:
    payload = f"admin:{int(time.time())}"
    return f"{payload}.{_sign(payload)}"


def is_valid_session(cookie_value: str | None) -> bool:
    if not cookie_value or "." not in cookie_value:
        return False
    payload, signature = cookie_value.rsplit(".", 1)
    return hmac.compare_digest(signature, _sign(payload))


def require_login(request: Request) -> RedirectResponse | None:
    if is_valid_session(request.cookies.get(COOKIE_NAME)):
        return None
    return RedirectResponse("/login", status_code=303)


def password_matches(password: str) -> bool:
    expected = get_settings().admin_password
    return hmac.compare_digest(password, expected)

