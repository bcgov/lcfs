"""Add CI pathway supplemental edit enabled flag.

Revision ID: a9c7e5f3d1b2
Revises: f3a8c1d2e4b5
Create Date: 2026-06-23 10:00:00.000000
"""

import sqlalchemy as sa
from alembic import op


revision = "a9c7e5f3d1b2"
down_revision = "f3a8c1d2e4b5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ci_application",
        sa.Column(
            "pathway_supplemental_edit_enabled",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
            comment="True when supplemental edits are enabled for CI pathway records.",
        ),
    )


def downgrade() -> None:
    op.drop_column("ci_application", "pathway_supplemental_edit_enabled")
