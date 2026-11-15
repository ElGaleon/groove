"""Limits that protect the server from cheap abuse, and the error code of the CSRF check."""

from datetime import timedelta

from fastapi.testclient import TestClient

from app.core.clock import utcnow
from app.core.config import get_settings
from app.main import app
from app.models import LoginAttempt, Session
from app.schemas.accounts import MAX_PASSWORD
from app.services import housekeeping


def test_missing_security_header_has_a_code(owner):
    bare = TestClient(app, cookies=dict(owner.cookies))
    r = bare.post("/api/invites")
    assert r.status_code == 403
    assert r.json()["code"] == "csrf_header_missing"


def test_overlong_password_is_refused_before_hashing(client):
    r = client.post(
        "/api/auth/login", json={"email": "anna@example.com", "password": "x" * (MAX_PASSWORD + 1)}
    )
    assert r.status_code == 422
    assert r.json()["field"] == "password"


def test_overlong_token_is_refused(client):
    assert client.get("/api/invites/check", params={"token": "t" * 500}).status_code == 422


def test_housekeeping_drops_only_expired_rows(owner, db):
    now = utcnow()
    user_id = db.query(Session).one().user_id
    db.add(Session(token_hash="old", user_id=user_id, expires_at=now - timedelta(minutes=1)))
    db.add(LoginAttempt(email="a@x.it", success=False, attempted_at=now - timedelta(days=2)))
    db.add(LoginAttempt(email="a@x.it", success=False, attempted_at=now))
    db.commit()

    counts = housekeeping.purge_expired(db, get_settings())

    assert counts["sessions"] == 1
    assert counts["login_attempts"] == 1
    assert db.query(Session).count() == 1  # the live session stays
    assert owner.get("/api/auth/me").status_code == 200
