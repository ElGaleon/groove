"""Ownership of a record: shared by the family or one member's, changeable at any time."""

from tests.api.test_records import add
from tests.api.test_records import join as join_with_id
from tests.conftest import make_client


def join(owner):
    return join_with_id(owner)[0]


def member_id(client, name):
    members = client.get("/api/household").json()["members"]
    return next(m["id"] for m in members if m["display_name"] == name)


def set_owner(client, record_id, owner_id):
    return client.patch(f"/api/records/{record_id}", json={"owner_id": owner_id})


def test_any_member_can_change_the_owner_of_any_record_at_any_time(owner):
    bob = join(owner)
    anna_id, bob_id = member_id(owner, "Anna"), member_id(owner, "Bob")
    record = add(owner, "Blue Train", "Coltrane")
    assert record["owner_id"] is None  # shared until someone claims it

    # Bob hands a shared record to Anna, then to himself, then back to the family
    assert set_owner(bob, record["id"], anna_id).json()["owner_id"] == anna_id
    assert set_owner(owner, record["id"], bob_id).json()["owner_id"] == bob_id
    assert set_owner(bob, record["id"], None).json()["owner_id"] is None
    assert owner.get(f"/api/records/{record['id']}").json()["owner_id"] is None


def test_changing_the_owner_changes_nothing_else(owner):
    record = add(owner, "Blue Train", "Coltrane", year=1958, genres=["Jazz"])
    changed = set_owner(owner, record["id"], member_id(owner, "Anna")).json()
    assert {k: v for k, v in changed.items() if k not in ("owner_id", "updated_at")} == {
        k: v for k, v in record.items() if k not in ("owner_id", "updated_at")
    }


def test_the_owner_must_be_a_member_of_the_family(owner):
    record = add(owner, "Blue Train", "Coltrane")
    refused = set_owner(owner, record["id"], "00000000-0000-4000-8000-000000000000")
    assert refused.status_code == 422
    assert refused.json()["code"] == "invalid_owner"
    assert owner.get(f"/api/records/{record['id']}").json()["owner_id"] is None


def test_the_owner_filter_follows_a_change(owner):
    join(owner)
    anna_id = member_id(owner, "Anna")
    mine = add(owner, "A", "X")
    add(owner, "B", "Y")
    set_owner(owner, mine["id"], anna_id)
    assert owner.get("/api/records", params={"owner": anna_id}).json()["total"] == 1
    assert owner.get("/api/records", params={"owner": "shared"}).json()["total"] == 1
    options = owner.get("/api/records/options").json()
    assert options["shared_count"] == 1
    assert {o["id"]: o["count"] for o in options["owners"]}[anna_id] == 1


def test_a_stranger_cannot_change_anything(client):
    assert set_owner(make_client(), "00000000-0000-4000-8000-000000000000", None).status_code == 401
