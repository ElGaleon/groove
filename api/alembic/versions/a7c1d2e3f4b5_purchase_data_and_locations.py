"""purchase data, record version details and locations

Revision ID: a7c1d2e3f4b5
Revises: f61b7c591add
Create Date: 2026-11-13 17:30:00

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a7c1d2e3f4b5"
down_revision: str | Sequence[str] | None = "f61b7c591add"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "locations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("household_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("address", sa.String(length=300), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("url", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_locations_household_id", "locations", ["household_id"])
    op.create_index("ix_locations_household_name", "locations", ["household_id", "name"])

    op.add_column("records", sa.Column("catalog_no", sa.String(length=100), nullable=True))
    op.add_column("records", sa.Column("country", sa.String(length=100), nullable=True))
    op.add_column("records", sa.Column("purchase_amount_minor", sa.BigInteger(), nullable=True))
    op.add_column("records", sa.Column("purchase_currency", sa.String(length=3), nullable=True))
    op.add_column("records", sa.Column("purchase_date", sa.Date(), nullable=True))
    op.add_column("records", sa.Column("purchase_location_id", sa.UUID(), nullable=True))
    op.add_column("records", sa.Column("purchase_channel", sa.String(length=10), nullable=True))
    op.add_column("records", sa.Column("value_amount_minor", sa.BigInteger(), nullable=True))
    op.add_column("records", sa.Column("value_currency", sa.String(length=3), nullable=True))
    op.add_column("records", sa.Column("value_source", sa.String(length=10), nullable=True))
    op.add_column("records", sa.Column("value_measure", sa.String(length=100), nullable=True))
    op.add_column("records", sa.Column("value_fetched_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("records", sa.Column("value_num_for_sale", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_records_purchase_location", "records", "locations", ["purchase_location_id"], ["id"], ondelete="RESTRICT"
    )
    op.create_index("ix_records_purchase_location_id", "records", ["purchase_location_id"])


def downgrade() -> None:
    op.drop_index("ix_records_purchase_location_id", table_name="records")
    op.drop_constraint("fk_records_purchase_location", "records", type_="foreignkey")
    for column in (
        "value_num_for_sale", "value_fetched_at", "value_measure", "value_source", "value_currency",
        "value_amount_minor", "purchase_channel", "purchase_location_id", "purchase_date",
        "purchase_currency", "purchase_amount_minor", "country", "catalog_no",
    ):
        op.drop_column("records", column)
    op.drop_index("ix_locations_household_name", table_name="locations")
    op.drop_index("ix_locations_household_id", table_name="locations")
    op.drop_table("locations")
