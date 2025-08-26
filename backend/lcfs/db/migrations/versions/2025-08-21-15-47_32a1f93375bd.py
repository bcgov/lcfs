"""Remove redundant other_uses_fossil_derived column

Revision ID: 32a1f93375bd
Revises: 8cb65fb3418e
Create Date: 2025-08-21 15:47:43.772675

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "32a1f93375bd"
down_revision = "8cb65fb3418e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the redundant other_uses_fossil_derived column
    # This field was redundant as it was TRUE for all fuel types where
    # fossil_derived=TRUE OR renewable=TRUE (except for special cases 'Other')
    # The logic has been updated to use fossil_derived OR renewable directly
    op.drop_column("fuel_type", "other_uses_fossil_derived")


def downgrade() -> None:
    # Re-add the column and populate it based on the logic:
    # TRUE when fossil_derived=TRUE OR renewable=TRUE
    # with special exceptions for certain fuel types
    op.add_column(
        "fuel_type",
        sa.Column(
            "other_uses_fossil_derived",
            sa.Boolean(),
            nullable=True,
            comment="Indicates whether this fuel type should appear as an option when 'Other' fuel is selected in fuel supply",
        ),
    )

    # Update the values based on the original logic
    # Set to TRUE only for fuel types that are fossil-derived OR renewable
    # (excluding 'Other' which shouldn't appear in its own selection list)
    op.execute(
        """
        UPDATE fuel_type
        SET other_uses_fossil_derived = CASE
            WHEN (fossil_derived = TRUE OR renewable = TRUE) AND fuel_type != 'Other' THEN TRUE
            ELSE FALSE
        END
    """
    )

    # Set column to NOT NULL with default FALSE
    op.alter_column(
        "fuel_type",
        "other_uses_fossil_derived",
        nullable=False,
        server_default=sa.text("FALSE"),
    )
