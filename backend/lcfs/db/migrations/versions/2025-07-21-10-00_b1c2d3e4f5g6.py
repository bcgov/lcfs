"""Update fossil_derived field for specific fuel types

Revision ID: b1c2d3e4f5g6
Revises: 18ca5084ea87
Create Date: 2025-07-21 10:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "b1c2d3e4f5g6"
down_revision = "18ca5084ea87"
branch_labels = None
depends_on = None


def upgrade():
    """Update fossil_derived field to TRUE for specific fuel types"""
    op.execute(
        """
        UPDATE fuel_type
        SET fossil_derived = TRUE
        WHERE fuel_type IN (
            'Alternative jet fuel',
            'Ethanol',
            'Renewable gasoline',
            'Renewable naphtha',
            'Biodiesel',
            'HDRD',
            'Other diesel fuel'
        );
        """
    )


def downgrade():
    """Revert fossil_derived field to FALSE for specific fuel types"""
    op.execute(
        """
        UPDATE fuel_type
        SET fossil_derived = FALSE
        WHERE fuel_type IN (
            'Alternative jet fuel',
            'Ethanol',
            'Renewable gasoline',
            'Renewable naphtha',
            'Biodiesel',
            'HDRD',
            'Other diesel fuel'
        );
        """
    )
