import uuid

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.common import _URL, LocationKind, _clean


class LocationIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    kind: LocationKind
    address: str | None = Field(default=None, max_length=300)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    url: str | None = Field(default=None, max_length=500)

    @field_validator("name", "address", "url")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        return _clean(v)

    @model_validator(mode="after")
    def _by_kind(self) -> "LocationIn":
        if not self.name:
            raise ValueError("name")
        if self.kind in ("physical", "both") and not self.address:
            raise ValueError("address")
        if self.kind in ("online", "both") and not (self.url and _URL.match(self.url)):
            raise ValueError("url")
        if self.kind == "online":
            self.address, self.lat, self.lng = None, None, None
        if self.kind == "physical":
            self.url = None
        return self


class LocationUpdate(LocationIn):
    """Same rules as creation: the whole location is sent."""


class LocationOut(BaseModel):
    id: uuid.UUID
    name: str
    kind: LocationKind
    address: str | None
    lat: float | None
    lng: float | None
    url: str | None


class ReassignIn(BaseModel):
    to: uuid.UUID
