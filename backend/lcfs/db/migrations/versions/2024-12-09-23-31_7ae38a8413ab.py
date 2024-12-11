"""Update Fuel Types measured in volume to be other-uses

Revision ID: 7ae38a8413ab
Revises: 26ab15f8ab18
Create Date: 2024-12-09 19:31:18.199089

"""

import sqlalchemy as sa
from alembic import op
from datetime import datetime

# revision identifiers, used by Alembic.
revision = "7ae38a8413ab"
down_revision = "cd8698fe40e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    current_time = datetime.now()

    # Update the `other_uses_fossil_derived` field for all specified fuel types
    op.execute(
        f"""
        UPDATE fuel_type
        SET other_uses_fossil_derived = true,
            update_date = '{current_time}',
            update_user = 'no_user'
        WHERE fuel_type IN (
            'Alternative jet fuel',
            'Biodiesel',
            'Ethanol',
            'HDRD',
            'Renewable gasoline',
            'Renewable naphtha'
        )
        """
    )

    # Update the `other_uses_fossil_derived` field for all specified fuel types
    op.execute(
        f"""
        UPDATE fuel_type
        SET other_uses_fossil_derived = false,
            update_date = '{current_time}',
            update_user = 'no_user'
        WHERE fuel_type IN (
            'CNG',
            'Electricity',
            'Hydrogen',
            'LNG',
            'Propane'
        )
        """
    )


def downgrade() -> None:
    current_time = datetime.now()

    # Revert the `other_uses_fossil_derived` field to false for the first set of fuel types
    op.execute(
        f"""
        UPDATE fuel_type
        SET other_uses_fossil_derived = false,
            update_date = '{current_time}',
            update_user = 'no_user'
        WHERE fuel_type IN (
            'Alternative jet fuel',
            'Biodiesel',
            'Ethanol',
            'HDRD',
            'Renewable gasoline',
            'Renewable naphtha'
        )
        """
    )

    # Revert the `other_uses_fossil_derived` field to true for the second set of fuel types
    op.execute(
        f"""
        UPDATE fuel_type
        SET other_uses_fossil_derived = true,
            update_date = '{current_time}',
            update_user = 'no_user'
        WHERE fuel_type IN (
            'CNG',
            'Electricity',
            'Hydrogen',
            'LNG',
            'Propane'
        )
        """
    )
