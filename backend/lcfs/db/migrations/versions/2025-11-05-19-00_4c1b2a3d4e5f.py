"""Add charging power output association table

Revision ID: 4c1b2a3d4e5f
Revises: 5e1a2c3d4f67
Create Date: 2025-11-19 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "4c1b2a3d4e5f"
down_revision = "5e1a2c3d4f67"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "charging_power_output",
        sa.Column(
            "charging_power_output_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Primary key",
        ),
        sa.Column(
            "end_use_type_id",
            sa.Integer(),
            nullable=False,
            comment="Associated end use type",
        ),
        sa.Column(
            "end_user_type_id",
            sa.Integer(),
            nullable=False,
            comment="Associated end user type",
        ),
        sa.Column(
            "level_of_equipment_id",
            sa.Integer(),
            nullable=False,
            comment="Associated charging level",
        ),
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=False,
            server_default="0",
            comment="Priority for selecting among multiple matching rows",
        ),
        sa.Column(
            "charger_power_output",
            sa.Numeric(8, 2),
            nullable=False,
            comment="Power output (kW) for this combination",
        ),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was created in the database.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the record was updated in the database.",
        ),
        sa.Column(
            "create_user",
            sa.String(),
            nullable=True,
            comment="The user who created this record in the database.",
        ),
        sa.Column(
            "update_user",
            sa.String(),
            nullable=True,
            comment="The user who last updated this record in the database.",
        ),
        sa.ForeignKeyConstraint(
            ["end_use_type_id"],
            ["end_use_type.end_use_type_id"],
            name="fk_charging_power_output_end_use_type_id_end_use_type",
        ),
        sa.ForeignKeyConstraint(
            ["end_user_type_id"],
            ["end_user_type.end_user_type_id"],
            name="fk_charging_power_output_end_user_type_id_end_user_type",
        ),
        sa.ForeignKeyConstraint(
            ["level_of_equipment_id"],
            ["level_of_equipment.level_of_equipment_id"],
            name="fk_cpo_level_of_equipment_id",
        ),
        sa.PrimaryKeyConstraint(
            "charging_power_output_id",
            name="pk_charging_power_output",
        ),
        sa.UniqueConstraint(
            "end_use_type_id",
            "end_user_type_id",
            "level_of_equipment_id",
            name="uq_charging_power_output_end_use_user_level",
        ),
        comment="Reference power output (kW) for a given end use, end user, and charging level",
    )


def downgrade() -> None:
    op.drop_table("charging_power_output")
