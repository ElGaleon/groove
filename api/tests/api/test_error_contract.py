"""Every error has a stable English `code`; validation errors also name the `field`."""

import pytest


def test_error_shape_has_code_and_english_detail(client):
    r = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "x" * 12})
    assert r.status_code == 401
    body = r.json()
    assert body["code"] == "invalid_credentials"
    assert (
        body["detail"] == "Wrong email or password"
    )  # generic: says nothing about which was wrong


def test_not_authenticated_has_a_code(client):
    assert client.get("/api/records").json()["code"] == "not_authenticated"


def test_unknown_record_has_a_code(owner):
    r = owner.get("/api/records/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404 and r.json()["code"] == "record_not_found"


@pytest.mark.parametrize(
    ("body", "code", "field"),
    [
        ({"artist": "A"}, "required", "title"),
        ({"title": "T", "artist": "A", "year": 1200}, "invalid", "year"),
        (
            {"title": "T", "artist": "A", "purchase": {"currency": "EURO", "amount_minor": 5}},
            "invalid",
            "currency",
        ),
        (
            {"title": "T", "artist": "A", "purchase": {"currency": "EUR", "amount_minor": -5}},
            "invalid",
            "amount_minor",
        ),
    ],
)
def test_validation_errors_carry_code_and_field(owner, body, code, field):
    r = owner.post("/api/records", json=body)
    assert r.status_code == 422
    assert (r.json()["code"], r.json()["field"]) == (code, field)
    assert field in r.json()["fields"]


def test_invalid_backup_file_has_its_code(owner):
    r = owner.post("/api/backup/import", json={"vinyls": "x", "locations": []})
    assert r.status_code == 422 and r.json()["code"] == "invalid_backup"


def test_extra_values_travel_with_the_code(owner):
    place = owner.post(
        "/api/locations",
        json={"name": "Shop", "kind": "physical", "address": "Via Roma 1"},
    ).json()
    owner.post(
        "/api/records",
        json={
            "title": "T",
            "artist": "A",
            "purchase": {"currency": "EUR", "location_id": place["id"]},
        },
    )
    r = owner.delete(f"/api/locations/{place['id']}")
    assert r.status_code == 409
    assert r.json()["code"] == "in_use" and r.json()["count"] == 1


def test_short_password_names_the_field_and_the_minimum(client):
    r = client.post(
        "/api/auth/register",
        json={
            "email": "a@example.com",
            "password": "short",
            "display_name": "A",
            "household_name": "F",
        },
    )
    assert r.status_code == 422
    assert r.json()["code"] == "password_too_short"
    assert r.json()["field"] == "password" and r.json()["min_length"] >= 10
