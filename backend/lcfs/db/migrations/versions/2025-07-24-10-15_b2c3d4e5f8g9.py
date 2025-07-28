"""Remove has_early_issuance column from organization table

Revision ID: b2c3d4e5f8g9
Revises: c3d4e5f6g7h8
Create Date: 2025-07-10 10:15:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "b2c3d4e5f8g9"
down_revision = "c3d4e5f6g7h8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove the has_early_issuance column from organization table
    # This column is no longer needed as early issuance is now handled
    # by the organization_early_issuance_by_year table
    op.drop_column("organization", "has_early_issuance")


def downgrade() -> None:
    # Re-add the has_early_issuance column if needed for rollback
    op.add_column(
        "organization",
        sa.Column(
            "has_early_issuance",
            sa.Boolean(),
            server_default=sa.text("FALSE"),
            nullable=False,
            comment="True if the Organization can create early issuance reports",
        ),
    )
