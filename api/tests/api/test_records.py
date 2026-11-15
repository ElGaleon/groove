import io
import time
from datetime import timedelta

import pytest
from PIL import Image
from sqlalchemy import text, update

from app.core.clock import utcnow
from app.models import Record, User
from tests.conftest import PASSWORD, make_client


def add(client, title="Kind of Blue", artist="Miles Davis", **extra):
    response = client.post("/api/records", json={"title": title, "artist": artist, **extra})
    assert response.status_code == 201, response.text
    return response.json()


def join(owner, email="bob@example.com", name="Bob"):
    token = owner.post("/api/invites").json()["token"]
    bob = make_client()
    r = bob.post(
        "/api/auth/register",
        json={"email": email, "password": PASSWORD, "display_name": name, "invite_token": token},
    )
    assert r.status_code == 201, r.text
    return bob, r.json()["id"]


def image_bytes(fmt="JPEG", size=(800, 400), color=(200, 30, 30)):
    out = io.BytesIO()
    Image.new("RGB", size, color).save(out, format=fmt)
    return out.getvalue()


def upload(client, record_id, data, name="cover.jpg", content_type="image/jpeg"):
    return client.post(
        f"/api/records/{record_id}/cover", files={"file": (name, data, content_type)}
    )


# --- 3.1 schema -------------------------------------------------------------------------------


def test_trigram_indexes_exist(db):
    names = {
        r[0]
        for r in db.execute(text("SELECT indexname FROM pg_indexes WHERE tablename = 'records'"))
    }
    assert {
        "ix_records_title_trgm",
        "ix_records_artist_trgm",
        "uq_records_discogs_instance",
    } <= names


def test_paging_and_catalogue_indexes_exist_and_are_used(owner, db):
    names = {
        r[0]
        for r in db.execute(text("SELECT indexname FROM pg_indexes WHERE tablename = 'records'"))
    }
    assert {
        "ix_records_household_artist",
        "ix_records_household_created",
        "ix_records_catalog_trgm",
    } <= names
    household = db.execute(text("SELECT id FROM households")).scalar()
    # Tiny tables are scanned sequentially; switch that off to see which index the plan picks.
    db.execute(text("SET LOCAL enable_seqscan = off"))
    plan = "\n".join(
        r[0]
        for r in db.execute(
            text(
                "EXPLAIN SELECT id FROM records WHERE household_id = :h AND deleted_at IS NULL "
                "ORDER BY artist_key, title_key, id LIMIT 10"
            ),
            {"h": household},
        )
    )
    assert "ix_records_household_artist" in plan
    plan = "\n".join(
        r[0]
        for r in db.execute(
            text(
                "EXPLAIN SELECT id FROM records "
                "WHERE lower(coalesce(catalog_no, '')) LIKE '%pcs 70%'"
            )
        )
    )
    assert "ix_records_catalog_trgm" in plan
    db.rollback()


def test_owner_foreign_key_sets_null_on_delete(db):
    action = db.execute(
        text(
            "SELECT confdeltype FROM pg_constraint "
            "WHERE conrelid = 'records'::regclass AND conname = 'records_owner_id_fkey'"
        )
    ).scalar()
    assert action == "n"  # ON DELETE SET NULL


# --- 3.2 create, read, update, delete, undo ---------------------------------------------------


def test_create_and_read_a_record(owner):
    created = add(
        owner, year=1959, label="Columbia", genres=["Jazz", "Jazz", " Modal "], note="  ok "
    )
    assert created["genres"] == ["Jazz", "Modal"]  # trimmed and de-duplicated
    assert created["note"] == "ok" and created["owner_id"] is None and created["has_cover"] is False
    assert owner.get(f"/api/records/{created['id']}").json()["title"] == "Kind of Blue"


@pytest.mark.parametrize(
    ("body", "message"),
    [
        ({"artist": "Miles Davis"}, ("required", "title")),
        ({"title": "Kind of Blue"}, ("required", "artist")),
        ({"title": "   ", "artist": "Miles Davis"}, ("required", "title")),
        ({"title": "Kind of Blue", "artist": ""}, ("required", "artist")),
    ],
)
def test_missing_title_or_artist_is_refused_naming_the_field(owner, body, message):
    response = owner.post("/api/records", json=body)
    assert response.status_code == 422
    assert (response.json()["code"], response.json()["field"]) == message
    assert owner.get("/api/records").json()["total"] == 0


