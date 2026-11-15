"""Where the purchases were made: the data behind the map."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session as DbSession

from app.models import Location, Record, User
from app.schemas import PlaceRecord, PlacesOut, PlaceStats
from app.services.locations import to_out
from app.services.records import effective_channel


def places(db: DbSession, user: User, year: int | None) -> PlacesOut:
    """Places with purchases, grouped for the map: physical with coordinates, without, online."""
    live = (
        Record.household_id == user.household_id,
        Record.deleted_at.is_(None),
        Record.purchase_location_id.is_not(None),
    )
    years = sorted(
        {
            str(y)
            for y in db.scalars(
                select(func.extract("year", Record.purchase_date))
                .where(*live, Record.purchase_date.is_not(None))
                .distinct()
            )
        },
        reverse=True,
    )
    stmt = select(Record).where(*live)
    if year is not None:
        stmt = stmt.where(func.extract("year", Record.purchase_date) == year)
    locations = {
        loc.id: loc
        for loc in db.scalars(select(Location).where(Location.household_id == user.household_id))
    }
    physical: dict = {}
    online: dict = {}
    for record in db.scalars(
        stmt.order_by(Record.purchase_date.desc().nulls_last(), Record.title_key)
    ):
        loc = locations.get(record.purchase_location_id)
        if loc is None:
            continue
        group = online if effective_channel(loc, record.purchase_channel) == "online" else physical
        stat = group.setdefault(loc.id, {"loc": loc, "records": [], "spent": {}})
        stat["records"].append(
            PlaceRecord(
                id=record.id,
                title=record.title,
                artist=record.artist,
                amount_minor=record.purchase_amount_minor,
                currency=record.purchase_currency,
            )
        )
        if record.purchase_amount_minor is not None:
            cur = record.purchase_currency or "EUR"
            stat["spent"][cur] = stat["spent"].get(cur, 0) + record.purchase_amount_minor

    def build(stat) -> PlaceStats:
        return PlaceStats(
            location=to_out(stat["loc"]),
            count=len(stat["records"]),
            spent=stat["spent"],
            records=stat["records"],
        )

    def order(items) -> list[PlaceStats]:
        return sorted((build(s) for s in items), key=lambda p: (-p.count, p.location.name.lower()))

    mapped = [s for s in physical.values() if s["loc"].lat is not None and s["loc"].lng is not None]
    unmapped = [s for s in physical.values() if s["loc"].lat is None or s["loc"].lng is None]
    return PlacesOut(
        years=years, mapped=order(mapped), unmapped=order(unmapped), online=order(online.values())
    )
