"""
Add role reference to notification_type

This migration adds a required 'role_id' foreign key to the 'notification_type' table, linking it to the 'role' table. 
It also populates 'role_id' for existing notification types based on their 'notification_type_id'.
Additionally, it updates the 'IN_APP' notification channel so that 'subscribe_by_default' is enabled.

Revision ID: 7f7b03241d7f
Revises: 0576833c005d
Create Date: 2025-01-23 15:38:19.362993
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "7f7b03241d7f"
down_revision = "0576833c005d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add the role_id column to the notification_type table
    op.add_column(
        "notification_type",
        sa.Column(
            "role_id",
            sa.Integer(),
            nullable=True,
            comment="Foreign key to the role table representing the required role for this notification type.",
        ),
    )

    # Add the foreign key constraint
    op.create_foreign_key(
        "fk_notification_type_role_id",
        "notification_type",
        "role",
        ["role_id"],
        ["role_id"],
        ondelete="SET NULL",
    )

    # Populate role_id for existing notification_type records
    op.execute(
        """
        UPDATE notification_type
            SET role_id = CASE notification_type_id
            WHEN 1 THEN 2
            WHEN 2 THEN 2
            WHEN 3 THEN 2
            WHEN 4 THEN 2
            WHEN 5 THEN 4
            WHEN 6 THEN 4
            WHEN 7 THEN 4
            WHEN 8 THEN 4
            WHEN 9 THEN 4
            WHEN 10 THEN 4
            WHEN 11 THEN 4
            WHEN 12 THEN 5
            WHEN 13 THEN 5
            WHEN 14 THEN 5
            WHEN 15 THEN 6
            WHEN 16 THEN 6
            WHEN 17 THEN 6
        END;
    """
    )

    # Enable subscribe_by_default for the IN_APP channel
    op.execute(
        """
        UPDATE notification_channel
        SET subscribe_by_default = TRUE
        WHERE channel_name = 'IN_APP';
        """
    )


def downgrade() -> None:
    # Revert role_id fields to NULL
    op.execute(
        """
        UPDATE notification_type
        SET role_id = NULL
        """
    )

    # Drop the foreign key
    op.drop_constraint(
        "fk_notification_type_role_id", "notification_type", type_="foreignkey"
    )

    # Drop the column
    op.drop_column("notification_type", "role_id")

    # Revert subscribe_by_default for the IN_APP channel
    op.execute(
        """
        UPDATE notification_channel
        SET subscribe_by_default = FALSE
        WHERE channel_name = 'IN_APP';
        """
    )
