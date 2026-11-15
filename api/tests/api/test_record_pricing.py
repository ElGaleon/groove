import pytest

from app.schemas import CurrencyTotals, RecordSummary
from tests.api.test_discogs_search import connected  # noqa: F401  (fixture)
from tests.api.test_records import add


def compute_summary(rows: list[tuple]) -> RecordSummary:
    """The totals rule in plain Python, the reference for the SQL version.

    rows: (purchase_amount, purchase_currency, value_amount, value_currency) per record.

    Totals are per currency and only count records with both amounts in that same currency.
    """
    by_currency: dict[str, CurrencyTotals] = {}
    without_data = 0
    for p_amount, p_cur, v_amount, v_cur in rows:
        if p_amount is None and v_amount is None:
            without_data += 1
            continue
        key = p_cur if p_amount is not None else v_cur
        if key is None:
            without_data += 1
            continue
        totals = by_currency.setdefault(
            key, CurrencyTotals(currency=key, spent=0, value=0, diff=0, included=0, excluded=0)
        )
        if p_amount is not None and v_amount is not None and p_cur == v_cur:
            totals.included += 1
            totals.spent += p_amount
            totals.value += v_amount
            totals.diff += v_amount - p_amount
        else:
            totals.excluded += 1
    return RecordSummary(
        total=len(rows),
        totals=sorted(by_currency.values(), key=lambda t: t.currency),
        without_data=without_data,
    )


def test_version_fields_and_two_pressings_are_not_duplicates(owner):
    a = add(owner, "Abbey Road", "The Beatles", catalog_no="PCS 7088", country="UK", year=1969)
    assert a["catalog_no"] == "PCS 7088" and a["country"] == "UK"
    # same title and artist, different catalogue number: a different pressing
    r = owner.post(
        "/api/records", json={"title": "Abbey Road", "artist": "The Beatles", "catalog_no": "B0030"}
    )
    assert r.status_code == 201


def test_same_pressing_is_a_duplicate_and_can_be_forced(owner):
    add(owner, "Abbey Road", "The Beatles", catalog_no="PCS 7088")
    payload = {"title": "abbey road", "artist": "the beatles", "catalog_no": "pcs  7088"}
    r = owner.post("/api/records", json=payload)
    assert r.status_code == 409 and r.json()["code"] == "duplicate"
    assert owner.post("/api/records", json={**payload, "allow_duplicate": True}).status_code == 201


def test_without_catalogue_numbers_the_old_rule_applies(owner):
    add(owner, "Kind of Blue", "Miles Davis")
    assert (
        owner.post(
            "/api/records", json={"title": "Kind of Blue", "artist": "Miles Davis"}
        ).status_code
        == 409
    )


def test_purchase_price_and_value_roundtrip(owner):
    r = add(
        owner,
        purchase={"amount_minor": 2490, "currency": "eur", "date": "2025-04-02"},
        value={"amount_minor": 4500, "currency": "EUR"},
    )
    assert r["purchase"] == {
        "amount_minor": 2490,
        "currency": "EUR",
        "date": "2025-04-02",
        "location_id": None,
        "channel": None,
    }
    assert (
        r["value"]["amount_minor"] == 4500
        and r["value"]["source"] == "manual"
        and r["value"]["fetched_at"]
    )
    again = owner.get(f"/api/records/{r['id']}").json()
    assert again["purchase"]["amount_minor"] == 2490


def test_negative_amounts_rejected(owner):
    for body in (
        {"purchase": {"amount_minor": -1}},
        {"value": {"amount_minor": -5, "currency": "EUR"}},
    ):
        r = owner.post("/api/records", json={"title": "X", "artist": "Y", **body})
        assert r.status_code == 422, r.text


