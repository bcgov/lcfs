"""Remove notifications email from user_profile

Revision ID: cd8698fe40e6
Revises: 26ab15f8ab18
Create Date: 2024-12-09 22:33:29.554360

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "cd8698fe40e6"
down_revision = "26ab15f8ab18"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove notifications_email column from user_profile table
    op.drop_column("user_profile", "notifications_email")


def downgrade() -> None:
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
