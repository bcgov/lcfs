"""Add charging equipment intended users association

Revision ID: add_ce_intended_users
Revises: 63c126dcbecc
Create Date: 2025-10-16 14:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "add_ce_intended_users"
down_revision = "63c126dcbecc"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the charging_equipment_intended_user_association table
    op.create_table(
        "charging_equipment_intended_user_association",
        sa.Column(
            "charging_equipment_id",
            sa.Integer(),
            sa.ForeignKey(
                "charging_equipment.charging_equipment_id", ondelete="CASCADE"
            ),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "end_user_type_id",
            sa.Integer(),
            sa.ForeignKey("end_user_type.end_user_type_id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
        comment="Association table linking charging equipment to their intended user types (MURB, Fleet, Public, Employee)",
    )

    # Create indexes for better query performance
    op.create_index(
        "ix_ce_intended_user_equipment_id",
        "charging_equipment_intended_user_association",
        ["charging_equipment_id"],
    )
    op.create_index(
        "ix_ce_intended_user_user_type_id",
        "charging_equipment_intended_user_association",
        ["end_user_type_id"],
    )


def downgrade() -> None:
    # Drop indexes first
    op.drop_index(
        "ix_ce_intended_user_user_type_id",
        table_name="charging_equipment_intended_user_association",
    )
    op.drop_index(
        "ix_ce_intended_user_equipment_id",
        table_name="charging_equipment_intended_user_association",
    )

    # Drop the association table
    op.drop_table("charging_equipment_intended_user_association")
