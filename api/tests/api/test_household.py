from sqlalchemy import func, select

from app.models import Household, Session, User
from tests.conftest import PASSWORD, make_client


def join(owner, email="bob@example.com", name="Bob"):
    token = owner.post("/api/invites").json()["token"]
    bob = make_client()
    r = bob.post(
        "/api/auth/register",
        json={"email": email, "password": PASSWORD, "display_name": name, "invite_token": token},
    )
    assert r.status_code == 201, r.text
    return bob


def test_setup_status_is_public_and_flips_after_first_registration(client):
    assert client.get("/api/auth/status").json() == {"needs_setup": True, "min_password_length": 10}
    client.post(
        "/api/auth/register",
        json={
            "email": "a@example.com",
            "password": PASSWORD,
            "display_name": "A",
            "household_name": "F",
        },
    )
    assert make_client().get("/api/auth/status").json() == {
        "needs_setup": False,
        "min_password_length": 10,
    }


def test_household_lists_its_members(owner):
    join(owner)
    data = owner.get("/api/household").json()
    assert data["name"] == "Famiglia Rossi"
    assert [m["display_name"] for m in data["members"]] == ["Anna", "Bob"]


def test_a_member_can_leave_and_the_others_stay(owner, db):
    bob = join(owner)
    assert bob.post("/api/household/leave", json={}).status_code == 204
    assert bob.get("/api/auth/me").status_code == 401  # signed out
    assert [m["display_name"] for m in owner.get("/api/household").json()["members"]] == ["Anna"]
    assert db.scalar(select(func.count()).select_from(Session)) == 1  # only Anna's session left


def test_last_member_must_confirm_deleting_the_collection(owner, db):
    refused = owner.post("/api/household/leave", json={})
    assert refused.status_code == 409
    assert refused.json()["code"] == "last_member_confirmation_required"
    assert db.scalar(select(func.count()).select_from(Household)) == 1  # nothing deleted yet

    done = owner.post("/api/household/leave", json={"confirm_delete_collection": True})
    assert done.status_code == 204
    assert db.scalar(select(func.count()).select_from(Household)) == 0
    assert db.scalar(select(func.count()).select_from(User)) == 0


def test_after_the_last_member_leaves_a_new_household_can_be_created(owner, new_client):
    owner.post("/api/household/leave", json={"confirm_delete_collection": True})
    fresh = new_client()
    r = fresh.post(
        "/api/auth/register",
        json={
            "email": "new@example.com",
            "password": PASSWORD,
            "display_name": "N",
            "household_name": "Nuova",
        },
    )
    assert r.status_code == 201
