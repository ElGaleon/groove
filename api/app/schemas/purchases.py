import uuid

from pydantic import BaseModel

from app.schemas.locations import LocationOut


class CurrencyTotals(BaseModel):
    currency: str
    spent: int
    value: int
    diff: int
    included: int
    excluded: int


class RecordSummary(BaseModel):
    total: int
    totals: list[CurrencyTotals]
    without_data: int  # records with neither a purchase amount nor a value


class PlaceRecord(BaseModel):
    id: uuid.UUID
    title: str
    artist: str
    amount_minor: int | None
    currency: str | None


class PlaceStats(BaseModel):
    location: LocationOut
    count: int
    spent: dict[str, int]
    records: list[PlaceRecord]


class PlacesOut(BaseModel):
    years: list[str]
    mapped: list[PlaceStats]
    unmapped: list[PlaceStats]
    online: list[PlaceStats]
