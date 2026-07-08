"""Add credit market monthly report notification type.

Revision ID: b7c8d9e0f1a2
Revises: b1c2d3e4f5a6
Create Date: 2026-07-02 12:00:00.000000
"""

from alembic import op


revision = "b7c8d9e0f1a2"
down_revision = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None

NOTIFICATION_TYPE = "PUBLIC__CREDIT_MARKET_MONTHLY_REPORT"


def upgrade() -> None:
    op.execute(
        f"""
        INSERT INTO notification_type (
            name,
            description,
            email_content,
            create_user,
            update_user
        )
        SELECT
            '{NOTIFICATION_TYPE}',
            'Public users monthly credit market report notification',
            'Email content',
            'system',
            'system'
        WHERE NOT EXISTS (
            SELECT 1 FROM notification_type
            WHERE name = '{NOTIFICATION_TYPE}'
        );
        """
    )


def downgrade() -> None:
    op.execute(
        f"""
        DELETE FROM notification_channel_subscription
        WHERE notification_type_id = (
            SELECT notification_type_id FROM notification_type
            WHERE name = '{NOTIFICATION_TYPE}'
        );

        DELETE FROM notification_type
        WHERE name = '{NOTIFICATION_TYPE}';
        """
    )
