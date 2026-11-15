import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, _now, _uuid_pk


class DiscogsConnection(Base):
    """A member's own Discogs authorisation. Tokens are stored encrypted (see app.core.crypto)."""

    __tablename__ = "discogs_connections"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    discogs_username: Mapped[str] = mapped_column(String(100))
    token_encrypted: Mapped[str] = mapped_column(Text)
    token_secret_encrypted: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | expired
    created_at: Mapped[datetime] = _now()


class DiscogsOAuthPending(Base):
    """A request token waiting for the member to authorise on Discogs."""

    __tablename__ = "discogs_oauth_pending"

    request_token: Mapped[str] = mapped_column(String(100), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    secret_encrypted: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = _now()


class ImportJob(Base):
    __tablename__ = "import_jobs"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    shared: Mapped[bool] = mapped_column(default=False)  # True: imported records have no owner
    # pending | running | done | failed
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    processed: Mapped[int] = mapped_column(Integer, default=0)
    added: Mapped[int] = mapped_column(Integer, default=0)
    next_page: Mapped[int] = mapped_column(Integer, default=1)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = _now()
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
