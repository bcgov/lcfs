"""add user to txn history

Revision ID: 0ad956decbc4
Revises: 5674d1e61df6
Create Date: 2024-03-22 13:08:25.430681

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0ad956decbc4"
down_revision = "50e5a5a54dca"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "transfer_history",
        sa.Column(
            "user_profile_id",
            sa.Integer(),
            nullable=True,
            comment="Foreign key to user_profile",
        ),
    )
    op.create_foreign_key(
        None,
        "transfer_history",
        "user_profile",
        ["user_profile_id"],
        ["user_profile_id"],
    )


def downgrade() -> None:
    op.drop_constraint(None, "transfer_history", type_="foreignkey")
    op.drop_column("transfer_history", "user_profile_id")
