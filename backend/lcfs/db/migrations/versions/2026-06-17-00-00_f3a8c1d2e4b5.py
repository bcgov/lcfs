"""CI application facility nameplate capacity unit -> QuantityUnitsEnum

Switches ci_application.facility_nameplate_capacity_unit_id (an FK to the
energy-density `unit_of_measure` table — the wrong lookup, surfacing MJ/L,
gCO²e/MJ, etc. in the form) to facility_nameplate_capacity_unit storing the
QuantityUnitsEnum (L, kg, kWh, Gj, m³), matching how fuel codes model a
facility nameplate capacity unit.

Revision ID: f3a8c1d2e4b5
Revises: d9c8b7a6e5f4
Create Date: 2026-06-17 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "f3a8c1d2e4b5"
down_revision = "d9c8b7a6e5f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Reuse the existing `quantityunitsenum` Postgres type (created for fuel
    # codes); do not recreate it.
    op.add_column(
        "ci_application",
        sa.Column(
            "facility_nameplate_capacity_unit",
            postgresql.ENUM(name="quantityunitsenum", create_type=False),
            nullable=True,
            comment="Unit of measure for the facility nameplate capacity",
        ),
    )
    # Existing values pointed at energy-density units and cannot be mapped to a
    # physical capacity unit, so they are intentionally not migrated (left NULL).
    # Dropping the column also drops its foreign-key constraint.
    op.drop_column("ci_application", "facility_nameplate_capacity_unit_id")


def downgrade() -> None:
    op.add_column(
        "ci_application",
        sa.Column(
            "facility_nameplate_capacity_unit_id",
            sa.Integer(),
            nullable=True,
            comment="Unit of measure for the facility nameplate capacity",
        ),
    )
    op.create_foreign_key(
        "ci_application_facility_nameplate_capacity_unit_id_fkey",
        "ci_application",
        "unit_of_measure",
        ["facility_nameplate_capacity_unit_id"],
        ["uom_id"],
    )
    op.drop_column("ci_application", "facility_nameplate_capacity_unit")
