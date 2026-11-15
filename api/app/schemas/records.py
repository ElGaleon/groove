import uuid
from datetime import date as Date
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import Channel, _clean, _dedupe


class PurchaseOut(BaseModel):
    amount_minor: int | None
    currency: str
    date: Date | None
    location_id: uuid.UUID | None
    channel: Channel | None


class ValueOut(BaseModel):
    amount_minor: int
    currency: str
    source: Literal["manual", "discogs"]
    measure: str | None
    fetched_at: datetime
    num_for_sale: int | None


class PurchaseIn(BaseModel):
    amount_minor: int | None = Field(default=None, ge=0)
    currency: str = Field(default="EUR", min_length=3, max_length=3, pattern="^[A-Za-z]{3}$")
    date: Date | None = None
    location_id: uuid.UUID | None = None
    channel: Channel | None = None

    @field_validator("currency")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.upper()


class ValueIn(BaseModel):
    amount_minor: int = Field(ge=0)
    currency: str = Field(default="EUR", min_length=3, max_length=3, pattern="^[A-Za-z]{3}$")
    source: Literal["manual", "discogs"] = "manual"
    measure: str | None = Field(default=None, max_length=100)
    num_for_sale: int | None = Field(default=None, ge=0)

    @field_validator("currency")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.upper()


class RecordOut(BaseModel):
    id: uuid.UUID
    title: str
    artist: str
    year: int | None
    label: str | None
    genres: list[str]
    format: str | None
    note: str | None
    catalog_no: str | None
    country: str | None
    purchase: PurchaseOut | None
    value: ValueOut | None
    owner_id: uuid.UUID | None  # None means shared by the family
    has_cover: bool
    cover_version: int | None  # changes when the cover changes, to refresh caches
    has_back_cover: bool
    discogs_release_id: int | None
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class RecordList(BaseModel):
    """One page of records; `total` counts every match, not just this page."""

    items: list[RecordOut]
    total: int
    offset: int
    limit: int


class RecordFields(BaseModel):
    year: int | None = Field(default=None, ge=1800, le=2100)
    label: str | None = Field(default=None, max_length=200)
    genres: list[str] = Field(default_factory=list, max_length=30)
    format: str | None = Field(default=None, max_length=100)
    note: str | None = Field(default=None, max_length=5000)
    catalog_no: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, max_length=100)
    purchase: PurchaseIn | None = None
    value: ValueIn | None = None
    owner_id: uuid.UUID | None = None

    @field_validator("label", "format", "note", "catalog_no", "country")
    @classmethod
    def _blank_to_none(cls, v: str | None) -> str | None:
        return _clean(v)

    @field_validator("genres")
    @classmethod
    def _clean_genres(cls, v: list[str]) -> list[str]:
        return _dedupe(v)


class RecordCreate(RecordFields):
    title: str = Field(min_length=1, max_length=300)
    artist: str = Field(min_length=1, max_length=300)
    discogs_release_id: int | None = None
    allow_duplicate: bool = False

    @field_validator("title", "artist")
    @classmethod
    def _required_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("required")
        return v


class RecordUpdate(RecordFields):
    """Partial update: only fields that are sent are changed (owner_id null clears the owner)."""

    title: str | None = Field(default=None, min_length=1, max_length=300)
    artist: str | None = Field(default=None, min_length=1, max_length=300)
    genres: list[str] | None = None

    @field_validator("title", "artist")
    @classmethod
    def _required_text(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("required")
        return v

    @field_validator("genres")
    @classmethod
    def _clean_genres(cls, v: list[str] | None) -> list[str] | None:  # replaces the parent's
        return None if v is None else _dedupe(v)


class OwnerCount(BaseModel):
    id: uuid.UUID
    display_name: str
    count: int


class RecordOptions(BaseModel):
    genres: list[str]
    decades: list[int]
    labels: list[str]
    countries: list[str]
    formats: list[str]
    years: list[int]
    owners: list[OwnerCount]
    shared_count: int
    total: int


class RefreshOut(BaseModel):
    status: Literal["updated", "unchanged", "proposal", "no_value"]
    record: RecordOut
    proposal: ValueOut | None = None
