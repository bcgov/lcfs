"""Add government notification subscription types

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2025-12-01 12:00:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "b8c9d0e1f2a3"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # First, reset the sequence to be after the max existing ID to avoid conflicts
    op.execute(
        """
        SELECT setval(
            pg_get_serial_sequence('notification_type', 'notification_type_id'),
            COALESCE((SELECT MAX(notification_type_id) FROM notification_type), 0) + 1,
            false
        );
        """
    )

    # Insert notification types only if they don't already exist
    op.execute(
        """
        INSERT INTO notification_type (name, description, email_content, role_id, create_user, update_user)
        SELECT 'BCEID__GOVERNMENT_NOTIFICATION', 'Government notifications (alerts, deadlines & outages)', 'Email content', 2, 'system', 'system'
        WHERE NOT EXISTS (SELECT 1 FROM notification_type WHERE name = 'BCEID__GOVERNMENT_NOTIFICATION');
        """
    )
    op.execute(
        """
        INSERT INTO notification_type (name, description, email_content, role_id, create_user, update_user)
        SELECT 'IDIR_ANALYST__GOVERNMENT_NOTIFICATION', 'Government notifications (alerts, deadlines & outages)', 'Email content', 4, 'system', 'system'
        WHERE NOT EXISTS (SELECT 1 FROM notification_type WHERE name = 'IDIR_ANALYST__GOVERNMENT_NOTIFICATION');
        """
    )
    op.execute(
        """
        INSERT INTO notification_type (name, description, email_content, role_id, create_user, update_user)
        SELECT 'IDIR_COMPLIANCE_MANAGER__GOVERNMENT_NOTIFICATION', 'Government notifications (alerts, deadlines & outages)', 'Email content', 5, 'system', 'system'
        WHERE NOT EXISTS (SELECT 1 FROM notification_type WHERE name = 'IDIR_COMPLIANCE_MANAGER__GOVERNMENT_NOTIFICATION');
        """
    )
    op.execute(
        """
        INSERT INTO notification_type (name, description, email_content, role_id, create_user, update_user)
        SELECT 'IDIR_DIRECTOR__GOVERNMENT_NOTIFICATION', 'Government notifications (alerts, deadlines & outages)', 'Email content', 6, 'system', 'system'
        WHERE NOT EXISTS (SELECT 1 FROM notification_type WHERE name = 'IDIR_DIRECTOR__GOVERNMENT_NOTIFICATION');
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM notification_type
        WHERE name IN (
            'BCEID__GOVERNMENT_NOTIFICATION',
            'IDIR_ANALYST__GOVERNMENT_NOTIFICATION',
            'IDIR_COMPLIANCE_MANAGER__GOVERNMENT_NOTIFICATION',
            'IDIR_DIRECTOR__GOVERNMENT_NOTIFICATION'
        );
        """
    )
