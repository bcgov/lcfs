"""add 'unrecognized' column to 'fuel_type' table.

Revision ID: 86d53ce094d3
Revises: 819ad5703f41
Create Date: 2024-09-09 13:47:45.993248

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "86d53ce094d3"
down_revision = "819ad5703f41"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'unrecognized' boolean column to 'fuel_type' table, default is False (recognized fuel types)
    op.add_column(
        "fuel_type",
        sa.Column(
            "unrecognized",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
            comment="Indicates if the fuel type is unrecognized",
        ),
    )


def downgrade() -> None:
    # Remove 'unrecognized' column
    op.drop_column("fuel_type", "unrecognized")
