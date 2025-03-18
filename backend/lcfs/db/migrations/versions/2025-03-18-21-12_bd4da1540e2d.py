"""Add Analyst adjustment Status

Revision ID: bd4da1540e2d
Revises: e77de76bb555
Create Date: 2025-03-11 21:12:46.492584

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "bd4da1540e2d"
down_revision = "e77de76bb555"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE compliancereportstatusenum ADD VALUE 'Analyst_adjustment'")

    op.execute("COMMIT")


def downgrade() -> None:
    pass  # Much harder to remove
