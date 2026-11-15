import json
from pathlib import Path

from sqlalchemy import func, select

from app.models import Location, Record
from tests.conftest import PASSWORD

FIXTURE = Path(__file__).parent.parent / "fixtures" / "prototype_backup.json"


def prototype():
    return json.loads(FIXTURE.read_text())


def records(client):
    return client.get("/api/records?limit=100").json()["items"]


def test_preferences_default_currency(owner):
    assert owner.get("/api/auth/me").json()["default_currency"] is None
    r = owner.patch("/api/auth/preferences", json={"default_currency": "usd"})
    assert r.status_code == 200 and r.json()["default_currency"] == "USD"
    assert owner.get("/api/auth/me").json()["default_currency"] == "USD"
    assert owner.patch("/api/auth/preferences", json={"default_currency": "XXX"}).status_code == 422
    cleared = owner.patch("/api/auth/preferences", json={"default_currency": None})
    assert cleared.json()["default_currency"] is None


def test_preference_is_per_member(owner, new_client):
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
    owner.patch("/api/auth/preferences", json={"default_currency": "GBP"})
    assert bob.get("/api/auth/me").json()["default_currency"] is None


def test_import_of_a_prototype_file(owner, db):
    r = owner.post("/api/backup/import", json=prototype())
    assert r.status_code == 200, r.text
    assert r.json() == {
        "records_added": 4,
        "records_skipped": 0,
        "locations_added": 3,
        "locations_reused": 0,
    }
    items = {i["title"]: i for i in records(owner)}
    kob = items["Kind of Blue"]
    assert (kob["catalog_no"], kob["country"], kob["year"], kob["label"]) == (
        "CL 1355",
        "US",
        1959,
        "Columbia",
    )
    assert kob["note"] == "Prima stampa" and kob["discogs_release_id"] == 1234567
    assert kob["purchase"]["amount_minor"] == 2500 and kob["purchase"]["date"] == "2024-05-12"
    assert kob["value"]["amount_minor"] == 12000 and kob["value"]["source"] == "discogs"
    assert kob["value"]["num_for_sale"] == 14
    # the channel of a place that is both comes from the file; online/physical follow the kind
    assert items["Homogénic"]["purchase"]["channel"] == "online"
    assert items["Comprato online"]["purchase"]["channel"] == "online"
    assert items["Kind of Blue"]["purchase"]["channel"] == "physical"
    assert items["Senza acquisto"]["purchase"] is None
    me = owner.get("/api/auth/me").json()["id"]
    assert {i["owner_id"] for i in items.values()} == {me}
    assert db.scalar(select(func.count()).select_from(Location)) == 3
    # the map sees the physical place with its purchase
    places = owner.get("/api/purchases/places").json()
    assert any(p["location"]["name"] == "Disco Club" for p in places["mapped"])


def test_import_as_shared(owner):
    owner.post("/api/backup/import?shared=true", json=prototype())
    assert {i["owner_id"] for i in records(owner)} == {None}


def test_reimport_adds_nothing_and_reuses_places(owner, db):
    owner.post("/api/backup/import", json=prototype())
    again = owner.post("/api/backup/import", json=prototype()).json()
    assert again["records_added"] == 0 and again["records_skipped"] == 4
    assert again["locations_added"] == 0 and again["locations_reused"] == 3
    assert len(records(owner)) == 4
    assert db.scalar(select(func.count()).select_from(Location)) == 3


def test_existing_records_are_kept_not_overwritten(owner):
    owner.post(
        "/api/records",
        json={
            "title": "Kind of Blue",
            "artist": "Miles Davis",
            "catalog_no": "CL 1355",
            "note": "Mia nota",
        },
    )
    r = owner.post("/api/backup/import", json=prototype()).json()
    assert r["records_skipped"] == 1 and r["records_added"] == 3
    kob = next(i for i in records(owner) if i["title"] == "Kind of Blue")
    assert kob["note"] == "Mia nota"


def test_invalid_file_changes_nothing(owner, db):
    bad = prototype()
    bad["vinyls"][2]["title"] = "   "  # one bad entry among good ones
    r = owner.post("/api/backup/import", json=bad)
    assert r.status_code == 422 and r.json()["code"] == "invalid_backup"
    assert records(owner) == []
    assert db.scalar(select(func.count()).select_from(Location)) == 0

    for broken in (
        {"vinyls": "x", "locations": []},
        {"vinyls": [], "locations": [{"id": "l", "name": "N", "kind": "physical"}]},  # no address
        {
            "vinyls": [
                {
                    "id": "v",
                    "title": "T",
                    "artist": "A",
                    "purchase": {"currency": "EUR", "amountMinor": -5},
                }
            ],
            "locations": [],
        },
    ):
        assert owner.post("/api/backup/import", json=broken).status_code == 422
    assert records(owner) == []


def test_export_roundtrip_into_another_family(owner, new_client, db):
    owner.post("/api/backup/import", json=prototype())
    exported = owner.get("/api/backup")
    assert exported.status_code == 200
    assert "attachment" in exported.headers["content-disposition"]
    data = exported.json()
    assert data["version"] == 1 and len(data["vinyls"]) == 4 and len(data["locations"]) == 3
    blob = json.dumps(data)
    for secret in ("token", "password", "secret"):
        assert secret not in blob.lower()

    # a fresh installation (empty database) takes the file back
    from sqlalchemy import text

    from app.core.db import get_engine

    with get_engine().begin() as conn:
        conn.execute(text("TRUNCATE households CASCADE"))
    other = new_client()
    other.post(
        "/api/auth/register",
        json={
            "email": "carla@example.com",
            "password": PASSWORD,
            "display_name": "Carla",
            "household_name": "Altra",
        },
    )
    r = other.post("/api/backup/import", json=data)
    assert r.json()["records_added"] == 4 and r.json()["locations_added"] == 3
    summary = {i["title"]: i["purchase"] for i in records(other)}
    assert summary["Kind of Blue"]["amount_minor"] == 2500
    assert db.scalar(select(func.count()).select_from(Record)) == 4


def test_backup_needs_login(client):
    assert client.get("/api/backup").status_code == 401
    assert client.post("/api/backup/import", json=prototype()).status_code == 401


def test_language_preference_is_per_member_and_validated(owner, new_client):
    assert owner.get("/api/auth/me").json()["language"] is None
    r = owner.patch("/api/auth/preferences", json={"language": "en"})
    assert r.status_code == 200 and r.json()["language"] == "en"
    assert owner.get("/api/auth/me").json()["language"] == "en"
    assert owner.patch("/api/auth/preferences", json={"language": "fr"}).status_code == 422
    # sending only the currency leaves the language alone
    owner.patch("/api/auth/preferences", json={"default_currency": "GBP"})
    me = owner.get("/api/auth/me").json()
    assert me["language"] == "en" and me["default_currency"] == "GBP"
    # null clears it
    assert owner.patch("/api/auth/preferences", json={"language": None}).json()["language"] is None
    assert me["language"] == "en"

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
    owner.patch("/api/auth/preferences", json={"language": "en"})
    assert bob.get("/api/auth/me").json()["language"] is None