def test_update_replaces_or_clears_purchase_and_value(owner):
    r = add(
        owner,
        purchase={"amount_minor": 1000, "currency": "EUR"},
        value={"amount_minor": 2000, "currency": "EUR"},
    )
    out = owner.patch(f"/api/records/{r['id']}", json={"purchase": None}).json()
    assert out["purchase"] is None and out["value"]["amount_minor"] == 2000  # untouched
    out = owner.patch(
        f"/api/records/{r['id']}", json={"value": {"amount_minor": 2500, "currency": "EUR"}}
    ).json()
    assert out["value"]["amount_minor"] == 2500
    out = owner.patch(f"/api/records/{r['id']}", json={"value": None}).json()
    assert out["value"] is None


def test_filters_and_options_by_country_format_year(owner):
    add(owner, "A", "X", country="UK", format="LP", year=1969)
    add(owner, "B", "X", country="Italy", format="LP", year=1969)
    add(owner, "C", "X", country="UK", format='7"', year=1980)
    titles = lambda q: sorted(i["title"] for i in owner.get(f"/api/records?{q}").json()["items"])  # noqa: E731
    assert titles("country=UK&format=LP") == ["A"]
    assert titles("year=1969") == ["A", "B"]
    assert titles("country=uk") == ["A", "C"]
    options = owner.get("/api/records/options").json()
    assert (
        options["countries"] == ["Italy", "UK"]
        and options["formats"] == ['7"', "LP"]
        and options["years"] == [1980, 1969]
    )


def test_search_by_catalogue_number(owner):
    add(owner, "Abbey Road", "The Beatles", catalog_no="PCS 7088")
    add(owner, "Other", "Someone")
    items = owner.get("/api/records?q=pcs 7088").json()["items"]
    assert [i["title"] for i in items] == ["Abbey Road"]


def test_summary_covers_all_records_not_one_page(owner):
    for i in range(60):  # more than a page (50 by default)
        add(
            owner,
            f"T{i}",
            "A",
            purchase={"amount_minor": 1000, "currency": "EUR"},
            value={"amount_minor": 1500, "currency": "EUR"},
        )
    add(owner, "NoPrice", "A", value={"amount_minor": 700, "currency": "EUR"})  # left out
    add(owner, "Nothing", "A")
    add(
        owner,
        "Usd",
        "A",
        purchase={"amount_minor": 1000, "currency": "USD"},
        value={"amount_minor": 900, "currency": "EUR"},
    )  # currencies differ
    s = owner.get("/api/records/summary").json()
    eur = next(t for t in s["totals"] if t["currency"] == "EUR")
    assert (
        eur["included"] == 60
        and eur["spent"] == 60000
        and eur["value"] == 90000
        and eur["diff"] == 30000
    )
    assert s["without_data"] == 1 and s["total"] == 63
    usd = next(t for t in s["totals"] if t["currency"] == "USD")
    assert usd["included"] == 0 and usd["excluded"] == 1


def test_summary_follows_filters(owner):
    add(
        owner,
        "A",
        "X",
        country="UK",
        purchase={"amount_minor": 1000, "currency": "EUR"},
        value={"amount_minor": 2000, "currency": "EUR"},
    )
    add(
        owner,
        "B",
        "X",
        country="IT",
        purchase={"amount_minor": 500, "currency": "EUR"},
        value={"amount_minor": 600, "currency": "EUR"},
    )
    s = owner.get("/api/records/summary?country=UK").json()
    assert s["totals"][0]["spent"] == 1000 and s["total"] == 1


# --- refresh from Discogs ----------------------------------------------------------------------


def _linked(owner, release_id=1001, **extra):
    return add(owner, discogs_release_id=release_id, **extra)


def test_refresh_sets_discogs_value(connected, discogs):  # noqa: F811
    rec = _linked(connected)
    discogs.stats[1001] = {"lowest_price": {"value": 61.5, "currency": "EUR"}, "num_for_sale": 42}
    out = connected.post(f"/api/records/{rec['id']}/refresh-value?currency=EUR").json()
    assert out["status"] == "updated" and out["record"]["value"]["source"] == "discogs"
    assert (
        out["record"]["value"]["amount_minor"] == 6150
        and out["record"]["value"]["num_for_sale"] == 42
    )
    again = connected.post(f"/api/records/{rec['id']}/refresh-value?currency=EUR").json()
    assert again["status"] == "unchanged"


