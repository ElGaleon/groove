"""member default currency

Revision ID: b8d2e4f6a1c3
Revises: a7c1d2e3f4b5
Create Date: 2026-11-13 19:10:00

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b8d2e4f6a1c3"
down_revision: str | Sequence[str] | None = "a7c1d2e3f4b5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("default_currency", sa.String(length=3), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "default_currency")
