import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session as DbSession

from app.api.deps import clear_session_cookie, get_current_user, settings_dep
from app.core.config import Settings
from app.core.db import get_db
from app.models import User
from app.schemas import HouseholdDetail, LeaveIn, MemberOut, PasswordResetCreated
from app.services import households as service
from app.services import password_resets

router = APIRouter(prefix="/api/household", tags=["household"])


@router.get("", response_model=HouseholdDetail)
def household(user: User = Depends(get_current_user), db: DbSession = Depends(get_db)):
    return HouseholdDetail(
        id=user.household.id,
        name=user.household.name,
        members=[
            MemberOut(id=m.id, display_name=m.display_name, email=m.email)
            for m in service.members(db, user)
        ],
    )


@router.post("/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave(
    body: LeaveIn,
    response: Response,
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
    settings: Settings = Depends(settings_dep),
) -> Response:
    """Leave the household: the leaver's records stay and become shared."""
    service.leave(db, user, body.confirm_delete_collection)
    clear_session_cookie(response, settings)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post(
    "/members/{member_id}/password-reset",
    status_code=status.HTTP_201_CREATED,
    response_model=PasswordResetCreated,
)
def create_password_reset(
    member_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
    settings: Settings = Depends(settings_dep),
) -> PasswordResetCreated:
    """A one-time link to give to a family member who forgot their password."""
    reset, token = password_resets.create(db, user, member_id, settings)
    return PasswordResetCreated(token=token, expires_at=reset.expires_at)