def test_update_changes_only_the_fields_sent(owner):
    record = add(owner, year=1959, label="Columbia")
    r = owner.patch(f"/api/records/{record['id']}", json={"note": "Copia in ottime condizioni"})
    assert r.status_code == 200
    body = r.json()
    assert body["note"] == "Copia in ottime condizioni"
    assert body["title"] == "Kind of Blue" and body["year"] == 1959 and body["label"] == "Columbia"


def test_update_cannot_blank_the_title(owner):
    record = add(owner)
    assert owner.patch(f"/api/records/{record['id']}", json={"title": ""}).status_code == 422
    assert owner.patch(f"/api/records/{record['id']}", json={"title": None}).status_code == 422


def test_search_follows_an_edited_title(owner):
    record = add(owner, title="Old name")
    owner.patch(f"/api/records/{record['id']}", json={"title": "Brand new name"})
    assert owner.get("/api/records", params={"q": "brand new"}).json()["total"] == 1
    assert owner.get("/api/records", params={"q": "old name"}).json()["total"] == 0


def test_removed_record_disappears_for_everyone(owner):
    bob, _ = join(owner)
    record = add(owner)
    assert owner.delete(f"/api/records/{record['id']}").status_code == 204
    assert owner.get(f"/api/records/{record['id']}").status_code == 404
    assert bob.get("/api/records").json()["total"] == 0


def test_undo_within_ten_seconds_restores_everything(owner):
    record = add(owner, year=1959, label="Columbia", genres=["Jazz"], note="nota")
    owner.delete(f"/api/records/{record['id']}")
    restored = owner.post(f"/api/records/{record['id']}/restore")
    assert restored.status_code == 200
    body = restored.json()
    assert (body["year"], body["label"], body["genres"], body["note"]) == (
        1959,
        "Columbia",
        ["Jazz"],
        "nota",
    )
    assert owner.get("/api/records").json()["total"] == 1


def test_undo_after_the_time_limit_is_refused(owner, db):
    record = add(owner)
    owner.delete(f"/api/records/{record['id']}")
    db.execute(update(Record).values(deleted_at=utcnow() - timedelta(seconds=11)))
    db.commit()
    assert owner.post(f"/api/records/{record['id']}/restore").status_code == 409
    assert owner.get("/api/records").json()["total"] == 0


def test_unknown_record_is_404(owner):
    assert owner.get("/api/records/00000000-0000-0000-0000-000000000000").status_code == 404


# --- 3.3 optional owner (and 2.7: leaving) ----------------------------------------------------


def test_setting_changing_and_clearing_the_owner(owner):
    _, bob_id = join(owner)
    anna_id = owner.get("/api/auth/me").json()["id"]
    record = add(owner, owner_id=anna_id)
    assert record["owner_id"] == anna_id

    changed = owner.patch(f"/api/records/{record['id']}", json={"owner_id": bob_id}).json()
    assert changed["owner_id"] == bob_id

    cleared = owner.patch(f"/api/records/{record['id']}", json={"owner_id": None}).json()
    assert cleared["owner_id"] is None  # shared


def test_a_record_without_owner_is_shared(owner):
    assert add(owner)["owner_id"] is None


def test_any_member_can_change_anyones_owner(owner):
    bob, bob_id = join(owner)
    record = add(owner, owner_id=owner.get("/api/auth/me").json()["id"])
    assert bob.patch(f"/api/records/{record['id']}", json={"owner_id": bob_id}).status_code == 200


def test_owner_must_be_a_member_of_the_household(owner):
    bogus = "00000000-0000-0000-0000-000000000001"
    assert (
        owner.post(
            "/api/records", json={"title": "A", "artist": "B", "owner_id": bogus}
        ).status_code
        == 422
    )
    record = add(owner)
    assert owner.patch(f"/api/records/{record['id']}", json={"owner_id": bogus}).status_code == 422
    assert owner.get(f"/api/records/{record['id']}").json()["owner_id"] is None


