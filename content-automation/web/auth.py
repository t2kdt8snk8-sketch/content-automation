from __future__ import annotations

import hmac
import json
import secrets
from pathlib import Path

from config.settings import get_settings

_TOKEN_FILE = Path(__file__).parent.parent / "outputs" / ".tokens.json"


def _load_tokens() -> set[str]:
    try:
        if _TOKEN_FILE.exists():
            return set(json.loads(_TOKEN_FILE.read_text()))
    except Exception:
        pass
    return set()


def _save_tokens(tokens: set[str]) -> None:
    try:
        _TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
        _TOKEN_FILE.write_text(json.dumps(list(tokens)))
    except Exception:
        pass


_valid_tokens: set[str] = _load_tokens()


def verify_password(password: str) -> bool:
    settings = get_settings()
    return hmac.compare_digest(password, settings.web_password)


def create_token() -> str:
    token = secrets.token_hex(32)
    _valid_tokens.add(token)
    _save_tokens(_valid_tokens)
    return token


def verify_token(token: str | None) -> bool:
    if not token:
        return False
    return token in _valid_tokens


def revoke_token(token: str) -> None:
    _valid_tokens.discard(token)
    _save_tokens(_valid_tokens)
