from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_login_page_renders():
    client = TestClient(app)
    response = client.get("/login")
    assert response.status_code == 200
    assert "사람 승인 후 LEAN" in response.text
    assert "관리 비밀번호" in response.text


def test_health_endpoint():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