def test_records_of_a_member_who_leaves_become_shared(owner):
    """Task 2.7: leaving keeps the records and turns them into shared ones."""
    bob, bob_id = join(owner)
    for i in range(12):
        add(owner, title=f"Disco {i}", artist="Artista", owner_id=bob_id)
    assert owner.get("/api/records", params={"owner": bob_id}).json()["total"] == 12

    assert bob.post("/api/household/leave", json={}).status_code == 204

    assert owner.get("/api/records").json()["total"] == 12  # none lost
    assert owner.get("/api/records", params={"owner": "shared"}).json()["total"] == 12
    assert owner.get("/api/records", params={"owner": bob_id}).json()["total"] == 0


# --- 3.4 covers -------------------------------------------------------------------------------


def test_record_without_cover_reports_it_and_serves_nothing(owner):
    record = add(owner)
    assert record["has_cover"] is False and record["cover_version"] is None
    assert owner.get(f"/api/records/{record['id']}/cover").status_code == 404


def test_valid_upload_becomes_a_square_cover(owner):
    record = add(owner)
    r = upload(owner, record["id"], image_bytes(size=(800, 400)))
    assert r.status_code == 200 and r.json()["has_cover"] is True
    served = owner.get(f"/api/records/{record['id']}/cover")
    assert served.status_code == 200 and served.headers["content-type"] == "image/jpeg"
    assert "private" in served.headers["cache-control"]
    with Image.open(io.BytesIO(served.content)) as img:
        assert img.size == (600, 600) and img.format == "JPEG"


def test_back_cover_is_separate_from_the_front(owner):
    record = add(owner)
    assert record["has_back_cover"] is False
    assert owner.get(f"/api/records/{record['id']}/back-cover").status_code == 404
    r = owner.post(
        f"/api/records/{record['id']}/back-cover",
        files={"file": ("b.jpg", image_bytes(size=(500, 300)), "image/jpeg")},
    )
    assert r.status_code == 200
    assert r.json()["has_back_cover"] is True and r.json()["has_cover"] is False
    served = owner.get(f"/api/records/{record['id']}/back-cover")
    assert served.status_code == 200 and served.headers["content-type"] == "image/jpeg"
    assert owner.get(f"/api/records/{record['id']}/cover").status_code == 404


@pytest.mark.parametrize(("fmt", "ctype"), [("PNG", "image/png"), ("WEBP", "image/webp")])
def test_png_and_webp_are_accepted(owner, fmt, ctype):
    record = add(owner)
    assert upload(owner, record["id"], image_bytes(fmt), "c", ctype).status_code == 200


def test_cover_can_be_revalidated_with_its_etag(owner):
    record = add(owner)
    upload(owner, record["id"], image_bytes())
    first = owner.get(f"/api/records/{record['id']}/cover")
    again = owner.get(
        f"/api/records/{record['id']}/cover", headers={"If-None-Match": first.headers["etag"]}
    )
    assert again.status_code == 304


def test_oversized_file_is_refused_and_the_old_cover_kept(owner):
    record = add(owner)
    upload(owner, record["id"], image_bytes(color=(10, 200, 10)))
    before = owner.get(f"/api/records/{record['id']}/cover").content
    too_big = b"\xff\xd8\xff" + b"0" * (5 * 1024 * 1024 + 10)
    r = upload(owner, record["id"], too_big)
    assert r.status_code == 422 and r.json()["code"] == "image_too_large"
    assert owner.get(f"/api/records/{record['id']}/cover").content == before


@pytest.mark.parametrize(
    ("data", "name", "ctype"),
    [
        (b"this is not an image", "notes.txt", "text/plain"),
        (b"%PDF-1.4 fake", "x.jpg", "image/jpeg"),  # extension and type lie about the content
        (image_bytes("GIF"), "x.gif", "image/gif"),  # real image, unsupported format
    ],
)
def test_non_images_and_unsupported_formats_are_refused(owner, data, name, ctype):
    record = add(owner)
    upload(owner, record["id"], image_bytes())
    before = owner.get(f"/api/records/{record['id']}/cover").content
    r = upload(owner, record["id"], data, name, ctype)
    assert r.status_code == 422
    assert owner.get(f"/api/records/{record['id']}/cover").content == before


def test_cover_of_a_removed_record_is_not_served(owner):
    record = add(owner)
    upload(owner, record["id"], image_bytes())
    owner.delete(f"/api/records/{record['id']}")
    assert owner.get(f"/api/records/{record['id']}/cover").status_code == 404


