"""Accounts: registration, sign-in checks, preferences and password changes.

Cookies stay in the routers (they need the response); everything that reads or writes the
database and decides who may do what lives here.
"""

from datetime import timedelta

from fastapi import status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session as DbSession

from app.core.clock import utcnow
from app.core.config import Settings
from app.core.errors import AppError
from app.core.security import hash_password, verify_password
from app.models import Household, LoginAttempt, Session, User
from app.schemas import LoginIn, PreferencesIn, RegisterIn
from app.services import invites


def check_password_rules(password: str, settings: Settings) -> None:
    if len(password) < settings.min_password_length:
        raise AppError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "password_too_short",
            f"The password must have at least {settings.min_password_length} characters",
            field="password",
            min_length=settings.min_password_length,
        )


def needs_setup(db: DbSession) -> bool:
    return db.scalar(select(Household.id).limit(1)) is None


def register(db: DbSession, body: RegisterIn, settings: Settings) -> User:
    """Create the member (and the household for the first one). Flushed, not committed."""
    check_password_rules(body.password, settings)
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise AppError(status.HTTP_409_CONFLICT, "email_taken", "Email already registered")

    household = db.scalar(select(Household).limit(1))
    if household is None:
        # First person on a new installation creates the household.
        if not body.household_name:
            raise AppError(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "required",
                "Household name is required",
                field="household_name",
            )
        household = Household(name=body.household_name)
        db.add(household)
        db.flush()
    else:
        if not body.invite_token:
            raise AppError(
                status.HTTP_403_FORBIDDEN, "invite_required", "An invitation is needed to register"
            )
        household = invites.consume(db, body.invite_token)

    user = User(
        household_id=household.id,
        email=email,
        password_hash=hash_password(body.password),
        display_name=body.display_name,
    )
    db.add(user)
    db.flush()
    return user


def authenticate(db: DbSession, body: LoginIn, settings: Settings) -> User:
    """Check the credentials, with a limit on failures. Same answer whether the e-mail exists."""
    email = body.email.lower()
    window_start = utcnow() - timedelta(minutes=settings.login_window_minutes)
    failures = db.scalar(
        select(func.count())
        .select_from(LoginAttempt)
        .where(
            LoginAttempt.email == email,
            LoginAttempt.success.is_(False),
            LoginAttempt.attempted_at >= window_start,
        )
    )
    if failures >= settings.login_max_failures:
        raise AppError(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "too_many_attempts",
            "Too many attempts, try again in a few minutes",
            headers={"Retry-After": str(settings.login_window_minutes * 60)},
        )

    user = db.scalar(select(User).where(User.email == email))
    ok = verify_password(body.password, user.password_hash if user else None)
    db.add(LoginAttempt(email=email, success=bool(ok and user)))
    if not (ok and user):
        db.commit()
        raise AppError(
            status.HTTP_401_UNAUTHORIZED, "invalid_credentials", "Wrong email or password"
        )
    return user


def end_session(db: DbSession, token_hash: str) -> None:
    db.execute(delete(Session).where(Session.token_hash == token_hash))
    db.commit()


def set_preferences(db: DbSession, user: User, body: PreferencesIn) -> None:
    """Only the fields that were sent change."""
    sent = body.model_fields_set
    if "default_currency" in sent:
        user.default_currency = body.default_currency
    if "language" in sent:
        user.language = body.language
    db.commit()


def change_password(
    db: DbSession, user: User, current: str, new: str, keep_session: str | None, settings: Settings
) -> None:
    if not verify_password(current, user.password_hash):
        raise AppError(
            status.HTTP_403_FORBIDDEN, "wrong_current_password", "The current password is wrong"
        )
    check_password_rules(new, settings)
    user.password_hash = hash_password(new)
    # Sign out every other session of this member; keep the current one.
    db.execute(
        delete(Session).where(Session.user_id == user.id, Session.token_hash != keep_session)
    )
    db.commit()
