"""Add data columns to Fuel supply

Revision ID: 7cc97001b3b3
Revises: 123456789abc
Create Date: 2024-08-01 02:34:42.030181

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "7cc97001b3b3"
down_revision = "37721d823e5e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column(
        "fuel_supply",
        sa.Column(
            "units",
            postgresql.ENUM(
                "Litres",
                "Kilograms",
                "Kilowatt_hour",
                "Cubic_metres",
                name="quantityunitsenum",
                create_type=False,
            ),
            nullable=False,
            comment="Units of fuel quantity",
        ),
    )
    op.add_column(
        "fuel_supply",
        sa.Column(
            "ci_limit",
            sa.Float(),
            nullable=True,
            comment="CI limit for the fuel supply",
        ),
    )
    op.add_column(
        "fuel_supply",
        sa.Column(
            "ci_of_fuel",
            sa.Float(),
            nullable=True,
            comment="CI of fuel for the fuel supply",
        ),
    )
    op.add_column(
        "fuel_supply",
        sa.Column(
            "energy_density",
            sa.Float(),
            nullable=True,
            comment="Energy density of the fuel supplied",
        ),
    )
    op.add_column(
        "fuel_supply",
        sa.Column(
            "eer",
            sa.Float(),
            nullable=True,
            comment="Energy effectiveness ratio of the fuel supplied",
        ),
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column("fuel_supply", "eer")
    op.drop_column("fuel_supply", "energy_density")
    op.drop_column("fuel_supply", "ci_of_fuel")
    op.drop_column("fuel_supply", "ci_limit")
    op.drop_column("fuel_supply", "units")
    # ### end Alembic commands ###