def test_anonymous_cannot_get_a_cover(owner):
    record = add(owner)
    upload(owner, record["id"], image_bytes())
    anonymous = make_client()
    assert anonymous.get(f"/api/records/{record['id']}/cover").status_code == 401
    assert anonymous.get(f"/api/records/{record['id']}").status_code == 401
    assert anonymous.get("/api/records").status_code == 401


# --- 3.5 list, filters, sort ------------------------------------------------------------------


@pytest.fixture
def library(owner):
    _, bob_id = join(owner)
    anna_id = owner.get("/api/auth/me").json()["id"]
    add(
        owner,
        "Kind of Blue",
        "Miles Davis",
        year=1959,
        label="Columbia",
        genres=["Jazz"],
        owner_id=anna_id,
    )
    add(
        owner,
        "Homogénic",
        "Björk",
        year=1997,
        label="One Little Indian",
        genres=["Electronic", "Pop"],
        owner_id=bob_id,
    )
    add(owner, "Blue Train", "John Coltrane", year=1958, label="Blue Note", genres=["Jazz"])
    add(owner, "Abbey Road", "The Beatles", year=1969, label="Apple", genres=["Rock"])
    add(owner, "Mystery", "Unknown")  # no year, label or genre
    return {"anna": anna_id, "bob": bob_id}


def titles(response):
    return [r["title"] for r in response.json()["items"]]


def test_search_matches_title_or_artist_ignoring_case_and_accents(owner, library):
    assert titles(owner.get("/api/records", params={"q": "BJORK"})) == ["Homogénic"]
    assert titles(owner.get("/api/records", params={"q": "homogenic"})) == ["Homogénic"]
    assert sorted(titles(owner.get("/api/records", params={"q": "blue"}))) == [
        "Blue Train",
        "Kind of Blue",
    ]
    assert titles(owner.get("/api/records", params={"q": "coltr"})) == ["Blue Train"]


def test_filter_by_owner_including_shared(owner, library):
    assert titles(owner.get("/api/records", params={"owner": library["anna"]})) == ["Kind of Blue"]
    assert titles(owner.get("/api/records", params={"owner": library["bob"]})) == ["Homogénic"]
    assert sorted(titles(owner.get("/api/records", params={"owner": "shared"}))) == [
        "Abbey Road",
        "Blue Train",
        "Mystery",
    ]


def test_filter_by_genre_decade_and_label(owner, library):
    assert sorted(titles(owner.get("/api/records", params={"genre": "Jazz"}))) == [
        "Blue Train",
        "Kind of Blue",
    ]
    assert titles(owner.get("/api/records", params={"decade": 1990})) == ["Homogénic"]
    assert titles(owner.get("/api/records", params={"label": "blue note"})) == ["Blue Train"]


def test_filters_combine_and_report_the_count(owner, library):
    r = owner.get("/api/records", params={"genre": "Jazz", "decade": 1950, "owner": "shared"})
    assert r.json()["total"] == 1 and titles(r) == ["Blue Train"]


def test_no_results_is_an_empty_list(owner, library):
    r = owner.get("/api/records", params={"q": "zzzz"})
    assert r.status_code == 200
    assert r.json() == {"items": [], "total": 0, "offset": 0, "limit": 10}


def test_invalid_owner_filter_is_rejected(owner, library):
    assert owner.get("/api/records", params={"owner": "not-a-uuid"}).status_code == 422


def test_sorting(owner, library):
    by = lambda **p: titles(owner.get("/api/records", params=p))  # noqa: E731
    assert by(sort="title") == ["Abbey Road", "Blue Train", "Homogénic", "Kind of Blue", "Mystery"]
    assert by(sort="title", order="desc")[0] == "Mystery"
    assert by(sort="artist")[:2] == ["Homogénic", "Blue Train"]  # Björk, John Coltrane
    assert by(sort="year") == ["Blue Train", "Kind of Blue", "Abbey Road", "Homogénic", "Mystery"]
    assert (
        by(sort="year", order="desc")[-1] == "Mystery"
    )  # records without a year go last either way
    assert by(sort="added", order="desc")[0] == "Mystery"


