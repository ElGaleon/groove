"""Backup of the collection as a JSON file, and import of such a file (rules: services.backup)."""

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session as DbSession

from app.api.deps import get_current_user
from app.core.clock import utcnow
from app.core.db import get_db
from app.core.errors import AppError
from app.models import User
from app.schemas.backup import ImportResult
from app.services import backup as service

router = APIRouter(prefix="/api/backup", tags=["backup"])

MAX_BYTES = 10 * 1024 * 1024


@router.get("")
def export_backup(user: User = Depends(get_current_user), db: DbSession = Depends(get_db)):
    """Download the collection as a JSON file."""
    stamp = utcnow().strftime("%Y-%m-%d")
    return JSONResponse(
        service.build_export(db, user),
        headers={"Content-Disposition": f'attachment; filename="collezione-{stamp}.json"'},
    )


@router.post("/import", response_model=ImportResult)
def import_backup(
    payload: dict,
    request: Request,
    shared: bool = Query(default=False, description="Imported records have no owner"),
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
):
    """Add the records and places of a backup file. Existing ones are kept; nothing is deleted."""
    if int(request.headers.get("content-length") or 0) > MAX_BYTES:
        raise AppError(413, "backup_too_large", "File too large")
    return service.import_backup_file(db, user, payload, shared)
