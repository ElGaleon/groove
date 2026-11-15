"""Request and response models of the Discogs endpoints."""

import uuid

from pydantic import BaseModel


class DiscogsStatus(BaseModel):
    configured: bool
    connected: bool
    status: str | None = None  # active | expired
    username: str | None = None


class ConnectOut(BaseModel):
    authorize_url: str


class ImportStart(BaseModel):
    shared: bool = False  # True: imported records have no owner


class ImportJobOut(BaseModel):
    id: uuid.UUID
    status: str  # pending | running | done | failed
    shared: bool
    total: int | None
    processed: int
    added: int
    message: str | None


class ExistingRecord(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID | None
    owner_name: str | None  # None means shared


class SearchResult(BaseModel):
    release_id: int
    title: str
    artist: str
    year: int | None
    label: str | None
    catalog_no: str | None = None
    country: str | None = None
    genres: list[str]
    format: str | None
    cover_url: str | None
    in_collection: ExistingRecord | None


class SearchOut(BaseModel):
    results: list[SearchResult]
    page: int = 1
    pages: int = 1


class CoverFromDiscogs(BaseModel):
    url: str


class Track(BaseModel):
    position: str = ""
    title: str
    duration: str = ""


class TracklistOut(BaseModel):
    available: bool
    tracks: list[Track] = []
    reason: str | None = None  # no_release | no_connection | unavailable | empty


class ReleaseValue(BaseModel):
    amount_minor: int | None  # None: no copies for sale, nothing is invented
    currency: str
    num_for_sale: int
    measure: str = "lowest_price_for_sale"
