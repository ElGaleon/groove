import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, _now, _uuid_pk


class Record(Base):
    __tablename__ = "records"
    __table_args__ = (
        # Re-importing a Discogs collection never creates the same item twice.
        Index(
            "uq_records_discogs_instance",
            "discogs_username",
            "discogs_instance_id",
            unique=True,
            postgresql_where=text("discogs_instance_id IS NOT NULL"),
        ),
        Index(
            "ix_records_title_trgm",
            "title_key",
            postgresql_using="gin",
            postgresql_ops={"title_key": "gin_trgm_ops"},
        ),
        Index(
            "ix_records_artist_trgm",
            "artist_key",
            postgresql_using="gin",
            postgresql_ops={"artist_key": "gin_trgm_ops"},
        ),
        # Paging the collection (default order and "recently added"); see f4c7d9e1a3b5.
        Index(
            "ix_records_household_artist",
            "household_id",
            "artist_key",
            "title_key",
            "id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_records_household_created",
            "household_id",
            "created_at",
            "id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
        # Catalogue-number search uses lower(coalesce(catalog_no, '')); the trigram index on
        # that expression is created in the migration only (SQLAlchemy cannot express the opclass
        # on an expression cleanly).
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    household_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(300))
    artist: Mapped[str] = mapped_column(String(300))
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    genres: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, server_default="{}")
    format: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Version (pressing) details
    catalog_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Purchase: amounts are integers in minor units (cents) with an ISO currency.
    purchase_amount_minor: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    purchase_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    purchase_location_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("locations.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    purchase_channel: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # Current value, set by hand or taken from Discogs.
    value_amount_minor: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    value_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    value_source: Mapped[str | None] = mapped_column(String(10), nullable=True)  # manual | discogs
    value_measure: Mapped[str | None] = mapped_column(String(100), nullable=True)
    value_fetched_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    value_num_for_sale: Mapped[int | None] = mapped_column(Integer, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    # No owner means the record is shared by the family. A leaving member's records become shared.
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    cover_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    back_cover_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tracklist: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    discogs_release_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    discogs_username: Mapped[str | None] = mapped_column(String(100), nullable=True)
    discogs_instance_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    # Normalised copies used for search, sorting and duplicate matching.
    title_key: Mapped[str] = mapped_column(String(300))
    artist_key: Mapped[str] = mapped_column(String(300))
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = _now()
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
