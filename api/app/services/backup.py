"""Backup of the household's collection as one JSON file, and import of such a file.

The format is the one the original browser prototype exports: `{version, vinyls, locations}`
with camelCase fields. Importing only ever ADDS: records already in the collection are skipped
and nothing is deleted or overwritten. A file with any invalid entry changes nothing.
"""

import uuid
from datetime import date, datetime

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from app.core.clock import utcnow
from app.core.errors import AppError
from app.models import Location, Record, User
from app.schemas import LocationIn
from app.schemas.backup import BackupFile, ImportResult
from app.services.records import find_duplicate, normalise


def invalid_backup() -> AppError:
    return AppError(422, "invalid_backup", "Invalid backup file: the collection was not modified")


def build_export(db: DbSession, user: User) -> dict:
    """The collection as a backup file (no covers, no tokens, owners by display name only)."""
    members = {
        m.id: m.display_name
        for m in db.scalars(select(User).where(User.household_id == user.household_id))
    }
    locations = db.scalars(
        select(Location).where(Location.household_id == user.household_id).order_by(Location.name)
    ).all()
    records = db.scalars(
        select(Record)
        .where(Record.household_id == user.household_id, Record.deleted_at.is_(None))
        .order_by(Record.created_at)
    ).all()

    def vinyl(r: Record) -> dict:
        out: dict = {
            "id": str(r.id),
            "title": r.title,
            "artist": r.artist,
            "version": {
                k: v
                for k, v in {
                    "label": r.label,
                    "catalogNo": r.catalog_no,
                    "year": r.year,
                    "country": r.country,
                    "format": r.format,
                    "notes": r.note,
                }.items()
                if v is not None
            },
            "genres": list(r.genres or []),
            "createdAt": r.created_at.isoformat(),
        }
        if r.owner_id in members:
            out["owner"] = members[r.owner_id]
        if r.purchase_currency is not None:
            out["purchase"] = {
                k: v
                for k, v in {
                    "amountMinor": r.purchase_amount_minor,
                    "currency": r.purchase_currency,
                    "date": r.purchase_date.isoformat() if r.purchase_date else None,
                    "locationId": str(r.purchase_location_id) if r.purchase_location_id else None,
                    "channel": r.purchase_channel,
                }.items()
                if v is not None
            }
        if r.value_amount_minor is not None and r.value_currency:
            out["value"] = {
                k: v
                for k, v in {
                    "amountMinor": r.value_amount_minor,
                    "currency": r.value_currency,
                    "source": r.value_source or "manual",
                    "measure": r.value_measure,
                    "fetchedAt": r.value_fetched_at.isoformat() if r.value_fetched_at else None,
                    "numForSale": r.value_num_for_sale,
                }.items()
                if v is not None
            }
        if r.discogs_release_id:
            out["discogs"] = {"releaseId": r.discogs_release_id}
        return out

    body = {
        "version": 1,
        "exportedAt": utcnow().isoformat(),
        "vinyls": [vinyl(r) for r in records],
        "locations": [
            {
                k: v
                for k, v in {
                    "id": str(loc.id),
                    "name": loc.name,
                    "kind": loc.kind,
                    "address": loc.address,
                    "lat": loc.lat,
                    "lng": loc.lng,
                    "url": loc.url,
                }.items()
                if v is not None
            }
            for loc in locations
        ],
    }
    return body


def import_backup_file(db: DbSession, user: User, payload: dict, shared: bool) -> ImportResult:
    """Add the records and places of a backup file. Existing ones are kept; nothing is deleted."""
    try:
        data = BackupFile.model_validate(payload)
        places = {}
        for loc in data.locations:
            places[loc.id] = LocationIn(
                name=loc.name,
                kind=loc.kind,
                address=loc.address,
                lat=loc.lat,
                lng=loc.lng,
                url=loc.url,
            )
    except ValidationError:
        raise invalid_backup() from None

    members = {
        m.display_name.strip().lower(): m.id
        for m in db.scalars(select(User).where(User.household_id == user.household_id))
    }
    existing = db.scalars(select(Location).where(Location.household_id == user.household_id)).all()
    by_key = {(loc.name.strip().lower(), loc.kind): loc for loc in existing}
    location_for: dict[str, Location] = {}
    added_loc = reused_loc = 0
    for file_id, data_in in places.items():
        key = (data_in.name.strip().lower(), data_in.kind)
        found = by_key.get(key)
        if found is None:
            found = Location(
                household_id=user.household_id,
                name=data_in.name,
                kind=data_in.kind,
                address=data_in.address,
                lat=data_in.lat,
                lng=data_in.lng,
                url=data_in.url,
            )
            db.add(found)
            db.flush()
            by_key[key] = found
            added_loc += 1
        else:
            reused_loc += 1
        location_for[file_id] = found

    added = skipped = 0
    for v in data.vinyls:
        if find_duplicate(
            db,
            user.household_id,
            v.title,
            v.artist,
            v.discogs.releaseId if v.discogs else None,
            catalog_no=v.version.catalogNo,
        ):
            skipped += 1
            continue
        owner_id = None if shared else user.id
        if v.owner and v.owner.strip().lower() in members:
            owner_id = members[v.owner.strip().lower()]
        record = Record(
            id=uuid.uuid4(),
            household_id=user.household_id,
            title=v.title,
            artist=v.artist,
            title_key=normalise(v.title),
            artist_key=normalise(v.artist),
            year=v.version.year,
            label=v.version.label,
            format=v.version.format,
            catalog_no=v.version.catalogNo,
            country=v.version.country,
            note=v.version.notes,
            genres=[g.strip() for g in v.genres if g.strip()],
            owner_id=owner_id,
            discogs_release_id=v.discogs.releaseId if v.discogs else None,
            created_by=user.id,
        )
        if v.purchase is not None:
            loc = location_for.get(v.purchase.locationId or "")
            record.purchase_amount_minor = v.purchase.amountMinor
            record.purchase_currency = v.purchase.currency.upper()
            record.purchase_date = date.fromisoformat(v.purchase.date) if v.purchase.date else None
            if loc is not None:
                record.purchase_location_id = loc.id
                record.purchase_channel = (
                    loc.kind if loc.kind != "both" else (v.purchase.channel or "physical")
                )
        if v.value is not None:
            record.value_amount_minor = v.value.amountMinor
            record.value_currency = v.value.currency.upper()
            record.value_source = v.value.source
            record.value_measure = v.value.measure
            record.value_num_for_sale = v.value.numForSale
            try:
                record.value_fetched_at = (
                    datetime.fromisoformat(v.value.fetchedAt.replace("Z", "+00:00"))
                    if v.value.fetchedAt
                    else None
                )
            except ValueError:
                record.value_fetched_at = None
        db.add(record)
        db.flush()
        added += 1
    db.commit()
    return ImportResult(
        records_added=added,
        records_skipped=skipped,
        locations_added=added_loc,
        locations_reused=reused_loc,
    )
