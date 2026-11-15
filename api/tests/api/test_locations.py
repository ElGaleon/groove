import uuid

from tests.api.test_records import add


def loc(client, **over):
    body = {
        "name": "Disco Club",
        "kind": "physical",
        "address": "Via Savona 1, Milano",
        "lat": 45.45,
        "lng": 9.17,
    }
    body.update(over)
    return client.post("/api/locations", json=body)


def test_create_list_update_physical_online_both(owner):
    shop = loc(owner)
    assert shop.status_code == 201 and shop.json()["lat"] == 45.45
    web = loc(
        owner,
        name="Bandcamp",
        kind="online",
        address=None,
        lat=None,
        lng=None,
        url="https://bandcamp.com",
    )
    assert web.status_code == 201 and web.json()["address"] is None
    both = loc(owner, name="Vinile Bologna", kind="both", url="https://vinile.example.com")
    assert both.status_code == 201
    names = [item["name"] for item in owner.get("/api/locations").json()]
    assert names == ["Bandcamp", "Disco Club", "Vinile Bologna"]
    assert [i["name"] for i in owner.get("/api/locations?q=DISCO").json()] == ["Disco Club"]
    upd = owner.patch(
        f"/api/locations/{shop.json()['id']}",
        json={"name": "Disco Club 2", "kind": "physical", "address": "Via X 2"},
    )
    assert upd.status_code == 200 and upd.json()["name"] == "Disco Club 2"


def test_validation_by_kind(owner):
    assert loc(owner, address=None).status_code == 422  # physical needs address
    assert loc(owner, kind="online", url="not a url").status_code == 422  # invalid URL
    assert loc(owner, kind="online", url=None).status_code == 422  # online needs URL
    assert loc(owner, kind="both", url="https://x.example.com", address=None).status_code == 422
    assert loc(owner, lat=120).status_code == 422  # out of range
    assert loc(owner, name="  ").status_code == 422


def test_purchase_links_to_location_and_channel_follows_kind(owner):
    both = loc(owner, name="Both", kind="both", url="https://b.example.com").json()
    shop = loc(owner, name="Shop").json()
    online = add(
        owner,
        "A",
        "X",
        purchase={
            "location_id": both["id"],
            "channel": "online",
            "amount_minor": 100,
            "currency": "EUR",
        },
    )
    assert online["purchase"]["channel"] == "online"
    default = add(owner, "B", "X", purchase={"location_id": both["id"]})
    assert default["purchase"]["channel"] == "physical"
    fixed = add(owner, "C", "X", purchase={"location_id": shop["id"], "channel": "online"})
    assert (
        fixed["purchase"]["channel"] == "physical"
    )  # a physical shop is physical whatever is sent


def test_purchase_with_unknown_location_rejected(owner):
    r = owner.post(
        "/api/records",
        json={"title": "A", "artist": "X", "purchase": {"location_id": str(uuid.uuid4())}},
    )
    assert r.status_code == 422


def test_location_in_use_cannot_be_deleted_and_reassign_unblocks(owner):
    a = loc(owner).json()
    b = loc(owner, name="Other shop").json()
    for t in "123":
        add(owner, t, "X", purchase={"location_id": a["id"]})
    r = owner.delete(f"/api/locations/{a['id']}")
    assert r.status_code == 409 and r.json()["code"] == "in_use" and r.json()["count"] == 3
    assert owner.post(f"/api/locations/{a['id']}/reassign", json={"to": b["id"]}).status_code == 204
    assert owner.delete(f"/api/locations/{a['id']}").status_code == 204
    assert all(
        i["purchase"]["location_id"] == b["id"] for i in owner.get("/api/records").json()["items"]
    )
    assert owner.post(f"/api/locations/{b['id']}/reassign", json={"to": b["id"]}).status_code == 422


def test_deleted_record_no_longer_blocks_location(owner):
    a = loc(owner).json()
    rec = add(owner, "1", "X", purchase={"location_id": a["id"]})
    owner.delete(f"/api/records/{rec['id']}")
    # removed (soft-deleted) records do not count and must not make the delete crash
    assert owner.delete(f"/api/locations/{a['id']}").status_code == 204


def test_unknown_location_is_404_and_needs_login(owner):
    assert (
        owner.patch(
            f"/api/locations/{uuid.uuid4()}",
            json={"name": "x", "kind": "online", "url": "https://a.example.com"},
        ).status_code
        == 404
    )
    from tests.conftest import make_client

    assert make_client().get("/api/locations").status_code == 401
