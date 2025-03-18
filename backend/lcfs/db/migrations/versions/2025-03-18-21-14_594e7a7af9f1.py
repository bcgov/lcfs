"""Remove User Type

Revision ID: 594e7a7af9f1
Revises: bd4da1540e2e
Create Date: 2025-03-13 20:19:32.260970

"""

import sqlalchemy as sa
from alembic import op
from alembic_postgresql_enum import TableReference
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "594e7a7af9f1"
down_revision = "bd4da1540e2e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("allocation_agreement", "user_type")
    op.drop_column("fuel_export", "user_type")
    op.drop_column("fuel_supply", "user_type")
    op.drop_column("notional_transfer", "user_type")
    op.drop_column("other_uses", "user_type")


def downgrade() -> None:
    op.add_column(
        "other_uses",
        sa.Column(
            "user_type",
            postgresql.ENUM(
                "SUPPLIER", "GOVERNMENT", name="usertypeenum", create_type=False
            ),
            autoincrement=False,
            nullable=False,
            comment="Indicates whether the record was created/modified by a supplier or government user",
        ),
    )
    op.add_column(
        "notional_transfer",
        sa.Column(
            "user_type",
            postgresql.ENUM(
                "SUPPLIER", "GOVERNMENT", name="usertypeenum", create_type=False
            ),
            autoincrement=False,
            nullable=False,
            comment="Indicates whether the record was created/modified by a supplier or government user",
        ),
    )
    op.add_column(
        "fuel_supply",
        sa.Column(
            "user_type",
            postgresql.ENUM(
                "SUPPLIER", "GOVERNMENT", name="usertypeenum", create_type=False
            ),
            autoincrement=False,
            nullable=False,
            comment="Indicates whether the record was created/modified by a supplier or government user",
        ),
    )
    op.add_column(
        "fuel_export",
        sa.Column(
            "user_type",
            postgresql.ENUM(
                "SUPPLIER", "GOVERNMENT", name="usertypeenum", create_type=False
            ),
            autoincrement=False,
            nullable=False,
            comment="Indicates whether the record was created/modified by a supplier or government user",
        ),
    )
    op.add_column(
        "allocation_agreement",
        sa.Column(
            "user_type",
            postgresql.ENUM(
                "SUPPLIER", "GOVERNMENT", name="usertypeenum", create_type=False
            ),
            autoincrement=False,
            nullable=False,
        ),
    )
