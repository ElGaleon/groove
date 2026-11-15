import pytest


@pytest.fixture
def connected(owner, discogs):
    owner.post("/api/discogs/connect")
    owner.get("/api/discogs/callback?oauth_token=REQTOKEN&oauth_verifier=V")
    return owner


def result(n, title="Abbey Road", artist="The Beatles", **over):
    base = {
        "id": n,
        "title": f"{artist} - {title}",
        "year": "1969",
        "label": ["Apple Records"],
        "genre": ["Rock"],
        "format": ["Vinyl", "LP"],
        "cover_image": f"https://i.discogs.com/c{n}.jpg",
    }
    base.update(over)
    return base


def test_search_marks_what_the_family_already_has(connected, discogs):
    me = connected.get("/api/auth/me").json()
    connected.post(
        "/api/records",
        json={"title": "Abbey Road", "artist": "The Beatles", "owner_id": me["id"]},
    )
    discogs.search_results = [result(1), result(2, "Revolver"), result(3, "Other", "Someone")]
    data = connected.get("/api/discogs/search?q=beatles").json()["results"]
    assert data[0]["title"] == "Abbey Road" and data[0]["artist"] == "The Beatles"
    assert data[0]["in_collection"]["owner_name"] == "Anna"
    assert data[1]["in_collection"] is None
    assert data[0]["year"] == 1969 and data[0]["format"] == "Vinyl, LP"


def test_search_matches_by_release_id_and_shared(connected, discogs):
    connected.post(
        "/api/records", json={"title": "Differente", "artist": "Tizio", "discogs_release_id": 2}
    )
    discogs.search_results = [result(2, "Revolver")]
    hit = connected.get("/api/discogs/search?q=revolver").json()["results"][0]
    assert hit["in_collection"]["owner_name"] is None  # shared


def test_search_no_results(connected, discogs):
    discogs.search_results = []
    assert connected.get("/api/discogs/search?q=zzzz").json()["results"] == []


def test_search_locked_without_connection_but_manual_works(owner):
    r = owner.get("/api/discogs/search?q=beatles")
    assert r.status_code == 409 and r.json()["code"] == "discogs_not_connected"
    assert owner.get("/api/records/random").status_code == 200
    created = owner.post("/api/records", json={"title": "T", "artist": "A"})
    assert created.status_code == 201
    rid = created.json()["id"]
    assert owner.patch(f"/api/records/{rid}", json={"note": "n"}).status_code == 200
    assert owner.get("/api/records?q=T").json()["total"] == 1
    assert owner.delete(f"/api/records/{rid}").status_code == 204
    assert owner.get("/api/discogs/import/latest").json() is None
    r = owner.post("/api/discogs/import", json={})
    assert r.status_code == 409


def test_search_401_marks_connection_expired(connected, discogs):
    discogs.fail_next = [401]
    r = connected.get("/api/discogs/search?q=beatles")
    assert r.status_code == 409 and r.json()["code"] == "discogs_expired"
    assert connected.get("/api/discogs/status").json()["status"] == "expired"


def test_cover_from_discogs_only_fetches_discogs_hosts(connected, discogs):
    rid = connected.post("/api/records", json={"title": "T", "artist": "A"}).json()["id"]
    bad = connected.post(
        f"/api/discogs/records/{rid}/cover", json={"url": "https://evil.example.com/x.jpg"}
    )
    assert bad.status_code == 422
    ok = connected.post(
        f"/api/discogs/records/{rid}/cover", json={"url": "https://i.discogs.com/c1.jpg"}
    )
    assert ok.status_code == 200 and ok.json()["has_cover"] is True


def test_tracklist_fetched_once_then_reused(connected, discogs):
    rid = connected.post(
        "/api/records", json={"title": "T", "artist": "A", "discogs_release_id": 1001}
    ).json()["id"]
    first = connected.get(f"/api/discogs/records/{rid}/tracklist").json()
    assert first["available"] and first["tracks"][0]["title"] == "Song"
    calls = len([c for c in discogs.calls if c[1].startswith("/releases/")])
    again = connected.get(f"/api/discogs/records/{rid}/tracklist").json()
    assert again == first
    assert len([c for c in discogs.calls if c[1].startswith("/releases/")]) == calls == 1