def test_paging(owner, library):
    first = owner.get("/api/records", params={"sort": "title", "limit": 2}).json()
    second = owner.get("/api/records", params={"sort": "title", "limit": 2, "offset": 2}).json()
    assert first["total"] == second["total"] == 5
    assert [r["title"] for r in first["items"]] == ["Abbey Road", "Blue Train"]
    assert [r["title"] for r in second["items"]] == ["Homogénic", "Kind of Blue"]


def test_a_page_reports_its_offset_limit_and_the_total_of_all_matches(owner, library):
    body = owner.get("/api/records", params={"genre": "Jazz", "limit": 1, "offset": 1}).json()
    assert body["total"] == 2 and body["offset"] == 1 and body["limit"] == 1
    assert len(body["items"]) == 1


def test_default_page_is_ten_records(owner):
    for i in range(12):
        add(owner, title=f"Album {i:02}", artist="Same")
    body = owner.get("/api/records").json()
    assert body["limit"] == 10 and len(body["items"]) == 10 and body["total"] == 12


@pytest.mark.parametrize("params", [{"limit": 500}, {"limit": 101}, {"limit": 0}, {"offset": -1}])
def test_page_bounds_are_checked(owner, params):
    r = owner.get("/api/records", params=params)
    assert r.status_code == 422
    assert r.json()["code"] == "invalid" and r.json()["field"] in params


def test_offset_past_the_end_gives_no_items_but_the_right_total(owner, library):
    body = owner.get("/api/records", params={"offset": 200, "limit": 10}).json()
    assert body["items"] == [] and body["total"] == 5


def test_every_record_appears_once_across_pages_even_with_equal_sort_keys(owner):
    for _ in range(7):
        add(owner, title="Same Title", artist="Same Artist", allow_duplicate=True)
    seen = []
    for offset in range(0, 7, 2):
        page = owner.get("/api/records", params={"limit": 2, "offset": offset}).json()
        seen += [r["id"] for r in page["items"]]
    assert len(seen) == 7 and len(set(seen)) == 7


def test_pages_only_count_live_records(owner):
    """One household per installation (see `one_household`), so scoping is to live records."""
    kept = add(owner, title="Kept")
    gone = add(owner, title="Gone")
    owner.delete(f"/api/records/{gone['id']}")
    body = owner.get("/api/records").json()
    assert body["total"] == 1 and [r["id"] for r in body["items"]] == [kept["id"]]


def test_a_page_costs_one_query_on_records(owner, library, count_queries):
    with count_queries() as log:
        assert owner.get("/api/records", params={"limit": 2}).status_code == 200
    assert len(log.on("records")) == 1


def test_options_describe_what_is_in_the_collection(owner, library):
    options = owner.get("/api/records/options").json()
    assert options["genres"] == ["Electronic", "Jazz", "Pop", "Rock"]
    assert options["decades"] == [1950, 1960, 1990]
    assert "Blue Note" in options["labels"]
    assert options["shared_count"] == 3 and options["total"] == 5
    counts = {o["display_name"]: o["count"] for o in options["owners"]}
    assert counts == {"Anna": 1, "Bob": 1}


def test_options_need_at_most_six_queries_on_records(owner, library, count_queries):
    with count_queries() as log:
        assert owner.get("/api/records/options").status_code == 200
    assert len(log.on("records")) <= 6


def test_five_hundred_records_answer_in_under_a_second(owner, db):
    user = db.scalars(__import__("sqlalchemy").select(User)).first()
    from app.services.records import normalise

    db.add_all(
        Record(
            household_id=user.household_id,
            title=f"Titolo {i}",
            artist=f"Artista {i % 40}",
            title_key=normalise(f"Titolo {i}"),
            artist_key=normalise(f"Artista {i % 40}"),
            year=1950 + i % 70,
            genres=["Rock"] if i % 2 else ["Jazz"],
            created_by=user.id,
        )
        for i in range(500)
    )
    db.commit()

    for params in ({}, {"q": "artista 7"}, {"genre": "Jazz", "decade": 1980, "sort": "year"}):
        start = time.perf_counter()
        response = owner.get("/api/records", params=params)
        elapsed = time.perf_counter() - start
        assert response.status_code == 200
        assert elapsed < 1.0, f"{params} took {elapsed:.2f}s"
    assert owner.get("/api/records", params={"limit": 100}).json()["total"] == 500


