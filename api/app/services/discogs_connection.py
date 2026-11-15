"""A member's Discogs connection: OAuth, status, disconnect, and the import jobs they start."""

from datetime import timedelta

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session as DbSession

from app.core import crypto
from app.core.clock import utcnow
from app.core.config import Settings
from app.core.errors import AppError
from app.integrations.discogs.client import DiscogsClient, DiscogsError, DiscogsUnauthorized
from app.models import DiscogsConnection, DiscogsOAuthPending, ImportJob, User

PENDING_MAX_AGE = timedelta(hours=1)


def get_connection(db: DbSession, user_id) -> DiscogsConnection | None:
    return db.scalar(select(DiscogsConnection).where(DiscogsConnection.user_id == user_id))


def client_for_connection(settings: Settings, conn: DiscogsConnection) -> DiscogsClient:
    return DiscogsClient(
        settings,
        crypto.decrypt(conn.token_encrypted),
        crypto.decrypt(conn.token_secret_encrypted),
    )


def require_active_connection(db: DbSession, user: User) -> DiscogsConnection:
    """Discogs features are locked without a working connection; manual features never call this."""
    conn = get_connection(db, user.id)
    if conn is None:
        raise AppError(
            409, "discogs_not_connected", "Connect Discogs in Settings to use this feature"
        )
    if conn.status != "active":
        raise AppError(
            409, "discogs_expired", "The Discogs connection expired: reconnect it in Settings"
        )
    return conn


def begin_connect(db: DbSession, user: User, settings: Settings) -> str:
    """Start the OAuth dance; returns the Discogs page the member must visit."""
    if not settings.discogs_configured:
        raise AppError(
            503,
            "discogs_not_configured",
            "Discogs is not configured on this server: DISCOGS_CONSUMER_KEY, "
            "DISCOGS_CONSUMER_SECRET and FERNET_KEY are required (see the README)",
        )
    # Forget stale attempts (this member's, and anyone's older than an hour).
    db.execute(delete(DiscogsOAuthPending).where(DiscogsOAuthPending.user_id == user.id))
    db.execute(
        delete(DiscogsOAuthPending).where(
            DiscogsOAuthPending.created_at < utcnow() - PENDING_MAX_AGE
        )
    )
    client = DiscogsClient(settings)
    try:
        token, secret = client.request_token(f"{settings.public_base_url}/api/discogs/callback")
    except DiscogsUnauthorized as exc:
        raise AppError(
            502,
            "discogs_bad_app_credentials",
            "Discogs rejected the application credentials: check "
            "DISCOGS_CONSUMER_KEY and DISCOGS_CONSUMER_SECRET",
        ) from exc
    except DiscogsError as exc:
        raise AppError(502, "discogs_error", exc.message) from exc
    finally:
        client.close()
    db.add(
        DiscogsOAuthPending(
            request_token=token, user_id=user.id, secret_encrypted=crypto.encrypt(secret)
        )
    )
    db.commit()
    return client.authorize_url(token)


def finish_connect(
    db: DbSession,
    user: User,
    settings: Settings,
    oauth_token: str | None,
    oauth_verifier: str | None,
) -> str:
    """Complete the OAuth dance. Returns `connected`, `cancelled` or `failed`."""
    pending = db.get(DiscogsOAuthPending, oauth_token) if oauth_token else None
    if pending is None or pending.user_id != user.id:
        return "failed"
    secret = crypto.decrypt(pending.secret_encrypted)
    db.delete(pending)
    db.commit()
    if not oauth_verifier:
        return "cancelled"
    if utcnow() - pending.created_at > PENDING_MAX_AGE:
        return "failed"

    client = DiscogsClient(settings, oauth_token, secret)
    try:
        token, token_secret = client.access_token(oauth_verifier)
        authed = DiscogsClient(settings, token, token_secret)
        try:
            username = authed.identity()["username"]
        finally:
            authed.close()
    except (DiscogsError, KeyError):
        return "failed"
    finally:
        client.close()

    conn = get_connection(db, user.id)
    values = {
        "discogs_username": username,
        "token_encrypted": crypto.encrypt(token),
        "token_secret_encrypted": crypto.encrypt(token_secret),
        "status": "active",
    }
    if conn is None:
        db.add(DiscogsConnection(user_id=user.id, **values))
    else:
        for key, value in values.items():
            setattr(conn, key, value)
    db.commit()
    return "connected"


def disconnect(db: DbSession, user: User) -> None:
    """Remove the stored authorisation and stop running imports. Imported records stay."""
    db.execute(delete(DiscogsConnection).where(DiscogsConnection.user_id == user.id))
    db.execute(delete(DiscogsOAuthPending).where(DiscogsOAuthPending.user_id == user.id))
    db.execute(
        update(ImportJob)
        .where(ImportJob.user_id == user.id, ImportJob.status.in_(["pending", "running"]))
        .values(status="failed", message="account_disconnected")
    )
    db.commit()


def start_import(db: DbSession, user: User, shared: bool) -> ImportJob:
    """Queue an import (one at a time per member: a running one is returned instead)."""
    require_active_connection(db, user)
    running = db.scalar(
        select(ImportJob).where(
            ImportJob.user_id == user.id, ImportJob.status.in_(["pending", "running"])
        )
    )
    if running is not None:
        return running
    job = ImportJob(user_id=user.id, shared=shared)
    db.add(job)
    db.commit()
    return job


def latest_import(db: DbSession, user: User) -> ImportJob | None:
    return db.scalar(
        select(ImportJob)
        .where(ImportJob.user_id == user.id)
        .order_by(ImportJob.created_at.desc())
        .limit(1)
    )