def test_tracklist_not_available_cases(owner, discogs):
    manual = owner.post("/api/records", json={"title": "T", "artist": "A"}).json()["id"]
    assert owner.get(f"/api/discogs/records/{manual}/tracklist").json() == {
        "available": False,
        "tracks": [],
        "reason": "no_release",
    }
    linked = owner.post(
        "/api/records", json={"title": "U", "artist": "B", "discogs_release_id": 1001}
    ).json()["id"]
    r = owner.get(f"/api/discogs/records/{linked}/tracklist").json()
    assert r["available"] is False and r["reason"] == "no_connection"
    assert not [c for c in discogs.calls if c[1].startswith("/releases/")]


def test_search_returns_catalogue_country_and_paging(connected, discogs):
    discogs.search_results = [result(1, catno="PCS 7088", country="UK")]
    discogs.search_pages = 3
    data = connected.get("/api/discogs/search?q=abbey&page=2").json()
    assert data["results"][0]["catalog_no"] == "PCS 7088" and data["results"][0]["country"] == "UK"
    assert data["page"] == 2 and data["pages"] == 3
    assert (
        discogs.search_params[-1]["page"] == "2" and discogs.search_params[-1]["format"] == "Vinyl"
    )


def test_search_by_barcode_when_digits_only(connected, discogs):
    connected.get("/api/discogs/search?q=0602 5476 7034")
    assert discogs.search_params[-1].get("barcode") == "060254767034"
    assert "q" not in discogs.search_params[-1]
    connected.get("/api/discogs/search?q=abbey road")
    assert (
        discogs.search_params[-1].get("q") == "abbey road"
        and "barcode" not in discogs.search_params[-1]
    )


def test_release_value_lowest_price_in_minor_units(connected, discogs):
    discogs.stats[1001] = {"lowest_price": {"value": 61.5, "currency": "EUR"}, "num_for_sale": 42}
    r = connected.get("/api/discogs/releases/1001/value?currency=EUR")
    assert r.status_code == 200
    assert r.json() == {
        "amount_minor": 6150,
        "currency": "EUR",
        "num_for_sale": 42,
        "measure": "lowest_price_for_sale",
    }


def test_release_value_without_copies_invents_nothing(connected, discogs):
    r = connected.get("/api/discogs/releases/999/value?currency=EUR").json()
    assert r["amount_minor"] is None and r["num_for_sale"] == 0


def test_release_value_zero_decimal_currency(connected, discogs):
    discogs.stats[5] = {"lowest_price": {"value": 3200, "currency": "JPY"}, "num_for_sale": 1}
    assert (
        connected.get("/api/discogs/releases/5/value?currency=JPY").json()["amount_minor"] == 3200
    )


def test_release_value_needs_connection(owner):
    r = owner.get("/api/discogs/releases/1/value")
    assert r.status_code == 409 and r.json()["code"] == "discogs_not_connected"


def test_release_value_rejected_token_expires_connection(connected, discogs):
    discogs.fail_next = [401]
    r = connected.get("/api/discogs/releases/1/value")
    assert r.status_code == 409 and r.json()["code"] == "discogs_expired"


def test_search_does_not_mark_another_pressing_as_owned(connected, discogs):
    connected.post(
        "/api/records",
        json={"title": "Abbey Road", "artist": "The Beatles", "catalog_no": "PCS 7088"},
    )
    discogs.search_results = [
        result(1, catno="PCS 7088"),  # same pressing
        result(2, catno="B0030"),  # reissue: a different record
        result(3, catno=None),  # no catalogue number: not the same pressing either
    ]
    data = connected.get("/api/discogs/search?q=abbey").json()["results"]
    assert [bool(d["in_collection"]) for d in data] == [True, False, False]
