"""Session handling shared by the routers."""

from datetime import timedelta

from fastapi import Depends, Request, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session as DbSession

from app.core.clock import utcnow
from app.core.config import Settings, get_settings
from app.core.db import get_db
from app.core.errors import AppError
from app.core.security import hash_token, new_token
from app.models import Session, User

COOKIE_NAME = "groove_session"


def create_session(db: DbSession, response: Response, user: User, settings: Settings) -> None:
    token = new_token()
    expires = utcnow() + timedelta(days=settings.session_days)
    db.add(Session(token_hash=hash_token(token), user_id=user.id, expires_at=expires))
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=settings.session_days * 86400,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        COOKIE_NAME, path="/", secure=settings.cookie_secure, httponly=True, samesite="lax"
    )


def current_session_hash(request: Request) -> str | None:
    token = request.cookies.get(COOKIE_NAME)
    return hash_token(token) if token else None


def get_current_user(request: Request, db: DbSession = Depends(get_db)) -> User:
    """Every data endpoint depends on this: no valid session, no data."""
    token_hash = current_session_hash(request)
    if token_hash:
        session = db.scalar(select(Session).where(Session.token_hash == token_hash))
        if session and session.expires_at > utcnow():
            user = db.get(User, session.user_id)
            if user:
                return user
        if session:
            db.execute(delete(Session).where(Session.token_hash == token_hash))
            db.commit()
    raise AppError(status.HTTP_401_UNAUTHORIZED, "not_authenticated", "Not authenticated")


def settings_dep() -> Settings:
    return get_settings()
