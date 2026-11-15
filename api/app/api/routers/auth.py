from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.orm import Session as DbSession

from app.api.deps import (
    clear_session_cookie,
    create_session,
    current_session_hash,
    get_current_user,
    settings_dep,
)
from app.core.config import Settings
from app.core.db import get_db
from app.models import User
from app.schemas import (
    ChangePasswordIn,
    HouseholdOut,
    LoginIn,
    PasswordResetCheck,
    PasswordResetIn,
    PreferencesIn,
    RegisterIn,
    SetupStatus,
    UserOut,
)
from app.services import accounts as service
from app.services import password_resets

router = APIRouter(prefix="/api/auth", tags=["auth"])


def user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        default_currency=user.default_currency,
        language=user.language,
        household=HouseholdOut(id=user.household.id, name=user.household.name),
    )


@router.get("/status", response_model=SetupStatus)
def setup_status(
    db: DbSession = Depends(get_db), settings: Settings = Depends(settings_dep)
) -> SetupStatus:
    """Public: the sign-in screen needs to know whether to offer first-time setup."""
    return SetupStatus(
        needs_setup=service.needs_setup(db), min_password_length=settings.min_password_length
    )


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserOut)
def register(
    body: RegisterIn,
    response: Response,
    db: DbSession = Depends(get_db),
    settings: Settings = Depends(settings_dep),
) -> UserOut:
    user = service.register(db, body, settings)
    create_session(db, response, user, settings)
    db.commit()
    db.refresh(user)
    return user_out(user)


@router.post("/login", response_model=UserOut)
def login(
    body: LoginIn,
    response: Response,
    db: DbSession = Depends(get_db),
    settings: Settings = Depends(settings_dep),
) -> UserOut:
    user = service.authenticate(db, body, settings)
    create_session(db, response, user, settings)
    db.commit()
    return user_out(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    db: DbSession = Depends(get_db),
    settings: Settings = Depends(settings_dep),
) -> Response:
    token_hash = current_session_hash(request)
    if token_hash:
        service.end_session(db, token_hash)
    clear_session_cookie(response, settings)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return user_out(user)


@router.patch("/preferences", response_model=UserOut)
def set_preferences(
    body: PreferencesIn,
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> UserOut:
    """The member's own settings: the currency suggested for new prices and the app language."""
    service.set_preferences(db, user, body)
    return user_out(user)


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: ChangePasswordIn,
    request: Request,
    response: Response,
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
    settings: Settings = Depends(settings_dep),
) -> Response:
    service.change_password(
        db, user, body.current_password, body.new_password, current_session_hash(request), settings
    )
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/password-reset/check", response_model=PasswordResetCheck)
def check_password_reset(
    token: str = Query(min_length=1, max_length=128), db: DbSession = Depends(get_db)
) -> PasswordResetCheck:
    """Public: lets the reset page say whether a link can still be used."""
    current, name = password_resets.check(db, token)
    return PasswordResetCheck(status=current, display_name=name)


@router.post("/password-reset", response_model=UserOut)
def apply_password_reset(
    body: PasswordResetIn,
    response: Response,
    db: DbSession = Depends(get_db),
    settings: Settings = Depends(settings_dep),
) -> UserOut:
    """Set a new password with a link; the member is signed in on this device afterwards."""
    user = password_resets.apply(db, body.token, body.new_password, settings)
    create_session(db, response, user, settings)
    db.commit()
    db.refresh(user)
    return user_out(user)
