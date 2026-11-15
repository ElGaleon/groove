"""Import of a member's Discogs collection, run by a database-backed worker.

Jobs live in `import_jobs`; the worker resumes `running` jobs after a restart. Progress is saved
after every page, and inserts are idempotent (unique key on Discogs user + instance id), so a page
processed twice adds nothing twice, member edits are never overwritten and nothing is deleted.
"""

import logging
import threading
import time

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session as DbSession
from sqlalchemy.orm import sessionmaker

from app.core.config import Settings
from app.integrations.discogs.client import (
    DiscogsClient,
    DiscogsError,
    DiscogsForbidden,
    DiscogsUnauthorized,
    DiscogsUnavailable,
)
from app.integrations.discogs.mapping import map_release
from app.models import ImportJob, Record, User
from app.services import covers, housekeeping
from app.services import discogs_connection as svc
from app.services.records import normalise

log = logging.getLogger("groove.import")


def _set_failed(db: DbSession, job: ImportJob, code: str) -> None:
    """Fail the job with a code the client translates (what was imported stays in `added`)."""
    job.status = "failed"
    job.message = code
    db.commit()


def run_job(
    db: DbSession,
    job_id,
    settings: Settings,
    max_pages: int | None = None,
) -> None:
    """Process a job from its saved page. `max_pages` lets tests simulate a restart."""
    job = db.get(ImportJob, job_id)
    if job is None or job.status not in ("pending", "running"):
        return
    user = db.get(User, job.user_id)
    conn = svc.get_connection(db, job.user_id)
    if user is None or conn is None:
        return _set_failed(db, job, "account_disconnected")
    job.status = "running"
    db.commit()

    client = svc.client_for_connection(settings, conn)
    username = conn.discogs_username
    try:
        pages_done = 0
        while True:
            page = client.collection_page(username, job.next_page, settings.import_page_size)
            pagination = page.get("pagination") or {}
            releases = page.get("releases") or []
            if job.total is None:
                job.total = pagination.get("items", len(releases))
                if job.total == 0:
                    job.status = "done"
                    job.message = "empty_or_private"
                    db.commit()
                    return
            for item in releases:
                _import_one(db, client, job, user, username, item, settings)
                job.processed += 1
            total_pages = pagination.get("pages", job.next_page)
            job.next_page += 1
            db.commit()  # progress is durable after every page
            pages_done += 1
            if job.next_page > total_pages:
                job.status = "done"
                job.message = None
                db.commit()
                return
            if max_pages is not None and pages_done >= max_pages:
                return
    except DiscogsUnauthorized:
        conn.status = "expired"
        _set_failed(db, job, "authorisation_rejected")
    except DiscogsForbidden:
        _set_failed(db, job, "private_collection")
    except DiscogsUnavailable:
        _set_failed(db, job, "discogs_unavailable")
    except DiscogsError:
        _set_failed(db, job, "discogs_error")
    finally:
        client.close()


def _import_one(
    db: DbSession,
    client: DiscogsClient,
    job: ImportJob,
    user: User,
    username: str,
    item: dict,
    settings: Settings,
) -> None:
    data = map_release(item)
    if data["discogs_instance_id"] is None:
        return
    cover_url = data.pop("cover_url")
    stmt = (
        insert(Record)
        .values(
            household_id=user.household_id,
            owner_id=None if job.shared else user.id,
            created_by=user.id,
            discogs_username=username,
            title_key=normalise(data["title"]),
            artist_key=normalise(data["artist"]),
            **data,
        )
        .on_conflict_do_nothing(
            index_elements=["discogs_username", "discogs_instance_id"],
            index_where=Record.discogs_instance_id.is_not(None),
        )
        .returning(Record.id)
    )
    record_id = db.execute(stmt).scalar()
    if record_id is None:
        return  # already imported earlier: leave it (and any edits) alone
    job.added += 1
    if cover_url:
        raw = client.download_image(cover_url)
        if raw:
            try:
                jpeg = covers.process_cover(raw, settings)
                path = covers.save_cover(settings, record_id, jpeg)
                db.execute(update(Record).where(Record.id == record_id).values(cover_path=path))
            except covers.InvalidCover:
                pass  # a bad cover never blocks the import


def process_jobs(session_factory: sessionmaker, settings: Settings) -> int:
    """Run every pending or running job, one after the other. Returns how many were run."""
    ran = 0
    while True:
        with session_factory() as db:
            job_id = db.scalar(
                select(ImportJob.id)
                .where(ImportJob.status.in_(["pending", "running"]))
                .order_by(ImportJob.created_at)
                .limit(1)
            )
            if job_id is None:
                return ran
            try:
                run_job(db, job_id, settings)
            except Exception:  # noqa: BLE001 - a crashing job must not kill the worker
                log.exception("import job %s crashed", job_id)
                db.rollback()
                db.execute(
                    update(ImportJob)
                    .where(ImportJob.id == job_id)
                    .values(status="failed", message="unexpected_error")
                )
                db.commit()
            ran += 1


class Worker:
    """One background thread started with the API; wakes up every few seconds."""

    def __init__(self, session_factory: sessionmaker, settings: Settings):
        self._factory = session_factory
        self._settings = settings
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._loop, name="import-worker", daemon=True)

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._thread.join(timeout=5)

    def _loop(self) -> None:
        next_cleanup = 0.0
        while not self._stop.is_set():
            try:
                process_jobs(self._factory, self._settings)
            except Exception:  # noqa: BLE001
                log.exception("import worker error")
            if time.monotonic() >= next_cleanup:
                next_cleanup = time.monotonic() + self._settings.housekeeping_seconds
                try:
                    with self._factory() as db:
                        housekeeping.purge_expired(db, self._settings)
                except Exception:  # noqa: BLE001 - clean-up is best effort
                    log.exception("housekeeping error")
            self._stop.wait(self._settings.import_poll_seconds)
