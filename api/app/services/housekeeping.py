"""Periodic clean-up of rows that only matter for a while: without it these tables only grow."""

from datetime import timedelta

from sqlalchemy import delete
from sqlalchemy.orm import Session as DbSession

from app.core.clock import utcnow
from app.core.config import Settings
from app.models import DiscogsOAuthPending, LoginAttempt, Session
from app.services.discogs_connection import PENDING_MAX_AGE


def purge_expired(db: DbSession, settings: Settings) -> dict[str, int]:
    """Drop expired sessions, login attempts outside any rate-limit window, stale OAuth starts."""
    now = utcnow()
    # Keep a day of attempts (well beyond the window) so a burst stays visible in the table.
    attempts_before = now - max(timedelta(days=1), timedelta(minutes=settings.login_window_minutes))
    counts = {
        "sessions": db.execute(delete(Session).where(Session.expires_at <= now)).rowcount,
        "login_attempts": db.execute(
            delete(LoginAttempt).where(LoginAttempt.attempted_at < attempts_before)
        ).rowcount,
        "oauth_pending": db.execute(
            delete(DiscogsOAuthPending).where(
                DiscogsOAuthPending.created_at < now - PENDING_MAX_AGE
            )
        ).rowcount,
    }
    db.commit()
    return counts
