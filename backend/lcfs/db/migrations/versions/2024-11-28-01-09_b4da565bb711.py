"""Add UCI Columns to FS and Export

Revision ID: b4da565bb711
Revises: 0775a141d335
Create Date: 2024-11-28 01:09:21.241693

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "b4da565bb711"
down_revision = "043c52082a3b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column(
        "fuel_export",
        sa.Column(
            "uci",
            sa.Numeric(precision=10, scale=2),
            nullable=True,
            comment="Additional Carbon Intensity",
        ),
    )
    op.add_column(
        "fuel_supply",
        sa.Column(
            "uci",
            sa.Numeric(precision=10, scale=2),
            nullable=True,
            comment="Additional Carbon Intensity",
        ),
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column("fuel_supply", "uci")
    op.drop_column("fuel_export", "uci")
    # ### end Alembic commands ###
