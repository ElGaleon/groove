from sqlalchemy import select, text

from app.models import DiscogsConnection, DiscogsOAuthPending
from tests.conftest import PASSWORD


def start(owner):
    r = owner.post("/api/discogs/connect")
    assert r.status_code == 200, r.text
    return r.json()["authorize_url"]


def test_status_before_connecting(owner):
    r = owner.get("/api/discogs/status")
    assert r.json() == {"configured": True, "connected": False, "status": None, "username": None}


def test_connect_success(owner, discogs, db):
    url = start(owner)
    assert url.endswith("/oauth/authorize?oauth_token=REQTOKEN")
    r = owner.get(
        "/api/discogs/callback?oauth_token=REQTOKEN&oauth_verifier=V", follow_redirects=False
    )
    assert r.status_code == 303 and r.headers["location"] == "/settings?discogs=connected"
    s = owner.get("/api/discogs/status").json()
    assert s["connected"] and s["username"] == "anna_d" and s["status"] == "active"
    conn = db.scalar(select(DiscogsConnection))
    assert "ACCESSTOK" not in conn.token_encrypted
    assert db.scalar(select(DiscogsOAuthPending)) is None


def test_cancelled_authorisation(owner, discogs):
    start(owner)
    r = owner.get("/api/discogs/callback?oauth_token=REQTOKEN", follow_redirects=False)
    assert r.headers["location"] == "/settings?discogs=cancelled"
    assert owner.get("/api/discogs/status").json()["connected"] is False
    # and the member can retry
    start(owner)


def test_failed_exchange(owner, discogs):
    start(owner)
    discogs.access_ok = False
    r = owner.get(
        "/api/discogs/callback?oauth_token=REQTOKEN&oauth_verifier=V", follow_redirects=False
    )
    assert r.headers["location"] == "/settings?discogs=failed"
    assert owner.get("/api/discogs/status").json()["connected"] is False


def test_unknown_token_fails(owner, discogs):
    r = owner.get("/api/discogs/callback?oauth_token=NOPE&oauth_verifier=V", follow_redirects=False)
    assert r.headers["location"] == "/settings?discogs=failed"


def test_another_member_cannot_complete_my_authorisation(owner, discogs, new_client):
    start(owner)
    invite = owner.post("/api/invites").json()
    bob = new_client()
    token = invite["url"].rsplit("/", 1)[1] if "url" in invite else invite["token"]
    r = bob.post(
        "/api/auth/register",
        json={
            "email": "bob@example.com",
            "password": PASSWORD,
            "display_name": "Bob",
            "invite_token": token,
        },
    )
    assert r.status_code == 201, r.text
    r = bob.get(
        "/api/discogs/callback?oauth_token=REQTOKEN&oauth_verifier=V", follow_redirects=False
    )
    assert r.headers["location"] == "/settings?discogs=failed"


def test_connections_are_separate(owner, discogs, new_client):
    start(owner)
    owner.get("/api/discogs/callback?oauth_token=REQTOKEN&oauth_verifier=V")
    invite = owner.post("/api/invites").json()
    token = invite["url"].rsplit("/", 1)[1] if "url" in invite else invite["token"]
    bob = new_client()
    bob.post(
        "/api/auth/register",
        json={
            "email": "bob@example.com",
            "password": PASSWORD,
            "display_name": "Bob",
            "invite_token": token,
        },
    )
    assert bob.get("/api/discogs/status").json()["connected"] is False
    assert owner.get("/api/discogs/status").json()["connected"] is True


def test_disconnect_removes_tokens_and_keeps_records(owner, discogs, db):
    start(owner)
    owner.get("/api/discogs/callback?oauth_token=REQTOKEN&oauth_verifier=V")
    owner.post("/api/records", json={"title": "T", "artist": "A"})
    assert owner.delete("/api/discogs/connection").status_code == 204
    assert owner.get("/api/discogs/status").json()["connected"] is False
    assert db.execute(text("SELECT count(*) FROM discogs_connections")).scalar() == 0
    assert owner.get("/api/records").json()["total"] == 1


def test_connect_without_server_credentials(owner, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "discogs_consumer_key", "")
    r = owner.post("/api/discogs/connect")
    assert r.status_code == 503 and r.json()["code"] == "discogs_not_configured"


def test_connect_with_wrong_application_credentials(owner, discogs):
    discogs.fail_next = [401]
    r = owner.post("/api/discogs/connect")
    assert r.status_code == 502 and r.json()["code"] == "discogs_bad_app_credentials"


def test_connect_without_encryption_key_is_a_clear_error_not_a_crash(owner, discogs, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "fernet_key", "")
    status = owner.get("/api/discogs/status").json()
    assert status["configured"] is False  # Settings shows "not configured" instead of a button
    r = owner.post("/api/discogs/connect")
    assert r.status_code == 503 and r.json()["code"] == "discogs_not_configured"
    assert "FERNET_KEY" in r.json()["detail"]
