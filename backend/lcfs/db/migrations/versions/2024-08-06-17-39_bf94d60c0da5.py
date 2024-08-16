"""Add comments and a new column to `fuel_type` table.

Revision ID: bf94d60c0da5
Revises: 37721d823e5e
Create Date: 2024-08-06 17:39:56.176409

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "bf94d60c0da5"
down_revision = "7cc97001b3b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "fuel_type",
        "fossil_derived",
        existing_type=sa.BOOLEAN(),
        comment="Indicates whether the fuel is fossil-derived",
        existing_nullable=True,
    )

    op.add_column(
        "fuel_type",
        sa.Column(
            "other_uses_fossil_derived",
            sa.Boolean(),
            nullable=True,
            server_default=sa.false(),
            comment="Indicates whether the fuel is fossil-derived for other uses",
        ),
    )


def downgrade() -> None:
    op.alter_column(
        "fuel_type",
        "fossil_derived",
        existing_type=sa.BOOLEAN(),
        comment=None,
        existing_nullable=True,
    )

    op.drop_column("fuel_type", "other_uses_fossil_derived")
