"""Records of the household: listing, create, edit, remove and undo, value refresh, covers."""

import uuid
from datetime import timedelta

from fastapi import status
from sqlalchemy import func, select
from sqlalchemy.orm import Session as DbSession

from app.core.clock import utcnow
from app.core.config import Settings
from app.core.errors import AppError
from app.core.money import fraction_digits
from app.integrations.discogs.client import DiscogsError, DiscogsUnauthorized
from app.models import Record, User
from app.schemas import RecordCreate, RecordList, RecordUpdate, RefreshOut, ValueIn
from app.services import covers
from app.services.discogs_connection import client_for_connection, require_active_connection
from app.services.records import (
    SORTS,
    RecordFilters,
    apply_filters,
    apply_purchase,
    apply_value,
    find_duplicate,
    normalise,
    record_out,
    require_member_owner,
    value_out_from_input,
)


class DuplicateRecord(Exception):
    """Creating a record that looks like one already in the collection."""

    def __init__(self, existing: Record):
        self.existing = existing


def get_record(
    db: DbSession, user: User, record_id: uuid.UUID, include_deleted: bool = False
) -> Record:
    record = db.get(Record, record_id)
    if (
        record is None
        or record.household_id != user.household_id
        or (record.deleted_at is not None and not include_deleted)
    ):
        raise AppError(status.HTTP_404_NOT_FOUND, "record_not_found", "Record not found")
    return record


def list_page(
    db: DbSession,
    user: User,
    filters: RecordFilters,
    sort: str,
    order: str,
    offset: int,
    limit: int,
) -> RecordList:
    """One page plus the total in a single query; a count runs only when the page is empty."""
    base = apply_filters(select(Record), user.household_id, filters)
    ordering = [c.desc() if order == "desc" else c.asc() for c in SORTS[sort]]
    if sort == "year":
        ordering[0] = ordering[0].nulls_last()
    paged = (
        base.add_columns(func.count().over().label("total"))
        .order_by(*ordering, Record.id)
        .offset(offset)
        .limit(limit)
    )
    rows = db.execute(paged).all()
    if rows:
        total = rows[0].total
    else:
        total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    return RecordList(
        items=[record_out(r.Record) for r in rows], total=total, offset=offset, limit=limit
    )


def parse_excluded(exclude: str) -> set[uuid.UUID]:
    try:
        return {uuid.UUID(x) for x in exclude.split(",") if x.strip()}
    except ValueError:
        raise AppError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "invalid_exclude_list",
            "The exclude list is not valid",
        ) from None


def create(db: DbSession, user: User, body: RecordCreate) -> Record:
    require_member_owner(db, user.household_id, body.owner_id)
    if not body.allow_duplicate:
        existing = find_duplicate(
            db,
            user.household_id,
            body.title,
            body.artist,
            body.discogs_release_id,
            catalog_no=body.catalog_no,
        )
        if existing is not None:
            raise DuplicateRecord(existing)
    record = Record(
        household_id=user.household_id,
        title=body.title,
        artist=body.artist,
        title_key=normalise(body.title),
        artist_key=normalise(body.artist),
        year=body.year,
        label=body.label,
        genres=body.genres,
        format=body.format,
        note=body.note,
        catalog_no=body.catalog_no,
        country=body.country,
        owner_id=body.owner_id,
        discogs_release_id=body.discogs_release_id,
        created_by=user.id,
    )
    apply_purchase(db, user.household_id, record, body.purchase)
    apply_value(record, body.value)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


_EDITABLE = (
    "title",
    "artist",
    "year",
    "label",
    "format",
    "note",
    "owner_id",
    "catalog_no",
    "country",
)


