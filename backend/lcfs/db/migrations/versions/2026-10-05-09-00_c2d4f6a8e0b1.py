"""Add internal comment @mention notification type.

Revision ID: c2d4f6a8e0b1
Revises: b1c3e5a7d9f2
Create Date: 2026-10-05 09:00:00.000000
"""

from alembic import op

revision = "c2d4f6a8e0b1"
down_revision = "b1c3e5a7d9f2"
branch_labels = None
depends_on = None

_NAME = "IDIR_ANY__INTERNAL_COMMENT__MENTION"
_DESCRIPTION = "Mentioned (@) by another IDIR user in an internal comment"


def upgrade() -> None:
    op.execute(
        """
        SELECT setval(
            pg_get_serial_sequence('notification_type', 'notification_type_id'),
            COALESCE((SELECT MAX(notification_type_id) FROM notification_type), 0) + 1,
            false
        );
        """
    )
    op.execute(
        f"""
        INSERT INTO notification_type (name, description, email_content, create_user, update_user)
        SELECT '{_NAME}', '{_DESCRIPTION}', 'Email content', 'system', 'system'
        WHERE NOT EXISTS (
            SELECT 1 FROM notification_type WHERE name = '{_NAME}'
        );
        """
    )


def downgrade() -> None:
    op.execute(
        f"""
        DELETE FROM notification_message
        WHERE notification_type_id IN (
            SELECT notification_type_id FROM notification_type WHERE name = '{_NAME}'
        );
        """
    )
    op.execute(
        f"""
        DELETE FROM notification_type WHERE name = '{_NAME}';
        """
    )
