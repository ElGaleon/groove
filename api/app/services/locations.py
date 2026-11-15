"""Places where records are bought (shops, markets, websites), shared by the household."""

import uuid

from fastapi import status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session as DbSession

from app.core.errors import AppError
from app.models import Location, Record, User
from app.schemas import LocationIn, LocationOut, LocationUpdate


def to_out(loc: Location) -> LocationOut:
    return LocationOut(
        id=loc.id,
        name=loc.name,
        kind=loc.kind,
        address=loc.address,
        lat=loc.lat,
        lng=loc.lng,
        url=loc.url,
    )


def get(db: DbSession, user: User, location_id: uuid.UUID) -> Location:
    loc = db.get(Location, location_id)
    if loc is None or loc.household_id != user.household_id:
        raise AppError(status.HTTP_404_NOT_FOUND, "location_not_found", "Location not found")
    return loc


def usage(db: DbSession, location_id: uuid.UUID) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(Record)
            .where(Record.purchase_location_id == location_id, Record.deleted_at.is_(None))
        )
        or 0
    )


def search(db: DbSession, user: User, q: str | None) -> list[Location]:
    stmt = select(Location).where(Location.household_id == user.household_id)
    if q and q.strip():
        stmt = stmt.where(func.lower(Location.name).like(f"%{q.strip().lower()}%"))
    return list(db.scalars(stmt.order_by(func.lower(Location.name))))


def create(db: DbSession, user: User, body: LocationIn) -> Location:
    loc = Location(household_id=user.household_id, **body.model_dump())
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc


def update_location(
    db: DbSession, user: User, location_id: uuid.UUID, body: LocationUpdate
) -> Location:
    """The whole location is sent, so the kind rules are checked on the final state."""
    loc = get(db, user, location_id)
    for name, value in body.model_dump().items():
        setattr(loc, name, value)
    db.commit()
    db.refresh(loc)
    return loc


def reassign(db: DbSession, user: User, location_id: uuid.UUID, to: uuid.UUID) -> None:
    """Move every purchase of a location to another one (so the first can be deleted)."""
    source = get(db, user, location_id)
    target = get(db, user, to)
    if source.id == target.id:
        raise AppError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "choose_different_location",
            "Choose a different location",
        )
    channel = target.kind if target.kind != "both" else "physical"
    db.execute(
        update(Record)
        .where(Record.purchase_location_id == source.id)
        .values(purchase_location_id=target.id, purchase_channel=channel)
    )
    db.commit()


def delete_location(db: DbSession, user: User, location_id: uuid.UUID) -> None:
    loc = get(db, user, location_id)
    count = usage(db, loc.id)
    if count:
        raise AppError(
            status.HTTP_409_CONFLICT,
            "in_use",
            f"The location is used by {count} record(s)",
            count=count,
        )
    # Records removed (soft delete) keep the reference: release it so the place can go.
    db.execute(
        update(Record)
        .where(Record.purchase_location_id == loc.id, Record.deleted_at.is_not(None))
        .values(purchase_location_id=None, purchase_channel=None)
    )
    db.delete(loc)
    db.commit()
