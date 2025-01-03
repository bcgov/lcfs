"""Add is_legacy to fuel_type

Revision ID: ca7200152130
Revises: 9329e38396e1
Create Date: 2025-01-03 18:43:43.638740

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "ca7200152130"
down_revision = "9329e38396e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column(
        "fuel_type",
        sa.Column(
            "is_legacy",
            sa.Boolean(),
            server_default=sa.text("FALSE"),
            nullable=False,
            comment="Indicates if the fuel type is legacy and should not be used for new reports",
        ),
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column("fuel_type", "is_legacy")
    # ### end Alembic commands ###
