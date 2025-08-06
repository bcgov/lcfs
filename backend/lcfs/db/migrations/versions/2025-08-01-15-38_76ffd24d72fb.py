"""Add BCEID credit market notification type

Revision ID: 76ffd24d72fb
Revises: 1c0b3bed4671
Create Date: 2025-08-01 15:38:58.326364

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "76ffd24d72fb"
down_revision = "1c0b3bed4671"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add BCEID credit market notification type"""
    op.execute(
        """
        INSERT INTO notification_type (notification_type_id, name, description, email_content, create_user, update_user)
        VALUES
            (21, 'BCEID__CREDIT_MARKET__CREDITS_LISTED_FOR_SALE', 'BCeID users notification when credits are listed for sale on the credit market', 'Email content', 'system', 'system');
        """
    )


def downgrade() -> None:
    """Remove BCEID credit market notification type"""
    op.execute(
        """
        DELETE FROM notification_type 
        WHERE name = 'BCEID__CREDIT_MARKET__CREDITS_LISTED_FOR_SALE';
        """
    )
