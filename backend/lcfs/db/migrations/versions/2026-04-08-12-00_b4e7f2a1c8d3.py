"""Update unit of measure label m³ to m³ (15°C and 1 atm)

Revision ID: b4e7f2a1c8d3
Revises: 098cf79762b9
Create Date: 2026-04-08 12:00:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "b4e7f2a1c8d3"
down_revision = "098cf79762b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "UPDATE unit_of_measure "
        "SET name = 'MJ/m³ (15°C and 1 atm)' "
        "WHERE uom_id = 3"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE unit_of_measure "
        "SET name = 'MJ/m³' "
        "WHERE uom_id = 3"
    )
