"""Add Analyst adjustment Status

Revision ID: bd4da1540e2d
Revises: 937c793bf7b8
Create Date: 2025-03-11 21:12:46.492584

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "bd4da1540e2d"
down_revision = "fd8ee994668c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE compliancereportstatusenum ADD VALUE 'Analyst_adjustment'")

    op.execute("COMMIT")


def downgrade() -> None:
    pass  # Much harder to remove
