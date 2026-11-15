from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session as DbSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models import User
from app.schemas import PlacesOut
from app.services import purchases as service

router = APIRouter(prefix="/api/purchases", tags=["purchases"])


@router.get("/places", response_model=PlacesOut)
def places(
    year: int | None = Query(default=None, ge=1800, le=2100),
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> PlacesOut:
    """Places with purchases, grouped for the map: physical with coordinates, without, online."""
    return service.places(db, user, year)
