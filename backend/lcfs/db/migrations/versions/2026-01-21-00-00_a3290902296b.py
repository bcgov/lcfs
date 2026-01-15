"""add renewable diesel fuel type

Revision ID: a3290902296b
Revises: 5897848af3c9
Create Date: 2025-04-11 13:29:03.149771

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "a3290902296b"
down_revision = "5897848af3c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO fuel_type (
            fuel_type_id,
            fuel_type,
            fossil_derived,
            provision_1_id,
            provision_2_id,
            default_carbon_intensity,
            units,
            unrecognized,
            is_legacy,
            renewable
        )
        SELECT
            24,
            'Renewable diesel',
            FALSE,
            NULL,
            NULL,
            100.21,
            'Litres',
            FALSE,
            TRUE,
            TRUE
        WHERE NOT EXISTS (
            SELECT 1 FROM fuel_type WHERE fuel_type_id = 24
        );
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM fuel_type
        WHERE fuel_type_id = 24;
        """
    )
