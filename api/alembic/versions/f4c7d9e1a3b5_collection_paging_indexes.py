"""indexes for paging the collection and searching by catalogue number

Revision ID: f4c7d9e1a3b5
Revises: e3b6c8d0f2a4
Create Date: 2026-11-15 10:00:00

Built CONCURRENTLY: the image runs `alembic upgrade head` on a live database, and a plain
CREATE INDEX would lock writes to `records` while it builds.
"""
from collections.abc import Sequence

from alembic import op

revision: str = "f4c7d9e1a3b5"
down_revision: str | Sequence[str] | None = "e3b6c8d0f2a4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

INDEXES = {
    # Default list order (artist, then title) for the live records of one household.
    "ix_records_household_artist": (
        "ON records (household_id, artist_key, title_key, id) WHERE deleted_at IS NULL"
    ),
    # "Recently added" order.
    "ix_records_household_created": (
        "ON records (household_id, created_at, id) WHERE deleted_at IS NULL"
    ),
    # The exact expression the search uses for catalogue numbers.
    "ix_records_catalog_trgm": (
        "ON records USING gin ((lower(coalesce(catalog_no, ''))) gin_trgm_ops)"
    ),
}


def upgrade() -> None:
    with op.get_context().autocommit_block():
        for name, definition in INDEXES.items():
            op.execute(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {name} {definition}")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        for name in INDEXES:
            op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {name}")
