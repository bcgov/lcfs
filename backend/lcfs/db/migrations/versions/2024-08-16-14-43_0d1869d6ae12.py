"""add change type to fuel supply

Revision ID: 0d1869d6ae12
Revises: 2f1e766ef118
Create Date: 2024-08-16 14:43:36.203253

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0d1869d6ae12"
down_revision = "2f1e766ef118"
branch_labels = None
depends_on = None


def upgrade() -> None:
    sa.Enum("CREATE", "UPDATE", "DELETE", name="changetype").create(op.get_bind())
    op.add_column(
        "fuel_supply",
        sa.Column(
            "change_type",
            postgresql.ENUM(
                "CREATE", "UPDATE", "DELETE", name="changetype", create_type=False
            ),
            server_default=sa.text("'CREATE'"),
            nullable=False,
            comment="Action type for this record",
        ),
    )


def downgrade() -> None:
    op.drop_column("fuel_supply", "change_type")
    sa.Enum("CREATE", "UPDATE", "DELETE", name="changetype").drop(op.get_bind())
