from tests.api.test_locations import loc
from tests.api.test_records import add


def test_places_groups_mapped_unmapped_and_online(owner):
    milan = loc(owner).json()
    rome = loc(owner, name="Rome", address="Via Roma 1", lat=None, lng=None).json()
    web = loc(
        owner,
        name="Bandcamp",
        kind="online",
        address=None,
        lat=None,
        lng=None,
        url="https://bandcamp.com",
    ).json()
    both = loc(
        owner, name="Both", kind="both", url="https://both.example.com", lat=44.5, lng=11.3
    ).json()
    add(
        owner,
        "A",
        "X",
        purchase={
            "location_id": milan["id"],
            "amount_minor": 1000,
            "currency": "EUR",
            "date": "2024-05-01",
        },
    )
    add(
        owner,
        "B",
        "X",
        purchase={
            "location_id": milan["id"],
            "amount_minor": 2000,
            "currency": "EUR",
            "date": "2025-05-01",
        },
    )
    add(
        owner,
        "C",
        "X",
        purchase={
            "location_id": rome["id"],
            "amount_minor": 500,
            "currency": "EUR",
            "date": "2024-02-01",
        },
    )
    add(
        owner,
        "D",
        "X",
        purchase={
            "location_id": web["id"],
            "amount_minor": 700,
            "currency": "EUR",
            "date": "2024-03-01",
        },
    )
    add(
        owner,
        "E",
        "X",
        purchase={
            "location_id": both["id"],
            "channel": "online",
            "amount_minor": 900,
            "currency": "EUR",
            "date": "2024-04-01",
        },
    )
    add(
        owner,
        "F",
        "X",
        purchase={
            "location_id": both["id"],
            "channel": "physical",
            "amount_minor": 900,
            "currency": "EUR",
            "date": "2024-04-01",
        },
    )
    add(owner, "G", "X")  # no purchase: ignored
    data = owner.get("/api/purchases/places").json()
    assert data["years"] == ["2025", "2024"]
    assert sorted(p["location"]["name"] for p in data["mapped"]) == ["Both", "Disco Club"]
    milan_stats = next(p for p in data["mapped"] if p["location"]["name"] == "Disco Club")
    assert milan_stats["count"] == 2 and milan_stats["spent"] == {"EUR": 3000}
    assert [r["title"] for r in milan_stats["records"]] == ["B", "A"]
    both_mapped = next(p for p in data["mapped"] if p["location"]["name"] == "Both")
    assert [r["title"] for r in both_mapped["records"]] == ["F"]  # the online one is not on the map
    assert [p["location"]["name"] for p in data["unmapped"]] == ["Rome"]
    assert sorted(p["location"]["name"] for p in data["online"]) == ["Bandcamp", "Both"]


def test_places_year_filter(owner):
    milan = loc(owner).json()
    add(
        owner,
        "A",
        "X",
        purchase={
            "location_id": milan["id"],
            "amount_minor": 1000,
            "currency": "EUR",
            "date": "2024-05-01",
        },
    )
    add(
        owner,
        "B",
        "X",
        purchase={
            "location_id": milan["id"],
            "amount_minor": 2000,
            "currency": "EUR",
            "date": "2025-05-01",
        },
    )
    data = owner.get("/api/purchases/places?year=2025").json()
    assert data["mapped"][0]["count"] == 1 and data["mapped"][0]["spent"] == {"EUR": 2000}
    assert owner.get("/api/purchases/places?year=2020").json()["mapped"] == []


def test_places_need_login():
    from tests.conftest import make_client

    assert make_client().get("/api/purchases/places").status_code == 401
