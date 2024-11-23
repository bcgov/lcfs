"""Add options to the Feedstock Transport mode fuel code

Revision ID: 043c52082a3b
Revises: 1974af823b80
Create Date: 2024-11-22 15:05:12.015327

"""
from datetime import datetime
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "043c52082a3b"
down_revision = "1974af823b80"
branch_labels = None
depends_on = None


def upgrade():
    current_time = datetime.now()

    # Update Marine to Marine-domestic
    op.execute(
        """
        UPDATE transport_mode
        SET transport_mode = 'Marine-domestic',
            update_date = '{}',
            update_user = 'no-user'
        WHERE transport_mode = 'Marine'
        """.format(current_time)
    )

    # Insert Marine-international
    op.execute(
        """
        INSERT INTO transport_mode (transport_mode, create_date, update_date, create_user, update_user)
        VALUES ('Marine-international', '{}', '{}', 'no_user', 'no_user')
        """.format(current_time, current_time)
    )


def downgrade():
    # Revert Marine-domestic back to Marine
    op.execute(
        """
        UPDATE transport_mode
        SET transport_mode = 'Marine',
            update_date = '{}',
            update_user = 'no_user'
        WHERE transport_mode = 'Marine-domestic'
        """.format(datetime.utcnow())
    )

    # Remove Marine-international
    op.execute(
        """
        DELETE FROM transport_mode
        WHERE transport_mode = 'Marine-international'
        """
    )