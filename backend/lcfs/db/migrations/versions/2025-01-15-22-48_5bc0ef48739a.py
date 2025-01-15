"""add truck and marine transport mode

Revision ID: 5bc0ef48739a
Revises: f78e53370ed2
Create Date: 2025-01-15 22:48:43.582069

"""

import sqlalchemy as sa
from alembic import op
from datetime import datetime

# revision identifiers, used by Alembic.
revision = "5bc0ef48739a"
down_revision = "f78e53370ed2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    current_time = datetime.now()

    # Insert Truck and Marine transport modes
    op.execute(
        """
        INSERT INTO transport_mode (transport_mode, create_date, update_date, create_user, update_user)
        VALUES 
            ('Truck', '{}', '{}', 'no_user', 'no_user'),
            ('Marine', '{}', '{}', 'no_user', 'no_user')

        """.format(
            current_time, current_time, current_time, current_time
        )
    )


def downgrade() -> None:
    # Remove Truck and Marine transport modes
    op.execute(
        """
        DELETE FROM transport_mode
        WHERE transport_mode IN ('Truck', 'Marine')
        """
    )
