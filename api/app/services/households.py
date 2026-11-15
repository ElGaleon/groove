"""The family: its members, and leaving it."""

from fastapi import status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session as DbSession

from app.core.errors import AppError
from app.models import Household, User


def members(db: DbSession, user: User) -> list[User]:
    return list(
        db.scalars(
            select(User).where(User.household_id == user.household_id).order_by(User.created_at)
        )
    )


def leave(db: DbSession, user: User, confirm_delete_collection: bool) -> None:
    """The leaver's records stay and become shared (FK on the owner is ON DELETE SET NULL).

    The last member can only leave by deleting the collection.
    """
    member_count = len(
        db.scalars(select(User.id).where(User.household_id == user.household_id)).all()
    )
    if member_count == 1:
        if not confirm_delete_collection:
            raise AppError(
                status.HTTP_409_CONFLICT,
                "last_member_confirmation_required",
                "You are the last member: leaving deletes the collection. Confirm to proceed.",
            )
        db.execute(delete(Household).where(Household.id == user.household_id))
    else:
        db.execute(delete(User).where(User.id == user.id))
    db.commit()
