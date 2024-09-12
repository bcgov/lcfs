"""allocation provisions

Revision ID: 9d93dc700752
Revises: 401c9ed94cdb
Create Date: 2024-08-23 14:59:44.711891

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
from sqlalchemy.sql import table, column

# revision identifiers, used by Alembic.
revision = "9d93dc700752"
down_revision = "401c9ed94cdb"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_allocation_provision column to provision_of_the_act table
    op.add_column(
        "provision_of_the_act",
        sa.Column("is_allocation_provision", sa.Boolean(), nullable=True),
    )

    # Add ci_of_fuel column to allocation_agreement table
    op.add_column(
        "allocation_agreement",
        sa.Column(
            "ci_of_fuel",
            sa.Float(),
            nullable=True,  # Temporarily allow NULL
            comment="The Carbon intensity of fuel",
        ),
    )

    # Create a SQLAlchemy table object for the allocation_agreement table
    allocation_agreement = table(
        "allocation_agreement",
        column("ci_fuel", sa.Integer),
        column("ci_of_fuel", sa.Float),
    )

    # Transfer data from ci_fuel to ci_of_fuel
    op.execute(
        allocation_agreement.update().values(ci_of_fuel=allocation_agreement.c.ci_fuel)
    )

    # Now make ci_of_fuel non-nullable
    op.alter_column("allocation_agreement", "ci_of_fuel", nullable=False)

    # Drop the old ci_fuel column
    op.drop_column("allocation_agreement", "ci_fuel")


def downgrade() -> None:
    # Add back the ci_fuel column
    op.add_column(
        "allocation_agreement",
        sa.Column(
            "ci_fuel",
            sa.INTEGER(),
            autoincrement=False,
            nullable=True,  # Temporarily allow NULL
            comment="The Carbon intensity of fuel",
        ),
    )

    # Create a SQLAlchemy table object for the allocation_agreement table
    allocation_agreement = table(
        "allocation_agreement",
        column("ci_fuel", sa.Integer),
        column("ci_of_fuel", sa.Float),
    )

    # Transfer data from ci_of_fuel back to ci_fuel
    op.execute(
        allocation_agreement.update().values(
            ci_fuel=sa.cast(allocation_agreement.c.ci_of_fuel, sa.Integer)
        )
    )

    # Now make ci_fuel non-nullable
    op.alter_column("allocation_agreement", "ci_fuel", nullable=False)

    # Drop the ci_of_fuel column
    op.drop_column("allocation_agreement", "ci_of_fuel")

    # Drop the is_allocation_provision column from provision_of_the_act table
    op.drop_column("provision_of_the_act", "is_allocation_provision")
