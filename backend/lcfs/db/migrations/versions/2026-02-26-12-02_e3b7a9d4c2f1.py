"""Add Gigajoules to quantity units enum.

Revision ID: e3b7a9d4c2f1
Revises: b6f4d2e9c1a0
Create Date: 2026-02-19 10:00:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "e3b7a9d4c2f1"
down_revision = "b6f4d2e9c1a0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE quantityunitsenum ADD VALUE IF NOT EXISTS 'Gigajoules'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values in-place.
    pass
