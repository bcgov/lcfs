"""Add notifications email to user_profile

Revision ID: b69a33bbd135
Revises: b4da565bb711
Create Date: 2024-11-27 20:48:24.724112

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "b69a33bbd135"
down_revision = "b4da565bb711"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add notifications_email column to user_profile table
    op.add_column(
        "user_profile",
        sa.Column(
            "notifications_email",
            sa.String(length=255),
            nullable=True,
            comment="Email address used for notifications",
        ),
    )


def downgrade() -> None:
    # Remove notifications_email column from user_profile table
    op.drop_column("user_profile", "notifications_email")
