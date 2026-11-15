"""Database tables grouped by domain, all re-exported here (`from app.models import Record`)."""

from app.models.accounts import Household, Invite, LoginAttempt, PasswordReset, Session, User
from app.models.base import Base
from app.models.discogs import DiscogsConnection, DiscogsOAuthPending, ImportJob
from app.models.locations import Location
from app.models.records import Record

__all__ = [
    "Base",
    "DiscogsConnection",
    "DiscogsOAuthPending",
    "Household",
    "ImportJob",
    "Invite",
    "Location",
    "LoginAttempt",
    "PasswordReset",
    "Record",
    "Session",
    "User",
]
