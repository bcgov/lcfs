"""add fuel code notifications

Revision ID: 674478937015
Revises: a1b2c3d4e5f7
Create Date: 2025-07-22 07:37:02.573354

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "674478937015"
down_revision = "a1b2c3d4e5f7"
branch_labels = None
depends_on = None


def upgrade():
    """Add fuel code notification types to notification_type table"""

    op.execute(
        """
        INSERT INTO notification_type (notification_type_id, name, description, email_content, create_user, update_user)
        VALUES
            (18, 'IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION', 'Analyst recommendation provided for the fuel code', 'Email content', 'system', 'system'),
            (19, 'IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED', 'Director returned fuel code to analyst', 'Email content', 'system', 'system'),
            (20, 'IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL', 'Director approved fuel code', 'Email content', 'system', 'system')
        ON CONFLICT (notification_type_id) DO NOTHING;
        """
    )


def downgrade():
    """Remove fuel code notification types"""

    op.execute(
        """
        DELETE FROM notification_type 
        WHERE name IN (
            'IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION',
            'IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED',
            'IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL'
        );
        """
    )
