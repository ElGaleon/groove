import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session as DbSession

from app.api.deps import get_current_user, settings_dep
from app.core.config import Settings
from app.core.db import get_db
from app.models import User
from app.schemas import InviteCheck, InviteCreated, InviteOut
from app.services import invites as service

router = APIRouter(prefix="/api/invites", tags=["invites"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=InviteCreated)
def create_invite(
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
    settings: Settings = Depends(settings_dep),
) -> InviteCreated:
    invite, token = service.create(db, user, settings)
    return InviteCreated(id=invite.id, token=token, expires_at=invite.expires_at)


@router.get("", response_model=list[InviteOut])
def list_invites(
    user: User = Depends(get_current_user), db: DbSession = Depends(get_db)
) -> list[InviteOut]:
    return [
        InviteOut(
            id=i.id,
            created_by=i.created_by,
            created_at=i.created_at,
            expires_at=i.expires_at,
            status=service.invite_status(i),
        )
        for i in service.list_for(db, user)
    ]


@router.get("/check", response_model=InviteCheck)
def check_invite(
    token: str = Query(min_length=1, max_length=128), db: DbSession = Depends(get_db)
) -> InviteCheck:
    """Public: lets the join page say whether a link can still be used."""
    invite = service.find_by_token(db, token)
    if invite is None:
        return InviteCheck(status="invalid")
    current = service.invite_status(invite)
    return InviteCheck(
        status=current, household_name=invite.household.name if current == "valid" else None
    )


@router.delete("/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_invite(
    invite_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> None:
    service.revoke(db, user, invite_id)
