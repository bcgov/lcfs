"""add user_profile to issuance histories

Revision ID: 0ccbc5a94660
Revises: a80d8ef0ea45
Create Date: 2024-05-08 16:45:40.760495

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0ccbc5a94660"
down_revision = "a80d8ef0ea45"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "admin_adjustment_history",
        sa.Column(
            "user_profile_id",
            sa.Integer(),
            nullable=True,
            comment="Foreign key to user_profile",
        ),
    )
    op.create_foreign_key(
        None,
        "admin_adjustment_history",
        "user_profile",
        ["user_profile_id"],
        ["user_profile_id"],
    )
    op.add_column(
        "initiative_agreement_history",
        sa.Column(
            "user_profile_id",
            sa.Integer(),
            nullable=True,
            comment="Foreign key to user_profile",
        ),
    )
    op.create_foreign_key(
        None,
        "initiative_agreement_history",
        "user_profile",
        ["user_profile_id"],
        ["user_profile_id"],
    )


def downgrade() -> None:
    op.drop_constraint(None, "initiative_agreement_history", type_="foreignkey")
    op.drop_column("initiative_agreement_history", "user_profile_id")
    op.drop_constraint(None, "admin_adjustment_history", type_="foreignkey")
    op.drop_column("admin_adjustment_history", "user_profile_id")
