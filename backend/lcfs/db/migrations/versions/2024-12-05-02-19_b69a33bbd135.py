"""Add notifications email to user_profile

Revision ID: b69a33bbd135
Revises: 8491890dd688
Create Date: 2024-12-05 20:48:24.724112

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "b69a33bbd135"
down_revision = "8491890dd688"
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
