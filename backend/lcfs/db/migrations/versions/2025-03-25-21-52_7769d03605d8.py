"""Make export_date in the fuel_export table nullable and add 'Unknown' record to the provision_of_the_act table.

Revision ID: 7769d03605d8
Revises: ac0ac5d0c81b
Create Date: 2025-03-25 21:52:53.119756
"""

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic
revision = "7769d03605d8"
down_revision = "ac0ac5d0c81b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        table_name="fuel_export",
        column_name="export_date",
        existing_type=sa.Date(),
        nullable=True,
    )

    op.execute(
        """
        INSERT INTO provision_of_the_act (
            name, description, is_legacy, display_order, effective_status
        )
        VALUES (
            'Unknown',
            'Used for Determining CI when the user cannot specify any known provision',
            FALSE,
            9999,
            TRUE
        )
        ON CONFLICT (name) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.alter_column(
        table_name="fuel_export",
        column_name="export_date",
        existing_type=sa.Date(),
        nullable=False,
    )

    op.execute(
        """
        DELETE FROM provision_of_the_act
        WHERE name = 'Unknown';
        """
    )
