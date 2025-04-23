"""add renewable diesel fuel type

Revision ID: a3290902296b
Revises: 4f18d1a47c91
Create Date: 2025-04-11 13:29:03.149771

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "a3290902296b"
down_revision = "4f18d1a47c91"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO fuel_type (
            fuel_type_id, 
            fuel_type, 
            fossil_derived, 
            other_uses_fossil_derived,
            provision_1_id, 
            provision_2_id, 
            default_carbon_intensity, 
            units, 
            unrecognized,
            is_legacy,
            renewable
        )
        VALUES (
            24, 
            'Renewable diesel', 
            FALSE, 
            TRUE, 
            NULL, 
            NULL, 
            100.21, 
            'Litres', 
            FALSE,
            TRUE,
            TRUE
        )
        ON CONFLICT (fuel_type_id) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM fuel_type
        WHERE fuel_type_id = 24;
        """
    )
