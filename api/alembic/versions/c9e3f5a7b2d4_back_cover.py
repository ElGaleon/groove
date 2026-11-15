"""back cover of the sleeve

Revision ID: c9e3f5a7b2d4
Revises: b8d2e4f6a1c3
Create Date: 2026-11-13 20:10:00

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c9e3f5a7b2d4"
down_revision: str | Sequence[str] | None = "b8d2e4f6a1c3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("records", sa.Column("back_cover_path", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("records", "back_cover_path")
