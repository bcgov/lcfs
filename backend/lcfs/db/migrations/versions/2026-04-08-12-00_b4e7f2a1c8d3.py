"""Update unit of measure label m³ to m³ (15°C and 1 atm)

Revision ID: b4e7f2a1c8d3
Revises: e0f9a4a6316a
Create Date: 2026-04-08 12:00:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "b4e7f2a1c8d3"
down_revision = "e0f9a4a6316a"
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
