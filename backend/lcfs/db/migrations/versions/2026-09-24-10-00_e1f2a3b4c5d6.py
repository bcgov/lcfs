"""Add project location to initiative agreement

Revision ID: e1f2a3b4c5d6
Revises: 7cdd9e9a16c4
Create Date: 2026-09-24 10:00:00

"""

import sqlalchemy as sa
from alembic import op

revision = "e1f2a3b4c5d6"
down_revision = "7cdd9e9a16c4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "initiative_agreement",
        sa.Column(
            "project_location",
            sa.Text(),
            nullable=True,
            comment="Project location",
        ),
    )


def downgrade() -> None:
    op.drop_column("initiative_agreement", "project_location")
