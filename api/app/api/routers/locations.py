import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session as DbSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models import User
from app.schemas import LocationIn, LocationOut, LocationUpdate, ReassignIn
from app.services import locations as service

router = APIRouter(prefix="/api/locations", tags=["locations"])


@router.get("", response_model=list[LocationOut])
def list_locations(
    q: str | None = Query(default=None, max_length=100),
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> list[LocationOut]:
    return [service.to_out(loc) for loc in service.search(db, user, q)]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=LocationOut)
def create_location(
    body: LocationIn, user: User = Depends(get_current_user), db: DbSession = Depends(get_db)
) -> LocationOut:
    return service.to_out(service.create(db, user, body))


@router.patch("/{location_id}", response_model=LocationOut)
def update_location(
    location_id: uuid.UUID,
    body: LocationUpdate,
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> LocationOut:
    return service.to_out(service.update_location(db, user, location_id, body))


@router.post("/{location_id}/reassign", status_code=status.HTTP_204_NO_CONTENT)
def reassign(
    location_id: uuid.UUID,
    body: ReassignIn,
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> None:
    """Move every purchase of this location to another one (so the first can be deleted)."""
    service.reassign(db, user, location_id, body.to)


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_location(
    location_id: uuid.UUID, user: User = Depends(get_current_user), db: DbSession = Depends(get_db)
) -> None:
    service.delete_location(db, user, location_id)
