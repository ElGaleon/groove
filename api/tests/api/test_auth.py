from datetime import timedelta

from sqlalchemy import select, update

from app.core.clock import utcnow
from app.models import Invite
from app.models import Session as DbSession
from tests.conftest import PASSWORD, make_client


def register(client, email="bob@example.com", name="Bob", **extra):
    body = {"email": email, "password": PASSWORD, "display_name": name, **extra}
    return client.post("/api/auth/register", json=body)


# --- 2.1 migrations -------------------------------------------------------------------------


def test_migrations_created_the_tables(db):
    from sqlalchemy import inspect

    tables = set(inspect(db.get_bind()).get_table_names())
    assert {"households", "users", "invites", "sessions", "login_attempts"} <= tables


# --- 2.2 first household and registration ---------------------------------------------------


def test_first_person_creates_the_household(client):
    response = register(client, "anna@example.com", "Anna", household_name="Famiglia Rossi")
    assert response.status_code == 201
    body = response.json()
    assert body["household"]["name"] == "Famiglia Rossi"
    assert client.get("/api/auth/me").json()["email"] == "anna@example.com"


def test_first_registration_needs_a_household_name(client):
    assert register(client, "anna@example.com", "Anna").status_code == 422


def test_registration_without_invitation_is_refused_once_a_household_exists(owner, new_client):
    other = new_client()
    response = register(other)
    assert response.status_code == 403
    assert other.get("/api/auth/me").status_code == 401


def test_registration_with_made_up_invitation_is_refused(owner, new_client):
    assert register(new_client(), invite_token="not-a-real-token").status_code == 403


def test_email_cannot_be_registered_twice(owner, new_client):
    token = owner.post("/api/invites").json()["token"]
    other = new_client()
    assert register(other, "ANNA@example.com", invite_token=token).status_code == 409


# --- 2.3 invites ----------------------------------------------------------------------------


def test_joining_with_a_valid_invite(owner, new_client):
    token = owner.post("/api/invites").json()["token"]
    bob = new_client()
    response = register(bob, invite_token=token)
    assert response.status_code == 201
    assert response.json()["household"]["name"] == "Famiglia Rossi"
    assert bob.get("/api/auth/me").status_code == 200


def test_invite_is_single_use(owner, new_client):
    token = owner.post("/api/invites").json()["token"]
    assert register(new_client(), "b@example.com", invite_token=token).status_code == 201
    second = register(new_client(), "c@example.com", invite_token=token)
    assert second.status_code == 403
    assert owner.get("/api/invites/check", params={"token": token}).json()["status"] == "used"


def test_expired_invite_is_refused(owner, new_client, db):
    created = owner.post("/api/invites").json()
    db.execute(update(Invite).values(expires_at=utcnow() - timedelta(minutes=1)))
    db.commit()
    assert register(new_client(), invite_token=created["token"]).status_code == 403
    assert (
        owner.get("/api/invites/check", params={"token": created["token"]}).json()["status"]
        == "expired"
    )


def test_invite_expires_after_seven_days(owner, db):
    created = owner.post("/api/invites").json()
    invite = db.scalar(select(Invite))
    lifetime = invite.expires_at - invite.created_at
    assert timedelta(days=6, hours=23) < lifetime <= timedelta(days=7, minutes=1)
    assert created["expires_at"]


def test_revoked_invite_stops_working_immediately(owner, new_client):
    created = owner.post("/api/invites").json()
    assert owner.delete(f"/api/invites/{created['id']}").status_code == 204
    assert register(new_client(), invite_token=created["token"]).status_code == 403
    assert (
        owner.get("/api/invites/check", params={"token": created["token"]}).json()["status"]
        == "revoked"
    )


def test_invite_check_is_public_and_hides_unknown_tokens(client, owner):
    token = owner.post("/api/invites").json()["token"]
    anonymous = make_client()
    ok = anonymous.get("/api/invites/check", params={"token": token}).json()
    assert ok == {"status": "valid", "household_name": "Famiglia Rossi"}
    unknown = anonymous.get("/api/invites/check", params={"token": "nope"}).json()
    assert unknown == {"status": "invalid", "household_name": None}


def test_only_the_hash_of_an_invite_token_is_stored(owner, db):
    token = owner.post("/api/invites").json()["token"]
    assert db.scalar(select(Invite.token_hash)) != token


# --- 2.4 sign-in ----------------------------------------------------------------------------


def test_successful_sign_in(owner, new_client):
    browser = new_client()
    response = browser.post(
        "/api/auth/login", json={"email": "ANNA@example.com", "password": PASSWORD}
    )
    assert response.status_code == 200
    assert browser.get("/api/auth/me").json()["display_name"] == "Anna"


def test_wrong_password_and_unknown_email_give_the_same_error(owner, new_client):
    wrong = new_client().post(
        "/api/auth/login", json={"email": "anna@example.com", "password": "x" * 12}
    )
    unknown = new_client().post(
        "/api/auth/login", json={"email": "nobody@example.com", "password": "x" * 12}
    )
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


def test_too_many_failures_lock_the_email_for_a_while(owner, new_client):
    browser = new_client()
    for _ in range(5):
        r = browser.post(
            "/api/auth/login", json={"email": "anna@example.com", "password": "bad-password-1"}
        )
        assert r.status_code == 401
    locked = browser.post(
        "/api/auth/login", json={"email": "anna@example.com", "password": PASSWORD}
    )
    assert locked.status_code == 429
    assert "Retry-After" in locked.headers