# --- 3.6 duplicates ---------------------------------------------------------------------------


def test_adding_the_same_title_and_artist_warns_and_adds_nothing(owner):
    first = add(owner)
    r = owner.post("/api/records", json={"title": "kind of  BLUE", "artist": "Miles Davis"})
    assert r.status_code == 409
    body = r.json()
    assert body["code"] == "duplicate" and body["existing"]["id"] == first["id"]
    assert owner.get("/api/records").json()["total"] == 1  # cancel path: nothing was added


def test_accents_and_punctuation_do_not_hide_a_duplicate(owner):
    add(owner, "Homogénic", "Björk")
    assert (
        owner.post("/api/records", json={"title": "Homogenic!", "artist": "Bjork"}).status_code
        == 409
    )


def test_adding_another_copy_on_purpose(owner):
    add(owner)
    r = owner.post(
        "/api/records",
        json={"title": "Kind of Blue", "artist": "Miles Davis", "allow_duplicate": True},
    )
    assert r.status_code == 201
    assert owner.get("/api/records").json()["total"] == 2


def test_same_discogs_release_is_a_duplicate_even_with_other_text(owner):
    add(owner, "Kind of Blue", "Miles Davis", discogs_release_id=555)
    r = owner.post(
        "/api/records",
        json={
            "title": "Kind Of Blue (Remastered)",
            "artist": "Miles Davis Quintet",
            "discogs_release_id": 555,
        },
    )
    assert r.status_code == 409


def test_a_removed_record_is_not_a_duplicate(owner):
    record = add(owner)
    owner.delete(f"/api/records/{record['id']}")
    assert (
        owner.post(
            "/api/records", json={"title": "Kind of Blue", "artist": "Miles Davis"}
        ).status_code
        == 201
    )


# --- 3.7 random -------------------------------------------------------------------------------


def seed(owner, n, **extra):
    return [add(owner, f"Disco {i}", f"Artista {i}", **extra)["id"] for i in range(n)]


def ids(response):
    return {r["id"] for r in response.json()}


def test_random_returns_the_requested_number(owner):
    seed(owner, 20)
    r = owner.get("/api/records/random", params={"count": 8})
    assert len(r.json()) == 8 and len(ids(r)) == 8


def test_random_avoids_the_excluded_ids(owner):
    everyone = seed(owner, 20)
    avoid = everyone[:8]
    for _ in range(5):
        r = owner.get("/api/records/random", params={"count": 8, "exclude": ",".join(avoid)})
        assert not ids(r) & set(avoid)


def test_random_follows_the_filters(owner):
    _, bob_id = join(owner)
    seed(owner, 12, owner_id=bob_id)
    for i in range(12):
        add(owner, f"Condiviso {i}", f"Altro {i}")
    r = owner.get("/api/records/random", params={"count": 8, "owner": bob_id})
    assert len(r.json()) == 8 and {x["owner_id"] for x in r.json()} == {bob_id}
    shared = owner.get("/api/records/random", params={"count": 8, "owner": "shared"})
    assert {x["owner_id"] for x in shared.json()} == {None}


def test_random_still_fills_the_shelf_when_the_collection_is_8_or_9(owner):
    everyone = seed(owner, 8)
    r = owner.get("/api/records/random", params={"count": 8, "exclude": ",".join(everyone)})
    assert len(r.json()) == 8  # repeats allowed rather than showing fewer

    ninth = add(owner, "Nono", "Disco")["id"]
    r = owner.get("/api/records/random", params={"count": 8, "exclude": ",".join(everyone)})
    assert len(r.json()) == 8 and ninth in ids(r)  # the only fresh one comes first, then repeats


def test_random_on_a_small_or_empty_collection(owner):
    assert owner.get("/api/records/random").json() == []
    seed(owner, 3)
    assert len(owner.get("/api/records/random", params={"count": 8}).json()) == 3


def test_random_ignores_removed_records(owner):
    everyone = seed(owner, 9)
    owner.delete(f"/api/records/{everyone[0]}")
    for _ in range(5):
        assert everyone[0] not in ids(owner.get("/api/records/random", params={"count": 8}))


def test_random_rejects_a_bad_exclude_list(owner):
    assert owner.get("/api/records/random", params={"exclude": "nope"}).status_code == 422
