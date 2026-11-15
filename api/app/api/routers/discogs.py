import uuid

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session as DbSession

from app.api.deps import get_current_user, settings_dep
from app.core.config import Settings
from app.core.db import get_db
from app.models import ImportJob, User
from app.schemas import RecordOut
from app.schemas.discogs import (
    ConnectOut,
    CoverFromDiscogs,
    DiscogsStatus,
    ImportJobOut,
    ImportStart,
    ReleaseValue,
    SearchOut,
    TracklistOut,
)
from app.services import discogs_connection as connection
from app.services import discogs_search as search_service
from app.services.records import record_out

router = APIRouter(prefix="/api/discogs", tags=["discogs"])


def _settings_redirect(result: str) -> RedirectResponse:
    return RedirectResponse(f"/settings?discogs={result}", status_code=303)


def _job_out(job: ImportJob) -> ImportJobOut:
    return ImportJobOut(
        id=job.id,
        status=job.status,
        shared=job.shared,
        total=job.total,
        processed=job.processed,
        added=job.added,
        message=job.message,
    )


@router.get("/status", response_model=DiscogsStatus)
def status(
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
    settings: Settings = Depends(settings_dep),
):
    conn = connection.get_connection(db, user.id)
    return DiscogsStatus(
        configured=settings.discogs_configured,
        connected=conn is not None,
        status=conn.status if conn else None,
        username=conn.discogs_username if conn else None,
    )


@router.post("/connect", response_model=ConnectOut)
def connect(
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
    settings: Settings = Depends(settings_dep),
):
    return ConnectOut(authorize_url=connection.begin_connect(db, user, settings))


@router.get("/callback")
def callback(
    oauth_token: str | None = Query(None),
    oauth_verifier: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
    settings: Settings = Depends(settings_dep),
):
    """Discogs sends the browser back here. Always ends with a redirect to Settings."""
    result = connection.finish_connect(db, user, settings, oauth_token, oauth_verifier)
    return _settings_redirect(result)


@router.delete("/connection", status_code=204)
def disconnect(user: User = Depends(get_current_user), db: DbSession = Depends(get_db)) -> None:
    """Remove the stored authorisation. Records already imported stay."""
    connection.disconnect(db, user)


@router.post("/import", response_model=ImportJobOut, status_code=202)
def start_import(
    body: ImportStart,
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
):
    return _job_out(connection.start_import(db, user, body.shared))


@router.get("/import/latest", response_model=ImportJobOut | None)
def latest_import(user: User = Depends(get_current_user), db: DbSession = Depends(get_db)):
    job = connection.latest_import(db, user)
    return _job_out(job) if job else None


@router.get("/search", response_model=SearchOut)
def search(
    q: str = Query(min_length=2, max_length=200),
    page: int = Query(default=1, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
    settings: Settings = Depends(settings_dep),
):
    return search_service.search(db, user, settings, q, page)


@router.post("/records/{record_id}/cover", response_model=RecordOut)
def cover_from_discogs(
    record_id: uuid.UUID,
    body: CoverFromDiscogs,
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
    settings: Settings = Depends(settings_dep),
):
    """Keep a copy of a Discogs cover on the record. Only Discogs image hosts are fetched."""
    return record_out(search_service.cover_from_discogs(db, user, settings, record_id, body.url))


@router.get("/records/{record_id}/tracklist", response_model=TracklistOut)
def tracklist(
    record_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
    settings: Settings = Depends(settings_dep),
):
    """Fetched from Discogs the first time, then saved on the record and reused."""
    return search_service.tracklist(db, user, settings, record_id)


@router.get("/releases/{release_id}/value", response_model=ReleaseValue)
def release_value(
    release_id: int,
    currency: str = Query(default="EUR", min_length=3, max_length=3),
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
    settings: Settings = Depends(settings_dep),
):
    """Current market value of a release: lowest price for sale, with the member's authorisation."""
    return search_service.release_value(db, user, settings, release_id, currency)
