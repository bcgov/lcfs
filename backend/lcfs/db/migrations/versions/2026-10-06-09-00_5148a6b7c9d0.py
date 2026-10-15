"""Correct the Hydrogen energy density unit of measure.

Revision ID: 5148a6b7c9d0
Revises: b1c3e5a7d9f2
Create Date: 2026-10-06 09:00:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "5148a6b7c9d0"
down_revision = "b1c3e5a7d9f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE energy_density AS ed
        SET uom_id = kg.uom_id,
            update_user = 'migration_5148_hydrogen_energy_density_unit'
        FROM fuel_type AS ft
        CROSS JOIN unit_of_measure AS kg
        WHERE ed.fuel_type_id = ft.fuel_type_id
          AND ft.fuel_type = 'Hydrogen'
          AND kg.name = 'MJ/kg'
          AND ed.uom_id <> kg.uom_id;
        """
    )


def downgrade() -> None:
    # Restoring the incorrect Hydrogen unit would reintroduce the defect.
    pass
