"""Add government notification table

Revision ID: a7b8c9d0e1f2
Revises: 4c1b2a3d4e5f
Create Date: 2025-11-20 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "a7b8c9d0e1f2"
down_revision = "4c1b2a3d4e5f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the notification type enum
    sa.Enum("Alert", "Outage", "Deadline", "General", name="notification_type_enum").create(
        op.get_bind()
    )

    # Create the government_notification table
    op.create_table(
        "government_notification",
        sa.Column(
            "government_notification_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the government notification",
        ),
        sa.Column(
            "notification_title",
            sa.String(length=200),
            nullable=False,
            comment="Title of the notification",
        ),
        sa.Column(
            "notification_text",
            sa.Text(),
            nullable=False,
            comment="Body of the notification, supports HTML markup",
        ),
        sa.Column(
            "link_url",
            sa.String(length=500),
            nullable=True,
            comment="Optional URL link to apply to the title",
        ),
        sa.Column(
            "notification_type",
            postgresql.ENUM(
                "Alert",
                "Outage",
                "Deadline",
                "General",
                name="notification_type_enum",
                create_type=False,
            ),
            nullable=False,
            server_default="General",
            comment="Type of notification that determines card styling and presentation",
        ),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was created in the database.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
        ),
        sa.Column(
            "create_user",
            sa.String(),
            nullable=True,
            comment="The user who created this record in the database.",
        ),
        sa.Column(
            "update_user",
            sa.String(),
            nullable=True,
            comment="The user who last updated this record in the database.",
        ),
        sa.PrimaryKeyConstraint("government_notification_id"),
        comment="Stores government notifications displayed on dashboards for all users",
    )


def downgrade() -> None:
    # Drop the table
    op.drop_table("government_notification")

    # Drop the enum type
    sa.Enum("Alert", "Outage", "Deadline", "General", name="notification_type_enum").drop(
        op.get_bind()
    )
