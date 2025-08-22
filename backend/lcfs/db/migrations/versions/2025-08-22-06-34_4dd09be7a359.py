"""regulation changes for 2025 and beyond

Revision ID: 4dd09be7a359
Revises: 32a1f93375bd
Create Date: 2025-08-22 06:34:33.415526

"""

import sqlalchemy as sa
from alembic import op
from alembic_postgresql_enum import TableReference
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "4dd09be7a359"
down_revision = "32a1f93375bd"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "fuel_supply",
        sa.Column(
            "is_canada_produced",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=True,
            comment="Flag for Canada production fuels",
        ),
    )
    op.add_column(
        "fuel_supply",
        sa.Column(
            "is_q1_supplied",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=True,
            comment="Flag for Q1 supply of fuel",
        ),
    )
    op.add_column(
        "notional_transfer",
        sa.Column(
            "is_canada_produced",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=True,
            comment="Flag for Canada production fuels",
        ),
    )
    op.add_column(
        "notional_transfer",
        sa.Column(
            "is_q1_supplied",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=True,
            comment="Flag for Q1 supply of fuel",
        ),
    )
    op.add_column(
        "other_uses",
        sa.Column(
            "is_canada_produced",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=True,
            comment="Flag for Canada production fuels",
        ),
    )
    op.add_column(
        "other_uses",
        sa.Column(
            "is_q1_supplied",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=True,
            comment="Flag for Q1 supply of fuel",
        ),
    )


def downgrade() -> None:
    op.drop_column("other_uses", "is_q1_supplied")
    op.drop_column("other_uses", "is_canada_produced")
    op.drop_column("notional_transfer", "is_q1_supplied")
    op.drop_column("notional_transfer", "is_canada_produced")
    op.drop_column("fuel_supply", "is_q1_supplied")
    op.drop_column("fuel_supply", "is_canada_produced")
