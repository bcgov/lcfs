"""Adding provision_of_the_act_id, fuel_code_id and ci_of_fuel fields

Revision ID: e1e0aecfa5bb
Revises: b659816d0a86
Create Date: 2024-11-18 12:57:24.002077

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "e1e0aecfa5bb"
down_revision = "b659816d0a86"
branch_labels = None
depends_on = None


def upgrade():
    # Adding provision_of_the_act_id field
    op.add_column(
        "other_uses",
        sa.Column("provision_of_the_act_id", sa.Integer(), nullable=True),
    )

    # Adding fuel_code_id field
    op.add_column(
        "other_uses",
        sa.Column("fuel_code_id", sa.Integer(), nullable=True),
    )

    # Adding ci_of_fuel field
    op.add_column(
        "other_uses",
        sa.Column("ci_of_fuel", sa.Numeric(precision=10, scale=4), nullable=True),
    )


def downgrade():
    # Dropping ci_of_fuel field
    op.drop_column("other_uses", "ci_of_fuel")

    # Dropping fuel_code_id field
    op.drop_column("other_uses", "fuel_code_id")

    # Dropping provision_of_the_act_id field
    op.drop_column("other_uses", "provision_of_the_act_id")
