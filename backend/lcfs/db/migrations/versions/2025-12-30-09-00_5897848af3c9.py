"""Add expiry_notification_sent_at column to fuel_code table

Revision ID: 5897848af3c9
Revises: 7ca5289dff90
Create Date: 2025-12-30 09:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "5897848af3c9"
down_revision = "7ca5289dff90"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add column to track when expiry notification was sent
    # This prevents duplicate notifications from being sent on subsequent scheduler runs
    op.add_column(
        "fuel_code",
        sa.Column(
            "expiry_notification_sent_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Timestamp when expiry notification email was sent. Used to prevent duplicate notifications.",
        ),
    )


def downgrade() -> None:
    op.drop_column("fuel_code", "expiry_notification_sent_at")
