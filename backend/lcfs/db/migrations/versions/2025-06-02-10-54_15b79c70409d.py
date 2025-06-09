"""Add quarterly columns to notional_transfer table

Revision ID: 15b79c70409d
Revises: 67c82d9397dd
Create Date: 2025-06-02 10:54:13.289018

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "15b79c70409d"
down_revision = "67c82d9397dd"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add quarterly columns for early issuance reporting
    op.add_column(
        "notional_transfer",
        sa.Column(
            "q1_quantity",
            sa.Integer(),
            nullable=True,
            comment="Quantity of fuel being notionally transferred in Q1 (early issuance only)",
        ),
    )
    op.add_column(
        "notional_transfer",
        sa.Column(
            "q2_quantity",
            sa.Integer(),
            nullable=True,
            comment="Quantity of fuel being notionally transferred in Q2 (early issuance only)",
        ),
    )
    op.add_column(
        "notional_transfer",
        sa.Column(
            "q3_quantity",
            sa.Integer(),
            nullable=True,
            comment="Quantity of fuel being notionally transferred in Q3 (early issuance only)",
        ),
    )
    op.add_column(
        "notional_transfer",
        sa.Column(
            "q4_quantity",
            sa.Integer(),
            nullable=True,
            comment="Quantity of fuel being notionally transferred in Q4 (early issuance only)",
        ),
    )

    # Modify the main quantity column to be nullable for early issuance reports
    op.alter_column(
        "notional_transfer",
        "quantity",
        existing_type=sa.INTEGER(),
        nullable=True,
        comment="Quantity of fuel being notionally transferred (no early issuance)",
        existing_comment="Quantity of fuel being notionally transferred. Cannot be negative.",
    )


def downgrade() -> None:
    # Revert the main quantity column to be not nullable
    op.alter_column(
        "notional_transfer",
        "quantity",
        existing_type=sa.INTEGER(),
        nullable=False,
        comment="Quantity of fuel being notionally transferred. Cannot be negative.",
        existing_comment="Quantity of fuel being notionally transferred (no early issuance)",
    )

    # Drop the quarterly columns
    op.drop_column("notional_transfer", "q4_quantity")
    op.drop_column("notional_transfer", "q3_quantity")
    op.drop_column("notional_transfer", "q2_quantity")
    op.drop_column("notional_transfer", "q1_quantity")
