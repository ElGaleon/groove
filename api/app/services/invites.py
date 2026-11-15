"""Invitations to join the household."""

import uuid
from datetime import timedelta

from fastapi import status
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from app.core.clock import utcnow
from app.core.config import Settings
from app.core.errors import AppError
from app.core.security import hash_token, new_token
from app.models import Household, Invite, User


def invite_status(invite: Invite) -> str:
    if invite.revoked_at is not None:
        return "revoked"
    if invite.used_at is not None:
        return "used"
    if invite.expires_at <= utcnow():
        return "expired"
    return "valid"


def create(db: DbSession, user: User, settings: Settings) -> tuple[Invite, str]:
    """A new invitation; the token is returned once and only its hash is stored."""
    token = new_token()
    invite = Invite(
        household_id=user.household_id,
        created_by=user.id,
        token_hash=hash_token(token),
        expires_at=utcnow() + timedelta(days=settings.invite_days),
    )
    db.add(invite)
    db.commit()
    return invite, token


def list_for(db: DbSession, user: User) -> list[Invite]:
    return list(
        db.scalars(
            select(Invite)
            .where(Invite.household_id == user.household_id)
            .order_by(Invite.created_at.desc())
        )
    )


def find_by_token(db: DbSession, token: str) -> Invite | None:
    return db.scalar(select(Invite).where(Invite.token_hash == hash_token(token)))


def consume(db: DbSession, token: str) -> Household:
    """Use an invitation for a registration (locks the row so it cannot be used twice)."""
    invite = db.scalar(
        select(Invite).where(Invite.token_hash == hash_token(token)).with_for_update()
    )
    if invite is None or invite_status(invite) != "valid":
        raise AppError(
            status.HTTP_403_FORBIDDEN,
            "invite_invalid",
            "Invitation invalid, used, revoked or expired",
        )
    invite.used_at = utcnow()
    return invite.household


def revoke(db: DbSession, user: User, invite_id: uuid.UUID) -> None:
    invite = db.get(Invite, invite_id)
    if invite is None or invite.household_id != user.household_id:
        raise AppError(status.HTTP_404_NOT_FOUND, "invite_not_found", "Invitation not found")
    if invite.revoked_at is None and invite.used_at is None:
        invite.revoked_at = utcnow()
        db.commit()
