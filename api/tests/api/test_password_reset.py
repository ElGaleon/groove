from datetime import timedelta

from sqlalchemy import func, select

from app.core.clock import utcnow
from app.models import PasswordReset, Session
from tests.api.test_household import join
from tests.conftest import PASSWORD, make_client

NEW = "a brand new password"


def member_id(owner, name):
    members = owner.get("/api/household").json()["members"]
    return next(m["id"] for m in members if m["display_name"] == name)


def make_link(owner, name="Bob"):
    r = owner.post(f"/api/household/members/{member_id(owner, name)}/password-reset")
    assert r.status_code == 201, r.text
    return r.json()["token"]


def test_a_member_creates_a_link_and_it_resets_the_password_once(owner, db):
    bob = join(owner)
    token = make_link(owner)

    check = make_client().get("/api/auth/password-reset/check", params={"token": token}).json()
    assert check == {"status": "valid", "display_name": "Bob"}

    browser = make_client()
    r = browser.post("/api/auth/password-reset", json={"token": token, "new_password": NEW})
    assert r.status_code == 200, r.text
    assert r.json()["email"] == "bob@example.com"
    assert browser.get("/api/auth/me").status_code == 200  # signed in on this device

    # the old password is gone, the new one works, Bob's other device is signed out
    assert (
        make_client()
        .post("/api/auth/login", json={"email": "bob@example.com", "password": PASSWORD})
        .status_code
        == 401
    )
    assert (
        make_client()
        .post("/api/auth/login", json={"email": "bob@example.com", "password": NEW})
        .status_code
        == 200
    )
    assert bob.get("/api/auth/me").status_code == 401

    # the link is single use
    again = make_client().post(
        "/api/auth/password-reset", json={"token": token, "new_password": NEW}
    )
    assert again.status_code == 403
    assert again.json()["code"] == "reset_invalid"
    assert (
        make_client()
        .get("/api/auth/password-reset/check", params={"token": token})
        .json()["status"]
        == "used"
    )
    assert db.scalar(select(func.count()).select_from(Session)) >= 1


def test_only_a_hash_is_stored(owner, db):
    join(owner)
    token = make_link(owner)
    stored = db.scalars(select(PasswordReset.token_hash)).all()
    assert len(stored) == 1 and token not in stored[0]


def test_a_member_cannot_reset_themselves_or_unknown_members(owner):
    own = member_id(owner, "Anna")
    refused = owner.post(f"/api/household/members/{own}/password-reset")
    assert refused.status_code == 403
    assert refused.json()["code"] == "reset_not_allowed"
    unknown = owner.post(
        "/api/household/members/00000000-0000-0000-0000-000000000000/password-reset"
    )
    assert unknown.status_code == 403


def test_creating_a_link_needs_a_session():
    r = make_client().post(
        "/api/household/members/00000000-0000-0000-0000-000000000000/password-reset"
    )
    assert r.status_code == 401


def test_a_newer_link_replaces_the_earlier_one(owner):
    join(owner)
    old = make_link(owner)
    new = make_link(owner)
    c = make_client()
    assert (
        c.get("/api/auth/password-reset/check", params={"token": old}).json()["status"] == "invalid"
    )
    assert (
        c.get("/api/auth/password-reset/check", params={"token": new}).json()["status"] == "valid"
    )
    refused = c.post("/api/auth/password-reset", json={"token": old, "new_password": NEW})
    assert refused.status_code == 403


def test_an_expired_link_cannot_be_used(owner, db):
    join(owner)
    token = make_link(owner)
    reset = db.scalar(select(PasswordReset))
    reset.expires_at = utcnow() - timedelta(minutes=1)
    db.commit()
    c = make_client()
    assert c.get("/api/auth/password-reset/check", params={"token": token}).json() == {
        "status": "expired",
        "display_name": None,
    }
    assert (
        c.post("/api/auth/password-reset", json={"token": token, "new_password": NEW}).status_code
        == 403
    )


def test_a_short_password_keeps_the_link_valid(owner):
    join(owner)
    token = make_link(owner)
    c = make_client()
    short = c.post("/api/auth/password-reset", json={"token": token, "new_password": "short"})
    assert short.status_code == 422
    assert short.json()["code"] == "password_too_short"
    assert (
        c.get("/api/auth/password-reset/check", params={"token": token}).json()["status"] == "valid"
    )
    assert (
        c.post("/api/auth/password-reset", json={"token": token, "new_password": NEW}).status_code
        == 200
    )


def test_an_unknown_token_is_invalid(client):
    assert client.get("/api/auth/password-reset/check", params={"token": "nope"}).json() == {
        "status": "invalid",
        "display_name": None,
    }
    r = client.post("/api/auth/password-reset", json={"token": "nope", "new_password": NEW})
    assert r.status_code == 403 and r.json()["code"] == "reset_invalid"