def update(db: DbSession, user: User, record_id: uuid.UUID, body: RecordUpdate) -> Record:
    record = get_record(db, user, record_id)
    sent = body.model_fields_set
    for name in ("title", "artist"):
        if name in sent and getattr(body, name) is None:
            raise AppError(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "required",
                f"Field {name} cannot be empty",
                field=name,
            )
    if "owner_id" in sent:
        require_member_owner(db, user.household_id, body.owner_id)
    for name in _EDITABLE:
        if name in sent:
            setattr(record, name, getattr(body, name))
    if "purchase" in sent:
        apply_purchase(db, user.household_id, record, body.purchase)
    if "value" in sent:
        apply_value(record, body.value)
    if "genres" in sent:
        record.genres = body.genres or []
    record.title_key = normalise(record.title)
    record.artist_key = normalise(record.artist)
    db.commit()
    db.refresh(record)
    return record


def remove(db: DbSession, user: User, record_id: uuid.UUID) -> None:
    """Soft delete: the record stays recoverable for a short time."""
    record = get_record(db, user, record_id)
    record.deleted_at = utcnow()
    db.commit()


def restore(db: DbSession, user: User, record_id: uuid.UUID, settings: Settings) -> Record:
    record = get_record(db, user, record_id, include_deleted=True)
    if record.deleted_at is None:
        return record
    if utcnow() - record.deleted_at > timedelta(seconds=settings.undo_seconds):
        raise AppError(status.HTTP_409_CONFLICT, "undo_expired", "The time to undo has passed")
    record.deleted_at = None
    db.commit()
    db.refresh(record)
    return record


def refresh_value(
    db: DbSession,
    user: User,
    record_id: uuid.UUID,
    currency: str | None,
    replace_manual: bool,
    settings: Settings,
) -> RefreshOut:
    """Update the value from Discogs. A value set by hand is never replaced unless asked."""
    record = get_record(db, user, record_id)
    if record.discogs_release_id is None:
        raise AppError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "not_linked_to_discogs",
            "The record is not linked to Discogs",
        )
    conn = require_active_connection(db, user)
    cur = (currency or record.value_currency or record.purchase_currency or "EUR").upper()
    client = client_for_connection(settings, conn)
    try:
        stats = client.marketplace_stats(record.discogs_release_id, cur)
    except DiscogsUnauthorized as exc:
        conn.status = "expired"
        db.commit()
        raise AppError(409, "discogs_expired", exc.message) from exc
    except DiscogsError as exc:
        raise AppError(502, "discogs_error", exc.message) from exc
    finally:
        client.close()

    lowest = stats.get("lowest_price")
    amount = lowest.get("value") if isinstance(lowest, dict) else lowest
    if amount is None:
        return RefreshOut(status="no_value", record=record_out(record))
    found = ValueIn(
        amount_minor=round(float(amount) * 10 ** fraction_digits(cur)),
        currency=(lowest.get("currency") if isinstance(lowest, dict) else None) or cur,
        source="discogs",
        measure="lowest_price_for_sale",
        num_for_sale=stats.get("num_for_sale"),
    )
    same = (
        record.value_amount_minor == found.amount_minor
        and record.value_currency == found.currency
        and record.value_source == "discogs"
    )
    if same:
        return RefreshOut(status="unchanged", record=record_out(record))
    if (
        record.value_source == "manual"
        and record.value_amount_minor is not None
        and not replace_manual
    ):
        out = RefreshOut(status="proposal", record=record_out(record))
        out.proposal = value_out_from_input(ValueIn.model_validate(found.model_dump()))
        return out
    apply_value(record, found)
    db.commit()
    db.refresh(record)
    return RefreshOut(status="updated", record=record_out(record))


def set_cover(
    db: DbSession, user: User, record_id: uuid.UUID, data: bytes, settings: Settings, *, back: bool
) -> Record:
    """Validate and store an uploaded sleeve picture; on a bad file the old one stays."""
    record = get_record(db, user, record_id)
    try:
        jpeg = covers.process_cover(data, settings)
    except covers.InvalidCover as error:
        raise AppError(status.HTTP_422_UNPROCESSABLE_CONTENT, error.code, str(error)) from None
    path = covers.save_cover(settings, record.id, jpeg, back=back)
    if back:
        record.back_cover_path = path
    else:
        record.cover_path = path
    record.updated_at = utcnow()
    db.commit()
    db.refresh(record)
    return record
