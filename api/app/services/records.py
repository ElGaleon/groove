"""Record helpers shared by the routers: normalisation, filters, serialisation."""

import re
import unicodedata
import uuid
from dataclasses import dataclass

from fastapi import Query, status
from sqlalchemy import Select, and_, case, func, or_, select
from sqlalchemy.orm import Session as DbSession

from app.core.clock import utcnow
from app.core.errors import AppError
from app.models import Location, Record, User
from app.schemas import (
    CurrencyTotals,
    OwnerCount,
    PurchaseIn,
    PurchaseOut,
    RecordOptions,
    RecordOut,
    RecordSummary,
    ValueIn,
    ValueOut,
)

_NON_WORD = re.compile(r"[^\w]+", re.UNICODE)


def normalise(text: str | None) -> str:
    """Lowercase, drop accents and punctuation, collapse spaces.

    'Björk — Homogénic!' becomes 'bjork homogenic'.
    """
    if not text:
        return ""
    decomposed = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    return _NON_WORD.sub(" ", stripped.lower()).strip()


def purchase_out(record: Record) -> PurchaseOut | None:
    if (
        record.purchase_amount_minor is None
        and record.purchase_date is None
        and record.purchase_location_id is None
    ):
        return None
    return PurchaseOut(
        amount_minor=record.purchase_amount_minor,
        currency=record.purchase_currency or "EUR",
        date=record.purchase_date,
        location_id=record.purchase_location_id,
        channel=record.purchase_channel,
    )


def value_out(record: Record) -> ValueOut | None:
    if record.value_amount_minor is None:
        return None
    return ValueOut(
        amount_minor=record.value_amount_minor,
        currency=record.value_currency or "EUR",
        source=record.value_source or "manual",
        measure=record.value_measure,
        fetched_at=record.value_fetched_at or record.updated_at,
        num_for_sale=record.value_num_for_sale,
    )


def record_out(record: Record) -> RecordOut:
    return RecordOut(
        id=record.id,
        title=record.title,
        artist=record.artist,
        year=record.year,
        label=record.label,
        genres=record.genres or [],
        format=record.format,
        note=record.note,
        catalog_no=record.catalog_no,
        country=record.country,
        purchase=purchase_out(record),
        value=value_out(record),
        owner_id=record.owner_id,
        has_cover=record.cover_path is not None,
        cover_version=(
            int(record.updated_at.timestamp())
            if (record.cover_path or record.back_cover_path)
            else None
        ),
        has_back_cover=record.back_cover_path is not None,
        discogs_release_id=record.discogs_release_id,
        created_by=record.created_by,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def require_member_owner(
    db: DbSession, household_id: uuid.UUID, owner_id: uuid.UUID | None
) -> None:
    if owner_id is None:
        return
    owner = db.get(User, owner_id)
    if owner is None or owner.household_id != household_id:
        raise AppError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "invalid_owner",
            "Owner is not a member of the household",
        )


def apply_purchase(
    db: DbSession, household_id: uuid.UUID, record: Record, purchase: PurchaseIn | None
) -> None:
    """Replace the purchase of a record (None clears it). The channel follows the location kind."""
    if purchase is None:
        record.purchase_amount_minor = None
        record.purchase_currency = None
        record.purchase_date = None
        record.purchase_location_id = None
        record.purchase_channel = None
        return
    channel = None
    if purchase.location_id is not None:
        location = db.get(Location, purchase.location_id)
        if location is None or location.household_id != household_id:
            raise AppError(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "invalid_location",
                "Purchase location is not valid",
            )
        channel = location.kind if location.kind != "both" else (purchase.channel or "physical")
    record.purchase_amount_minor = purchase.amount_minor
    record.purchase_currency = purchase.currency
    record.purchase_date = purchase.date
    record.purchase_location_id = purchase.location_id
    record.purchase_channel = channel


def apply_value(record: Record, value: ValueIn | None) -> None:
    """Replace the current value (None clears it); the date is set by the server."""
    if value is None:
        record.value_amount_minor = None
        record.value_currency = None
        record.value_source = None
        record.value_measure = None
        record.value_fetched_at = None
        record.value_num_for_sale = None
        return
    record.value_amount_minor = value.amount_minor
    record.value_currency = value.currency
    record.value_source = value.source
    record.value_measure = value.measure
    record.value_fetched_at = utcnow()
    record.value_num_for_sale = value.num_for_sale


