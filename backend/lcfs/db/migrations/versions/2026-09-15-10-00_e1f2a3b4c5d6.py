"""Add project location to initiative agreement

Revision ID: e1f2a3b4c5d6
Revises: f3b5d7e9a1c4
Create Date: 2026-09-15 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "e1f2a3b4c5d6"
down_revision = "f3b5d7e9a1c4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "initiative_agreement",
        sa.Column(
            "project_location",
            sa.Text(),
            nullable=True,
            comment=(
                "Project location"
            ),
        ),
    )


def downgrade() -> None:
    op.drop_column("initiative_agreement", "project_location")
