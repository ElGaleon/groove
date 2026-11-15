from sqlalchemy import select

from app.core.config import get_settings
from app.models import DiscogsConnection
from tests.api.test_discogs_search import result
from tests.conftest import PASSWORD


def test_no_discogs_secret_in_any_response(owner, discogs, db, new_client):
    settings = get_settings()
    owner.post("/api/discogs/connect")
    connect_page = owner.get(
        "/api/discogs/callback?oauth_token=REQTOKEN&oauth_verifier=V", follow_redirects=False
    )
    discogs.search_results = [result(1001)]
    owner.post("/api/records", json={"title": "T", "artist": "A", "discogs_release_id": 1001})
    owner.post("/api/discogs/import", json={})

    stored = db.scalar(select(DiscogsConnection))
    secrets = {
        "ACCESSTOK",
        "ACCESSSEC",
        "REQSECRET",
        settings.discogs_consumer_key,
        settings.discogs_consumer_secret,
        settings.fernet_key,
        stored.token_encrypted,
        stored.token_secret_encrypted,
    }

    responses = [connect_page]
    for path in (
        "/api/discogs/status",
        "/api/discogs/search?q=abbey",
        "/api/discogs/import/latest",
        "/api/records",
        "/api/household",
        "/api/auth/me",
        "/api/invites",
        "/api/openapi.json",
    ):
        responses.append(owner.get(path))
    rid = owner.get("/api/records").json()["items"][0]["id"]
    responses.append(owner.get(f"/api/discogs/records/{rid}/tracklist"))
    responses.append(
        owner.post("/api/discogs/connect")
    )  # the authorise URL carries only the request token

    for response in responses:
        blob = response.text + str(dict(response.headers))
        for secret in secrets:
            assert secret not in blob, (response.request.url, secret)

    # Another member sees no trace of it either.
    token = owner.post("/api/invites").json()["token"]
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
    for path in ("/api/discogs/status", "/api/records", "/api/household"):
        for secret in secrets:
            assert secret not in bob.get(path).text
