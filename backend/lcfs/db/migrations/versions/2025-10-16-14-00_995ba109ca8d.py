"""Add charging equipment intended users association

Revision ID: 995ba109ca8d
Revises: 63c126dcbecc
Create Date: 2025-10-16 14:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "995ba109ca8d"
down_revision = "63c126dcbecc"
branch_labels = None
depends_on = None


def table_exists(table_name):
    """Check if a table exists"""
    bind = op.get_bind()
    inspector = inspect(bind)
    return table_name in inspector.get_table_names()


def index_exists(index_name, table_name):
    """Check if an index exists"""
    bind = op.get_bind()
    inspector = inspect(bind)
    indexes = inspector.get_indexes(table_name)
    return any(idx['name'] == index_name for idx in indexes)


def upgrade() -> None:
    # Create the charging_equipment_intended_user_association table only if it doesn't exist
    if not table_exists("charging_equipment_intended_user_association"):
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

    # Create indexes for better query performance (only if they don't exist)
    if table_exists("charging_equipment_intended_user_association"):
        if not index_exists("ix_ce_intended_user_equipment_id", "charging_equipment_intended_user_association"):
            op.create_index(
                "ix_ce_intended_user_equipment_id",
                "charging_equipment_intended_user_association",
                ["charging_equipment_id"],
            )
        if not index_exists("ix_ce_intended_user_user_type_id", "charging_equipment_intended_user_association"):
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
