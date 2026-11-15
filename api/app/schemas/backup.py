"""The backup file (the format exported by the browser prototype) and the import result."""

import re
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

MAX_ITEMS = 20000
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _str(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    return v or None


class _Base(BaseModel):
    model_config = ConfigDict(extra="ignore")


class BVersion(_Base):
    label: str | None = Field(default=None, max_length=200)
    catalogNo: str | None = Field(default=None, max_length=100)
    year: int | None = Field(default=None, ge=1800, le=2100)
    country: str | None = Field(default=None, max_length=100)
    format: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=5000)

    _clean = field_validator("label", "catalogNo", "country", "format", "notes")(_str)


class BPurchase(_Base):
    amountMinor: int | None = Field(default=None, ge=0)
    currency: str = Field(min_length=3, max_length=3, pattern="^[A-Za-z]{3}$")
    date: str | None = None
    locationId: str | None = None
    channel: Literal["physical", "online"] | None = None

    @field_validator("date")
    @classmethod
    def _date(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if not _DATE.match(v):
            raise ValueError("date")
        date.fromisoformat(v)
        return v


class BValue(_Base):
    amountMinor: int = Field(ge=0)
    currency: str = Field(min_length=3, max_length=3, pattern="^[A-Za-z]{3}$")
    source: Literal["discogs", "manual"]
    measure: str | None = Field(default=None, max_length=100)
    fetchedAt: str | None = None
    numForSale: int | None = Field(default=None, ge=0)


class BDiscogs(_Base):
    releaseId: int


class BVinyl(_Base):
    id: str
    title: str = Field(min_length=1, max_length=300)
    artist: str = Field(min_length=1, max_length=300)
    version: BVersion = Field(default_factory=BVersion)
    purchase: BPurchase | None = None
    value: BValue | None = None
    discogs: BDiscogs | None = None
    genres: list[str] = Field(default_factory=list, max_length=30)  # extension of the prototype
    owner: str | None = None  # display name of the owner (extension), shared when absent

    @field_validator("title", "artist")
    @classmethod
    def _required(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("required")
        return v


class BLocation(_Base):
    id: str
    name: str
    kind: Literal["physical", "online", "both"]
    address: str | None = None
    lat: float | None = None
    lng: float | None = None
    url: str | None = None


class BackupFile(_Base):
    version: int = 1
    vinyls: list[BVinyl] = Field(max_length=MAX_ITEMS)
    locations: list[BLocation] = Field(max_length=MAX_ITEMS)


class ImportResult(BaseModel):
    records_added: int
    records_skipped: int
    locations_added: int
    locations_reused: int
