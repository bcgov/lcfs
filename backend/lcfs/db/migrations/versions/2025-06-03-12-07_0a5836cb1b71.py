"""Add quarterly fields to allocation_agreement table

Revision ID: 0a5836cb1b71
Revises: 15b79c70409d
Create Date: 2025-06-03 12:07:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0a5836cb1b71"
down_revision = "15b79c70409d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Modify the quantity column to be nullable (for backward compatibility)
    op.alter_column(
        "allocation_agreement",
        "quantity",
        existing_type=sa.Integer(),
        nullable=True,
        comment="Quantity of fuel involved in the transaction",
    )

    # Add quarterly quantity columns
    op.add_column(
        "allocation_agreement",
        sa.Column(
            "q1_quantity",
            sa.Integer(),
            nullable=True,
            comment="Quantity of fuel involved in Q1 (early issuance only)",
        ),
    )
    op.add_column(
        "allocation_agreement",
        sa.Column(
            "q2_quantity",
            sa.Integer(),
            nullable=True,
            comment="Quantity of fuel involved in Q2 (early issuance only)",
        ),
    )
    op.add_column(
        "allocation_agreement",
        sa.Column(
            "q3_quantity",
            sa.Integer(),
            nullable=True,
            comment="Quantity of fuel involved in Q3 (early issuance only)",
        ),
    )
    op.add_column(
        "allocation_agreement",
        sa.Column(
            "q4_quantity",
            sa.Integer(),
            nullable=True,
            comment="Quantity of fuel involved in Q4 (early issuance only)",
        ),
    )


def downgrade() -> None:
    # Remove quarterly columns
    op.drop_column("allocation_agreement", "q4_quantity")
    op.drop_column("allocation_agreement", "q3_quantity")
    op.drop_column("allocation_agreement", "q2_quantity")
    op.drop_column("allocation_agreement", "q1_quantity")

    # Revert quantity column to not nullable
    op.alter_column(
        "allocation_agreement",
        "quantity",
        existing_type=sa.Integer(),
        nullable=False,
        comment="Quantity of fuel involved in the transaction",
    )
