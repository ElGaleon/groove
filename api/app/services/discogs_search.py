"""Discogs search results matched with the collection, and the cover host rule."""

import re
import uuid
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from app.core.config import Settings
from app.core.errors import AppError
from app.core.money import fraction_digits
from app.integrations.discogs.client import DiscogsError, DiscogsUnauthorized
from app.models import DiscogsConnection, Record, User
from app.schemas.discogs import (
    ExistingRecord,
    ReleaseValue,
    SearchOut,
    SearchResult,
    Track,
    TracklistOut,
)
from app.services import covers
from app.services import discogs_connection as connection
from app.services.records import normalise


def expire_connection(db: DbSession, conn: DiscogsConnection) -> None:
    conn.status = "expired"
    db.commit()


def split_title(raw: str) -> tuple[str, str]:
    """Discogs search results give "Artist - Title"."""
    artist, sep, title = raw.partition(" - ")
    if not sep:
        return "", raw.strip()
    return re.sub(r"\s+\(\d+\)$", "", artist).strip(), title.strip()


def to_int(value) -> int | None:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    return number or None


def build_search_out(db: DbSession, user: User, data: dict, page: int) -> SearchOut:
    """Turn a Discogs search answer into results, marking those already in the collection."""
    members = {
        m.id: m.display_name
        for m in db.scalars(select(User).where(User.household_id == user.household_id))
    }
    mine = db.scalars(
        select(Record).where(Record.household_id == user.household_id, Record.deleted_at.is_(None))
    ).all()
    by_release = {r.discogs_release_id: r for r in mine if r.discogs_release_id}
    # Same album in another pressing (other catalogue number) is not "already in the collection".
    by_text = {(r.title_key, r.artist_key, normalise(r.catalog_no)): r for r in mine}

    results = []
    for item in data.get("results", []):
        release_id = to_int(item.get("id"))
        if release_id is None:
            continue
        artist, title = split_title(item.get("title", ""))
        found = by_release.get(release_id) or by_text.get(
            (normalise(title), normalise(artist), normalise(item.get("catno")))
        )
        labels = item.get("label") or []
        formats = item.get("format") or []
        results.append(
            SearchResult(
                release_id=release_id,
                title=title,
                artist=artist,
                year=to_int(item.get("year")),
                label=labels[0] if labels else None,
                catalog_no=(item.get("catno") or None),
                country=(item.get("country") or None),
                genres=list(item.get("genre") or []),
                format=", ".join(formats)[:100] if formats else None,
                cover_url=item.get("cover_image") or item.get("thumb") or None,
                in_collection=ExistingRecord(
                    id=found.id,
                    owner_id=found.owner_id,
                    owner_name=members.get(found.owner_id) if found.owner_id else None,
                )
                if found
                else None,
            )
        )
    pagination = data.get("pagination") or {}
    return SearchOut(results=results, page=page, pages=to_int(pagination.get("pages")) or 1)


def is_discogs_image(url: str, settings: Settings) -> bool:
    """Only Discogs hosts are fetched (and the configured API host, which is a mock in tests)."""
    parsed = urlparse(url)
    host = parsed.hostname or ""
    if host and host == urlparse(settings.discogs_api_url).hostname:
        return True
    return parsed.scheme == "https" and (host == "discogs.com" or host.endswith(".discogs.com"))


def search(db: DbSession, user: User, settings: Settings, q: str, page: int) -> SearchOut:
    conn = connection.require_active_connection(db, user)
    client = connection.client_for_connection(settings, conn)
    try:
        data = client.search(q.strip(), page=page)
    except DiscogsUnauthorized as exc:
        expire_connection(db, conn)
        raise AppError(409, "discogs_expired", exc.message) from exc
    except DiscogsError as exc:
        raise AppError(502, "discogs_error", exc.message) from exc
    finally:
        client.close()
    return build_search_out(db, user, data, page)


def _live_record(db: DbSession, user: User, record_id: uuid.UUID) -> Record:
    record = db.get(Record, record_id)
    if record is None or record.household_id != user.household_id or record.deleted_at:
        raise AppError(404, "record_not_found", "Record not found")
    return record


def cover_from_discogs(
    db: DbSession, user: User, settings: Settings, record_id: uuid.UUID, url: str
) -> Record:
    """Keep a copy of a Discogs cover on the record. Only Discogs image hosts are fetched."""
    conn = connection.require_active_connection(db, user)
    if not is_discogs_image(url, settings):
        raise AppError(422, "bad_cover_url", "The cover address is not allowed")
    record = _live_record(db, user, record_id)
    client = connection.client_for_connection(settings, conn)
    try:
        raw = client.download_image(url)
    finally:
        client.close()
    if raw:
        try:
            record.cover_path = covers.save_cover(
                settings, record.id, covers.process_cover(raw, settings)
            )
            db.commit()
        except covers.InvalidCover:
            pass
    return record


def tracklist(db: DbSession, user: User, settings: Settings, record_id: uuid.UUID) -> TracklistOut:
    """Fetched from Discogs the first time, then saved on the record and reused."""
    record = _live_record(db, user, record_id)
    if record.tracklist is not None:
        tracks = [Track(**t) for t in record.tracklist]
        return TracklistOut(
            available=bool(tracks), tracks=tracks, reason=None if tracks else "empty"
        )
    if record.discogs_release_id is None:
        return TracklistOut(available=False, reason="no_release")
    conn = connection.get_connection(db, user.id)
    if conn is None or conn.status != "active":
        return TracklistOut(available=False, reason="no_connection")
    client = connection.client_for_connection(settings, conn)
    try:
        data = client.release(record.discogs_release_id)
    except DiscogsUnauthorized:
        expire_connection(db, conn)
        return TracklistOut(available=False, reason="no_connection")
    except DiscogsError:
        return TracklistOut(available=False, reason="unavailable")
    finally:
        client.close()
    tracks = [
        {
            "position": t.get("position", "") or "",
            "title": t["title"],
            "duration": t.get("duration", "") or "",
        }
        for t in data.get("tracklist", [])
        if t.get("title") and t.get("type_", "track") == "track"
    ]
    record.tracklist = tracks
    db.commit()
    return TracklistOut(
        available=bool(tracks),
        tracks=[Track(**t) for t in tracks],
        reason=None if tracks else "empty",
    )


def release_value(
    db: DbSession, user: User, settings: Settings, release_id: int, currency: str
) -> ReleaseValue:
    """Current market value of a release: lowest price for sale, with the member's authorisation."""
    conn = connection.require_active_connection(db, user)
    cur = currency.upper()
    client = connection.client_for_connection(settings, conn)
    try:
        stats = client.marketplace_stats(release_id, cur)
    except DiscogsUnauthorized as exc:
        expire_connection(db, conn)
        raise AppError(409, "discogs_expired", exc.message) from exc
    except DiscogsError as exc:
        raise AppError(502, "discogs_error", exc.message) from exc
    finally:
        client.close()
    lowest = stats.get("lowest_price")
    amount = lowest.get("value") if isinstance(lowest, dict) else lowest
    return ReleaseValue(
        amount_minor=None if amount is None else round(float(amount) * 10 ** fraction_digits(cur)),
        currency=((lowest.get("currency") if isinstance(lowest, dict) else None) or cur),
        num_for_sale=int(stats.get("num_for_sale") or 0),
    )
