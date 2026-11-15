"""member language

Revision ID: d2a5b7c9e1f3
Revises: c9e3f5a7b2d4
Create Date: 2026-11-14 14:30:00

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d2a5b7c9e1f3"
down_revision: str | Sequence[str] | None = "c9e3f5a7b2d4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("language", sa.String(length=2), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "language")