def value_out_from_input(value: ValueIn) -> ValueOut:
    """A value that is only proposed (not saved), shaped like a saved one."""
    return ValueOut(
        amount_minor=value.amount_minor,
        currency=value.currency,
        source=value.source,
        measure=value.measure,
        fetched_at=utcnow(),
        num_for_sale=value.num_for_sale,
    )


def effective_channel(location: Location, channel: str | None) -> str:
    """physical/online places imply the channel; a place with both uses the purchase's channel."""
    if location.kind in ("physical", "online"):
        return location.kind
    return channel or "physical"


def compute_summary(rows: list[tuple]) -> RecordSummary:
    """rows: (purchase_amount, purchase_currency, value_amount, value_currency) per record.

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


@dataclass
class RecordFilters:
    """Search and filters shared by the list and the random endpoints."""

    q: str | None = None
    owner: str = "any"  # "any", "shared", or a member id
    genre: str | None = None
    decade: int | None = None
    label: str | None = None
    country: str | None = None
    format: str | None = None
    year: int | None = None
    discogs: bool = False  # only records linked to a Discogs release


def filters_dep(
    q: str | None = Query(default=None, max_length=200),
    owner: str = Query(default="any"),
    genre: str | None = Query(default=None),
    decade: int | None = Query(default=None, ge=1800, le=2100),
    label: str | None = Query(default=None),
    country: str | None = Query(default=None),
    format: str | None = Query(default=None),
    year: int | None = Query(default=None, ge=1800, le=2100),
    discogs: bool = Query(default=False),
) -> RecordFilters:
    return RecordFilters(
        q=q,
        owner=owner,
        genre=genre,
        decade=decade,
        label=label,
        country=country,
        format=format,
        year=year,
        discogs=discogs,
    )


def apply_filters(stmt: Select, household_id: uuid.UUID, f: RecordFilters) -> Select:
    stmt = stmt.where(Record.household_id == household_id, Record.deleted_at.is_(None))
    if f.q:
        needle = normalise(f.q)
        if needle:
            like = f"%{needle}%"
            stmt = stmt.where(
                or_(
                    Record.title_key.like(like),
                    Record.artist_key.like(like),
                    func.lower(func.coalesce(Record.catalog_no, "")).like(
                        f"%{f.q.strip().lower()}%"
                    ),
                )
            )
    if f.owner == "shared":
        stmt = stmt.where(Record.owner_id.is_(None))
    elif f.owner != "any":
        try:
            stmt = stmt.where(Record.owner_id == uuid.UUID(f.owner))
        except ValueError:
            raise AppError(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "invalid_owner_filter",
                "Owner filter is not valid",
            ) from None
    if f.genre:
        stmt = stmt.where(Record.genres.contains([f.genre]))
    if f.decade is not None:
        decade = f.decade // 10 * 10
        stmt = stmt.where(and_(Record.year >= decade, Record.year <= decade + 9))
    if f.label:
        stmt = stmt.where(func.lower(Record.label) == f.label.lower())
    if f.country:
        stmt = stmt.where(func.lower(Record.country) == f.country.lower())
    if f.format:
        stmt = stmt.where(func.lower(Record.format) == f.format.lower())
    if f.year is not None:
        stmt = stmt.where(Record.year == f.year)
    if f.discogs:
        stmt = stmt.where(Record.discogs_release_id.is_not(None))
    return stmt


SORTS = {
    "title": (Record.title_key, Record.artist_key),
    "artist": (Record.artist_key, Record.title_key),
    "year": (Record.year, Record.title_key),
    "added": (Record.created_at,),
}


def find_duplicate(
    db: DbSession,
    household_id: uuid.UUID,
    title: str,
    artist: str,
    discogs_release_id: int | None = None,
    exclude_id: uuid.UUID | None = None,
    catalog_no: str | None = None,
) -> Record | None:
    """The same Discogs release, or the same title and artist and the same pressing.

    The pressing is told apart by catalogue number: when either record has one, they must match.
    """
    same_text = and_(Record.title_key == normalise(title), Record.artist_key == normalise(artist))
    condition = same_text
    if discogs_release_id is not None:
        condition = or_(same_text, Record.discogs_release_id == discogs_release_id)
    stmt = select(Record).where(
        Record.household_id == household_id, Record.deleted_at.is_(None), condition
    )
    if exclude_id is not None:
        stmt = stmt.where(Record.id != exclude_id)
    wanted = normalise(catalog_no)
    for candidate in db.scalars(stmt).all():
        if discogs_release_id is not None and candidate.discogs_release_id == discogs_release_id:
            return candidate
        have = normalise(candidate.catalog_no)
        if not wanted and not have:
            return candidate
        if wanted == have:
            return candidate
    return None


def collection_options(db: DbSession, household_id: uuid.UUID) -> RecordOptions:
    """Values for the filter controls, taken from what is actually in the collection.

    Six queries: genres, years (decades come from them), labels, countries, formats, counts.
    """
    live = (Record.household_id == household_id, Record.deleted_at.is_(None))

    def distinct_text(column) -> list[str]:
        values = db.scalars(select(column).where(*live, column.is_not(None)).distinct())
        return sorted({v for v in values if v}, key=str.lower)

    genre_rows = db.execute(
        select(func.unnest(Record.genres).label("g")).where(*live).distinct()
    ).scalars()
    genres = sorted({g for g in genre_rows if g}, key=str.lower)
    years = sorted(
        set(db.scalars(select(Record.year).where(*live, Record.year.is_not(None)).distinct())),
        reverse=True,
    )
    counts = dict(
        db.execute(
            select(Record.owner_id, func.count()).where(*live).group_by(Record.owner_id)
        ).all()
    )
    members = db.scalars(
        select(User).where(User.household_id == household_id).order_by(User.created_at)
    ).all()
    return RecordOptions(
        genres=genres,
        decades=sorted({y // 10 * 10 for y in years}),
        labels=distinct_text(Record.label),
        countries=distinct_text(Record.country),
        formats=distinct_text(Record.format),
        years=years,
        owners=[
            OwnerCount(id=m.id, display_name=m.display_name, count=counts.get(m.id, 0))
            for m in members
        ],
        shared_count=counts.get(None, 0),
        total=sum(counts.values()),
    )


def collection_summary(
    db: DbSession, household_id: uuid.UUID, filters: RecordFilters
) -> RecordSummary:
    """Spent, value and difference per currency over ALL matching records (not just one page).

    One GROUP BY in the database; the rule is the same as `compute_summary` (tests compare them).
    """
    base = apply_filters(select(Record), household_id, filters).subquery()
    p_amount, p_cur = base.c.purchase_amount_minor, base.c.purchase_currency
    v_amount, v_cur = base.c.value_amount_minor, base.c.value_currency
    key = case(
        (p_amount.is_not(None), p_cur),
        (v_amount.is_not(None), v_cur),
        else_=None,
    ).label("currency")
    included = and_(p_amount.is_not(None), v_amount.is_not(None), p_cur == v_cur)
    rows = db.execute(
        select(
            key,
            func.count().label("records"),
            func.count().filter(included).label("included"),
            func.coalesce(func.sum(p_amount).filter(included), 0).label("spent"),
            func.coalesce(func.sum(v_amount).filter(included), 0).label("value"),
        ).group_by(key)
    ).all()
    totals: list[CurrencyTotals] = []
    without_data = 0
    for row in rows:
        if row.currency is None:
            without_data += row.records
            continue
        totals.append(
            CurrencyTotals(
                currency=row.currency,
                spent=row.spent,
                value=row.value,
                diff=row.value - row.spent,
                included=row.included,
                excluded=row.records - row.included,
            )
        )
    return RecordSummary(
        total=sum(r.records for r in rows),
        totals=sorted(totals, key=lambda t: t.currency),
        without_data=without_data,
    )


def random_picks(
    db: DbSession,
    household_id: uuid.UUID,
    filters: RecordFilters,
    count: int,
    excluded: set[uuid.UUID],
) -> list[Record]:
    """A random pick that follows the filters and avoids `excluded` whenever enough others exist."""
    base = apply_filters(select(Record), household_id, filters)
    fresh = base.where(Record.id.not_in(excluded)) if excluded else base
    picked = list(db.scalars(fresh.order_by(func.random()).limit(count)).all())
    if len(picked) < count and excluded:
        # Repeats only to fill the shelf when the collection is too small to avoid them.
        again = (
            base.where(Record.id.in_(excluded)).order_by(func.random()).limit(count - len(picked))
        )
        picked += list(db.scalars(again).all())
    return picked