def test_refresh_never_overwrites_manual_without_confirmation(connected, discogs):  # noqa: F811
    rec = _linked(connected, value={"amount_minor": 5000, "currency": "EUR"})
    discogs.stats[1001] = {"lowest_price": {"value": 61.5, "currency": "EUR"}, "num_for_sale": 3}
    out = connected.post(f"/api/records/{rec['id']}/refresh-value?currency=EUR").json()
    assert out["status"] == "proposal" and out["proposal"]["amount_minor"] == 6150
    assert (
        out["record"]["value"]["source"] == "manual"
        and out["record"]["value"]["amount_minor"] == 5000
    )
    done = connected.post(
        f"/api/records/{rec['id']}/refresh-value?currency=EUR&replace_manual=true"
    ).json()
    assert done["status"] == "updated" and done["record"]["value"]["source"] == "discogs"


def test_refresh_without_copies_or_release(connected, discogs):  # noqa: F811
    rec = _linked(connected, release_id=777)
    assert connected.post(f"/api/records/{rec['id']}/refresh-value").json()["status"] == "no_value"
    plain = add(connected, "Manual", "Only")
    assert connected.post(f"/api/records/{plain['id']}/refresh-value").status_code == 422


def test_refresh_needs_discogs_connection(owner):
    rec = owner.post(
        "/api/records", json={"title": "X", "artist": "Y", "discogs_release_id": 5}
    ).json()
    r = owner.post(f"/api/records/{rec['id']}/refresh-value")
    assert r.status_code == 409 and r.json()["code"] == "discogs_not_connected"


@pytest.mark.parametrize("status", [401])
def test_refresh_expired_token(connected, discogs, status):  # noqa: F811
    rec = _linked(connected)
    discogs.fail_next = [status]
    r = connected.post(f"/api/records/{rec['id']}/refresh-value")
    assert r.status_code == 409 and r.json()["code"] == "discogs_expired"


def test_filter_only_records_linked_to_discogs(owner):
    add(owner, "Linked", "X", discogs_release_id=11)
    add(owner, "Manual", "X")
    assert [i["title"] for i in owner.get("/api/records?discogs=true").json()["items"]] == [
        "Linked"
    ]
    assert owner.get("/api/records").json()["total"] == 2


def test_summary_in_sql_matches_the_python_rule(owner, db, count_queries):
    """The database GROUP BY and `compute_summary` agree on mixed data."""
    from sqlalchemy import select

    from app.models import Record, User
    from app.services.records import RecordFilters, collection_summary

    eur = lambda n: {"amount_minor": n, "currency": "EUR"}  # noqa: E731
    usd = lambda n: {"amount_minor": n, "currency": "USD"}  # noqa: E731
    add(owner, "Both EUR", "A", purchase=eur(1000), value=eur(1500))
    add(owner, "Both EUR 2", "A", purchase=eur(300), value=eur(100))
    add(owner, "Both USD", "A", purchase=usd(2000), value=usd(2500))
    add(owner, "Mixed", "A", purchase=usd(1000), value=eur(900))
    add(owner, "Only paid", "A", purchase=eur(400))
    add(owner, "Only value", "A", value=usd(700))
    add(owner, "Nothing", "A")
    add(owner, "Date only", "A", purchase={"currency": "EUR", "date": "2020-01-01"})

    household_id = db.scalars(select(User)).first().household_id
    rows = db.execute(
        select(
            Record.purchase_amount_minor,
            Record.purchase_currency,
            Record.value_amount_minor,
            Record.value_currency,
        ).where(Record.household_id == household_id)
    ).all()
    with count_queries() as log:
        in_sql = collection_summary(db, household_id, RecordFilters())
    assert in_sql == compute_summary([tuple(r) for r in rows])
    assert len(log.on("records")) == 1
    assert owner.get("/api/records/summary").json() == in_sql.model_dump()
