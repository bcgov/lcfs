"""Backfill email field for IDIR users where email is NULL

Revision ID: a1b2c3d4e5f8
Revises: 5897848af3c9
Create Date: 2026-01-19 20:00:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f8"
down_revision = "5897848af3c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE user_profile
        SET email = keycloak_email,
            update_date = NOW()
        WHERE organization_id IS NULL
          AND email IS NULL
          AND keycloak_email IS NOT NULL
        """
    )


def downgrade() -> None:
    """Cannot be safely downgraded. Restore from backup if needed."""
    pass
