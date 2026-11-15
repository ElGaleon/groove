"""Password recovery without email: another member creates a one-time link."""

import uuid
from datetime import timedelta

from fastapi import status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session as DbSession

from app.core.clock import utcnow
from app.core.config import Settings
from app.core.errors import AppError
from app.core.security import hash_password, hash_token, new_token
from app.models import PasswordReset, Session, User
from app.services.accounts import check_password_rules


def reset_status(reset: PasswordReset) -> str:
    if reset.used_at is not None:
        return "used"
    if reset.expires_at <= utcnow():
        return "expired"
    return "valid"


def create(
    db: DbSession, helper: User, member_id: uuid.UUID, settings: Settings
) -> tuple[PasswordReset, str]:
    """A link for another member of the same household; only its hash is stored.

    The unused links of that member are replaced, so only the newest one works.
    """
    member = db.get(User, member_id)
    if member is None or member.id == helper.id or member.household_id != helper.household_id:
        raise AppError(
            status.HTTP_403_FORBIDDEN,
            "reset_not_allowed",
            "A reset link can only be made for another member of your family",
        )
    db.execute(
        delete(PasswordReset).where(
            PasswordReset.user_id == member.id, PasswordReset.used_at.is_(None)
        )
    )
    token = new_token()
    reset = PasswordReset(
        user_id=member.id,
        created_by=helper.id,
        token_hash=hash_token(token),
        expires_at=utcnow() + timedelta(hours=settings.reset_hours),
    )
    db.add(reset)
    db.commit()
    return reset, token


def check(db: DbSession, token: str) -> tuple[str, str | None]:
    """Public: lets the reset page say whether the link can still be used."""
    reset = db.scalar(select(PasswordReset).where(PasswordReset.token_hash == hash_token(token)))
    if reset is None:
        return "invalid", None
    current = reset_status(reset)
    return current, reset.user.display_name if current == "valid" else None


def apply(db: DbSession, token: str, new_password: str, settings: Settings) -> User:
    """Set the new password, end every session of the member and burn the link (flushed)."""
    reset = db.scalar(
        select(PasswordReset).where(PasswordReset.token_hash == hash_token(token)).with_for_update()
    )
    if reset is None or reset_status(reset) != "valid":
        raise AppError(
            status.HTTP_403_FORBIDDEN,
            "reset_invalid",
            "Reset link invalid, used, replaced or expired",
        )
    check_password_rules(new_password, settings)  # a short password leaves the link valid
    user = reset.user
    user.password_hash = hash_password(new_password)
    reset.used_at = utcnow()
    db.execute(delete(Session).where(Session.user_id == user.id))
    db.flush()
    return user
