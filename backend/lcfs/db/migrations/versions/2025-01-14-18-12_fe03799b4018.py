"""Update other_uses_fossil_derived in fuel_type

Revision ID: fe03799b4018
Revises: fa98709e7952
Create Date: 2025-01-14 18:12:43.683691

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "fe03799b4018"
down_revision = "5163af6ba4a4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Set other_uses_fossil_derived to false
    op.execute("""
        UPDATE fuel_type 
        SET other_uses_fossil_derived = false
        WHERE fuel_type IN (
            'CNG', 'Electricity', 'Hydrogen', 'LNG', 'Propane', 
            'Natural gas-based gasoline', 'Petroleum-based diesel', 
            'Petroleum-based gasoline'
        )
    """)

    # Set other_uses_fossil_derived to true
    op.execute("""
        UPDATE fuel_type 
        SET other_uses_fossil_derived = true
        WHERE fuel_type IN (
            'Alternative jet fuel', 'Biodiesel', 'Ethanol', 'HDRD',
            'Other diesel fuel', 'Renewable gasoline', 'Renewable naphtha'
        )
    """)

def downgrade() -> None:
    # Revert `other_uses_fossil_derived` to original values for false
    op.execute("""
        UPDATE fuel_type
        SET other_uses_fossil_derived = true
        WHERE fuel_type IN (
            'CNG', 'Electricity', 'Hydrogen', 'LNG', 'Propane',
            'Natural gas-based gasoline', 'Petroleum-based diesel',
            'Petroleum-based gasoline'
        )
    """)

    # Revert `other_uses_fossil_derived` to original values for true
    op.execute("""
        UPDATE fuel_type
        SET other_uses_fossil_derived = false
        WHERE fuel_type IN (
            'Alternative jet fuel', 'Biodiesel', 'Ethanol', 'HDRD',
            'Other diesel fuel', 'Renewable gasoline', 'Renewable naphtha'
        )
    """)
