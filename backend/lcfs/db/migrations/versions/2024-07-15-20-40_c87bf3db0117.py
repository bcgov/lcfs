"""Add registration_nbr column to final_supply_equipment table

Revision ID: c87bf3db0117
Revises: c84d9bf8d3a6
Create Date: 2024-07-15 20:40:57.911410

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "c87bf3db0117"
down_revision = "c84d9bf8d3a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "final_supply_equipment",
        sa.Column(
            "registration_nbr",
            sa.String(),
            nullable=True,
            comment="Unique registration number in format ORGCODE-POSTAL-SEQ (e.g., AB55-V3B0G2-001)",
        ),
    )
    op.create_index(
        op.f("ix_final_supply_equipment_registration_nbr"),
        "final_supply_equipment",
        ["registration_nbr"]
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_final_supply_equipment_registration_nbr"),
        table_name="final_supply_equipment",
    )
    op.drop_column("final_supply_equipment", "registration_nbr")
