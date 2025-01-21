"""remove fuel measurement type

Revision ID: 9785f4cfa370
Revises: 98d79870df6b
Create Date: 2025-01-21 06:31:56.922437

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "9785f4cfa370"
down_revision = "c306137b57ab"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    # First drop the foreign key constraint
    op.drop_constraint(
        "fk_final_supply_equipment_fuel_measurement_type_id_fuel_678d",
        "final_supply_equipment",
        type_="foreignkey",
    )
    # Then drop the index
    op.drop_index(
        "ix_final_supply_equipment_fuel_measurement_type_id",
        table_name="final_supply_equipment",
    )
    # Drop the column
    op.drop_column("final_supply_equipment", "fuel_measurement_type_id")
    # Finally drop the table
    op.drop_table("fuel_measurement_type")
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column(
        "final_supply_equipment",
        sa.Column(
            "fuel_measurement_type_id",
            sa.INTEGER(),
            autoincrement=False,
            nullable=False,
            comment="The foreign key referencing the fuel measurement type.",
        ),
    )
    op.create_foreign_key(
        "fk_final_supply_equipment_fuel_measurement_type_id_fuel_678d",
        "final_supply_equipment",
        "fuel_measurement_type",
        ["fuel_measurement_type_id"],
        ["fuel_measurement_type_id"],
    )
    op.create_index(
        "ix_final_supply_equipment_fuel_measurement_type_id",
        "final_supply_equipment",
        ["fuel_measurement_type_id"],
        unique=False,
    )
    op.create_table(
        "fuel_measurement_type",
        sa.Column(
            "fuel_measurement_type_id",
            sa.INTEGER(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the fuel measurement type",
        ),
        sa.Column(
            "type",
            sa.VARCHAR(),
            autoincrement=False,
            nullable=False,
            comment="Name of the fuel measurement type",
        ),
        sa.Column(
            "description",
            sa.TEXT(),
            autoincrement=False,
            nullable=True,
            comment="Description of the fuel measurement type",
        ),
        sa.Column(
            "create_date",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            autoincrement=False,
            nullable=True,
            comment="Date and time (UTC) when the physical record was created in the database.",
        ),
        sa.Column(
            "update_date",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            autoincrement=False,
            nullable=True,
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
        ),
        sa.Column(
            "create_user",
            sa.VARCHAR(),
            autoincrement=False,
            nullable=True,
            comment="The user who created this record in the database.",
        ),
        sa.Column(
            "update_user",
            sa.VARCHAR(),
            autoincrement=False,
            nullable=True,
            comment="The user who last updated this record in the database.",
        ),
        sa.Column(
            "display_order",
            sa.INTEGER(),
            autoincrement=False,
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.PrimaryKeyConstraint(
            "fuel_measurement_type_id", name="pk_fuel_measurement_type"
        ),
        comment="Fuel measurement type",
    )
    # ### end Alembic commands ###
