"""Add CI application notification types for IDIR analysts.

Revision ID: 9b5d3c7e1f0a
Revises: a8f0b1c2d3e4
Create Date: 2026-07-30 09:00:00.000000
"""

from alembic import op

revision = "9b5d3c7e1f0a"
down_revision = "a8f0b1c2d3e4"
branch_labels = None
depends_on = None

_TYPES = [
    (
        "IDIR_ANALYST__CI_APPLICATION__DIRECTOR_APPROVAL",
        "Director approved CI application",
    ),
    (
        "IDIR_ANALYST__CI_APPLICATION__DIRECTOR_RETURNED",
        "Director returned CI application to analyst",
    ),
    (
        "IDIR_ANALYST__CI_APPLICATION__APPLICANT_ACTIVITY",
        "CI application submitted, additional information provided or comment received by BCeID applicant",
    ),
]


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
    for name, description in _TYPES:
        op.execute(
            f"""
            INSERT INTO notification_type (name, description, email_content, role_id, create_user, update_user)
            SELECT '{name}', '{description}', 'Email content', 4, 'system', 'system'
            WHERE NOT EXISTS (
                SELECT 1 FROM notification_type WHERE name = '{name}'
            );
            """
        )


def downgrade() -> None:
    names = ", ".join(f"'{name}'" for name, _ in _TYPES)
    op.execute(
        f"""
        DELETE FROM notification_channel_subscription
        WHERE notification_type_id IN (
            SELECT notification_type_id FROM notification_type
            WHERE name IN ({names})
        );

        DELETE FROM notification_type
        WHERE name IN ({names});
        """
    )
