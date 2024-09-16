"""Make fuel_code_id nullable

Revision ID: a7b8c9d10e11
Revises: 84c0ff06e315
Create Date: 2024-09-16 10:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a7b8c9d10e11"
down_revision = "84c0ff06e315"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the is_allocation_provision column from provision_of_the_act table
    op.drop_column("provision_of_the_act", "is_allocation_provision")
    # Make fuel code id nullable for allocation agreements
    op.alter_column(
        "allocation_agreement",
        "fuel_code_id",
        existing_type=sa.Integer,
        nullable=True,
        existing_comment="Foreign key to the fuel code",
    )


def downgrade() -> None:
    op.alter_column(
        "allocation_agreement",
        "fuel_code_id",
        existing_type=sa.Integer,
        nullable=False,
        existing_comment="Foreign key to the fuel code",
    )
    # Add back the is_allocation_provision column to provision_of_the_act table
    op.add_column(
        "provision_of_the_act",
        sa.Column("is_allocation_provision", sa.Boolean(), nullable=True),
    )
