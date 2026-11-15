import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session as DbSession

from app.api.deps import get_current_user, settings_dep
from app.core.config import Settings
from app.core.db import get_db
from app.core.errors import AppError
from app.models import User
from app.schemas import (
    RecordCreate,
    RecordList,
    RecordOptions,
    RecordOut,
    RecordSummary,
    RecordUpdate,
    RefreshOut,
)
from app.services import collection as service
from app.services import covers
from app.services import records as lookup
from app.services.records import RecordFilters, filters_dep, record_out

router = APIRouter(prefix="/api/records", tags=["records"])


def _sleeve_response(request: Request, path, stored: str | None, code: str):
    """The picture of a sleeve, served to members only and cached privately."""
    if stored is None or not path.exists():
        raise AppError(status.HTTP_404_NOT_FOUND, code, "No such picture")
    stat = path.stat()
    etag = f'"{stat.st_mtime_ns:x}-{stat.st_size:x}"'
    headers = {"ETag": etag, "Cache-Control": "private, max-age=0, must-revalidate"}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers=headers)
    return FileResponse(path, media_type="image/jpeg", headers=headers)


# --- collection-level endpoints (declared before /{record_id}) --------------------------------


@router.get("", response_model=RecordList)
def list_records(
    filters: RecordFilters = Depends(filters_dep),
    sort: str = Query(default="artist", pattern="^(title|artist|year|added)$"),
    order: str = Query(default="asc", pattern="^(asc|desc)$"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> RecordList:
    return service.list_page(db, user, filters, sort, order, offset, limit)


@router.get("/options", response_model=RecordOptions)
def record_options(
    user: User = Depends(get_current_user), db: DbSession = Depends(get_db)
) -> RecordOptions:
    """Values for the filter controls, taken from what is actually in the collection."""
    return lookup.collection_options(db, user.household_id)


@router.get("/summary", response_model=RecordSummary)
def record_summary(
    filters: RecordFilters = Depends(filters_dep),
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> RecordSummary:
    """Spent, value and difference per currency over ALL matching records (not just one page)."""
    return lookup.collection_summary(db, user.household_id, filters)


@router.get("/random", response_model=list[RecordOut])
def random_records(
    count: int = Query(default=8, ge=1, le=50),
    exclude: str = Query(
        default="", description="Comma-separated ids to avoid (e.g. the last pick)"
    ),
    filters: RecordFilters = Depends(filters_dep),
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> list[RecordOut]:
    """A random pick that follows the filters and avoids `exclude` whenever enough others exist."""
    excluded = service.parse_excluded(exclude)
    return [
        record_out(r) for r in lookup.random_picks(db, user.household_id, filters, count, excluded)
    ]


# --- single record ----------------------------------------------------------------------------


@router.post("", status_code=status.HTTP_201_CREATED, response_model=RecordOut)
def create_record(
    body: RecordCreate,
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
):
    try:
        return record_out(service.create(db, user, body))
    except service.DuplicateRecord as dup:
        return JSONResponse(
            {
                "detail": "This record seems to be in the collection already.",
                "code": "duplicate",
                "existing": record_out(dup.existing).model_dump(mode="json"),
            },
            status_code=status.HTTP_409_CONFLICT,
        )


@router.get("/{record_id}", response_model=RecordOut)
def read_record(
    record_id: uuid.UUID, user: User = Depends(get_current_user), db: DbSession = Depends(get_db)
) -> RecordOut:
    return record_out(service.get_record(db, user, record_id))


@router.patch("/{record_id}", response_model=RecordOut)
def update_record(
    record_id: uuid.UUID,
    body: RecordUpdate,
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> RecordOut:
    return record_out(service.update(db, user, record_id, body))


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(
    record_id: uuid.UUID, user: User = Depends(get_current_user), db: DbSession = Depends(get_db)
) -> None:
    """Soft delete: the record stays recoverable for a short time (see /restore)."""
    service.remove(db, user, record_id)


@router.post("/{record_id}/restore", response_model=RecordOut)
def restore_record(
    record_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
    settings: Settings = Depends(settings_dep),
) -> RecordOut:
    return record_out(service.restore(db, user, record_id, settings))


@router.post("/{record_id}/refresh-value", response_model=RefreshOut)
def refresh_value(
    record_id: uuid.UUID,
    currency: str | None = Query(default=None, min_length=3, max_length=3),
    replace_manual: bool = Query(default=False),
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
    settings: Settings = Depends(settings_dep),
) -> RefreshOut:
    """Update the value from Discogs. A value set by hand is never replaced unless asked."""
    return service.refresh_value(db, user, record_id, currency, replace_manual, settings)


# --- covers -----------------------------------------------------------------------------------


@router.post("/{record_id}/cover", response_model=RecordOut)
async def upload_cover(
    record_id: uuid.UUID,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
    settings: Settings = Depends(settings_dep),
) -> RecordOut:
    data = await file.read(settings.max_cover_bytes + 1)
    return record_out(service.set_cover(db, user, record_id, data, settings, back=False))


@router.post("/{record_id}/back-cover", response_model=RecordOut)
async def upload_back_cover(
    record_id: uuid.UUID,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
    settings: Settings = Depends(settings_dep),
) -> RecordOut:
    data = await file.read(settings.max_cover_bytes + 1)
    return record_out(service.set_cover(db, user, record_id, data, settings, back=True))


@router.get("/{record_id}/back-cover")
def read_back_cover(
    record_id: uuid.UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
    settings: Settings = Depends(settings_dep),
):
    """The back of the sleeve, served like the front: members only, cached privately."""
    record = service.get_record(db, user, record_id)
    path = covers.cover_file(settings, record.id, back=True)
    return _sleeve_response(request, path, record.back_cover_path, "no_back_cover")


@router.get("/{record_id}/cover")
def read_cover(
    record_id: uuid.UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
    settings: Settings = Depends(settings_dep),
):
    """Only signed-in members can fetch a cover; browsers may cache it privately."""
    record = service.get_record(db, user, record_id)
    path = covers.cover_file(settings, record.id)
    return _sleeve_response(request, path, record.cover_path, "no_cover")
