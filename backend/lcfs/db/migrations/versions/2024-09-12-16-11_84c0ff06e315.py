"""Add Fuel Code Suffix

Revision ID: 84c0ff06e315
Revises: 2180a947bdf2
Create Date: 2024-09-09 22:11:49.304218

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "84c0ff06e315"
down_revision = "2180a947bdf2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("fuel_code", "fuel_code", new_column_name="fuel_suffix")


def downgrade() -> None:
    op.alter_column("fuel_code", "fuel_suffix", new_column_name="fuel_code")
