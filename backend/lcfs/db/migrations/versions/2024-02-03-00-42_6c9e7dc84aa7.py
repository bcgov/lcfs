"""username_remove_signing_declaration

Revision ID: 6c9e7dc84aa7
Revises: 23ea1a75213c
Create Date: 2024-02-03 00:42:18.005179

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "6c9e7dc84aa7"
down_revision = "23ea1a75213c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "transfer",
        sa.Column("signing_authority_declaration", sa.Boolean(), nullable=True),
    )
    op.alter_column(
        "transfer",
        "price_per_unit",
        existing_type=sa.NUMERIC(),
        type_=sa.Integer(),
        comment="Price per unit",
        existing_comment="The fair market value of any consideration, in Canadian dollars, per validated credit being transferred.",
        existing_nullable=True,
    )
    op.alter_column(
        "transfer_history",
        "price_per_unit",
        existing_type=sa.NUMERIC(),
        type_=sa.Integer(),
        comment="Price per unit",
        existing_comment="The fair market value of any consideration, in Canadian dollars, per validated credit being transferred.",
        existing_nullable=True,
    )
    op.drop_constraint("user_profile_username_key", "user_profile", type_="unique")
    op.drop_column("user_profile", "username")


def downgrade() -> None:
    op.add_column(
        "user_profile",
        sa.Column(
            "username",
            sa.VARCHAR(length=150),
            autoincrement=False,
            nullable=False,
            comment="Login Username",
        ),
    )
    op.create_unique_constraint(
        "user_profile_username_key", "user_profile", ["username"]
    )
    op.alter_column(
        "transfer_history",
        "price_per_unit",
        existing_type=sa.Integer(),
        type_=sa.NUMERIC(),
        comment="The fair market value of any consideration, in Canadian dollars, per validated credit being transferred.",
        existing_comment="Price per unit",
        existing_nullable=True,
    )
    op.alter_column(
        "transfer",
        "price_per_unit",
        existing_type=sa.Integer(),
        type_=sa.NUMERIC(),
        comment="The fair market value of any consideration, in Canadian dollars, per validated credit being transferred.",
        existing_comment="Price per unit",
        existing_nullable=True,
    )
    op.drop_column("transfer", "signing_authority_declaration")