def test_failures_of_one_email_do_not_lock_another(owner, new_client, db):
    token = owner.post("/api/invites").json()["token"]
    register(new_client(), "bob@example.com", invite_token=token)
    browser = new_client()
    for _ in range(5):
        browser.post(
            "/api/auth/login", json={"email": "anna@example.com", "password": "bad-password-1"}
        )
    ok = browser.post("/api/auth/login", json={"email": "bob@example.com", "password": PASSWORD})
    assert ok.status_code == 200


def test_old_failures_do_not_count(owner, new_client, db):
    from app.models import LoginAttempt

    browser = new_client()
    for _ in range(5):
        browser.post(
            "/api/auth/login", json={"email": "anna@example.com", "password": "bad-password-1"}
        )
    db.execute(update(LoginAttempt).values(attempted_at=utcnow() - timedelta(minutes=11)))
    db.commit()
    ok = browser.post("/api/auth/login", json={"email": "anna@example.com", "password": PASSWORD})
    assert ok.status_code == 200


def test_short_password_is_rejected_with_the_minimum(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "a@example.com",
            "password": "short",
            "display_name": "A",
            "household_name": "F",
        },
    )
    assert response.status_code == 422
    assert "10" in response.json()["detail"]


def test_password_is_not_stored_in_clear(owner, db):
    from app.models import User

    stored = db.scalar(select(User.password_hash))
    assert PASSWORD not in stored and stored.startswith("$argon2id$")


def test_sign_out_ends_the_session(owner):
    assert owner.post("/api/auth/logout").status_code == 204
    assert owner.get("/api/auth/me").status_code == 401


# --- 2.5 session cookie, header, password change --------------------------------------------


def test_session_cookie_flags(client):
    response = register(client, "anna@example.com", "Anna", household_name="F")
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie and "path=/" in cookie


def test_cookie_is_secure_when_the_public_url_is_https(monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setenv("PUBLIC_BASE_URL", "https://vinili.example.org")
    get_settings.cache_clear()
    try:
        assert get_settings().cookie_secure is True
    finally:
        monkeypatch.delenv("PUBLIC_BASE_URL")
        get_settings.cache_clear()


def test_only_the_hash_of_the_session_token_is_stored(owner, db):
    token = owner.cookies.get("groove_session")
    assert token and db.scalar(select(DbSession.token_hash)) != token


def test_write_without_the_security_header_is_rejected(owner):
    from fastapi.testclient import TestClient

    from app.main import app

    bare = TestClient(app, cookies=dict(owner.cookies))  # same session, no custom header
    assert bare.post("/api/invites").status_code == 403
    assert bare.get("/api/auth/me").status_code == 200  # reads are not affected


def test_changing_password_signs_out_other_sessions(owner, new_client):
    other = new_client()
    other.post("/api/auth/login", json={"email": "anna@example.com", "password": PASSWORD})
    assert other.get("/api/auth/me").status_code == 200

    new = "a brand new password"
    done = owner.post(
        "/api/auth/password", json={"current_password": PASSWORD, "new_password": new}
    )
    assert done.status_code == 204
    assert other.get("/api/auth/me").status_code == 401  # other session ended
    assert owner.get("/api/auth/me").status_code == 200  # current one kept
    assert (
        new_client()
        .post("/api/auth/login", json={"email": "anna@example.com", "password": new})
        .status_code
        == 200
    )


def test_changing_password_needs_the_current_one(owner):
    r = owner.post(
        "/api/auth/password",
        json={"current_password": "wrong-password", "new_password": "a brand new password"},
    )
    assert r.status_code == 403


def test_new_password_must_respect_the_minimum(owner):
    r = owner.post(
        "/api/auth/password", json={"current_password": PASSWORD, "new_password": "short"}
    )
    assert r.status_code == 422


def test_expired_session_is_refused(owner, db):
    db.execute(update(DbSession).values(expires_at=utcnow() - timedelta(minutes=1)))
    db.commit()
    assert owner.get("/api/auth/me").status_code == 401


# --- 2.6 everything needs a member ----------------------------------------------------------


def test_anonymous_requests_get_no_data(owner):
    anonymous = make_client()
    assert anonymous.get("/api/auth/me").status_code == 401
    assert anonymous.get("/api/invites").status_code == 401
    assert anonymous.post("/api/invites").status_code == 401
    assert anonymous.delete("/api/invites/00000000-0000-0000-0000-000000000000").status_code == 401


def _depends_on(dependant, target) -> bool:
    return any(d.call is target or _depends_on(d, target) for d in dependant.dependencies)


PUBLIC_ROUTES = {
    ("GET", "/api/health"),
    ("POST", "/api/auth/register"),
    ("POST", "/api/auth/login"),
    ("POST", "/api/auth/logout"),
    ("GET", "/api/invites/check"),
    ("GET", "/api/auth/status"),
}


def test_every_route_requires_a_signed_in_member_unless_listed_as_public():
    """Guards routes added later (records, covers, Discogs, settings): a new endpoint that forgets
    the authentication dependency fails here until it is fixed or deliberately listed."""
    from fastapi.routing import APIRoute

    from app.api.deps import get_current_user
    from app.main import app

    open_routes = []
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        for method in route.methods - {"HEAD", "OPTIONS"}:
            if (method, route.path) in PUBLIC_ROUTES:
                continue
            if not _depends_on(route.dependant, get_current_user):
                open_routes.append((method, route.path))
    assert open_routes == []
