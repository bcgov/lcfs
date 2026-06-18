"""Add CI application supplemental pathway edit request fields.

Revision ID: e5f7a9b1c3d4
Revises: d2e4f6a8b0c1
Create Date: 2026-06-10 10:00:00.000000
"""

import sqlalchemy as sa
from alembic import op


revision = "e5f7a9b1c3d4"
down_revision = "d2e4f6a8b0c1"
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
    op.add_column(
        "ci_application",
        sa.Column(
            "pathway_changes_requested_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            comment="UTC date and time supplemental pathway editing was requested.",
        ),
    )
    op.add_column(
        "ci_application",
        sa.Column(
            "pathway_changes_requested_by",
            sa.String(length=500),
            nullable=True,
            comment="Username of the IDIR user who requested pathway changes.",
        ),
    )


def downgrade() -> None:
    op.drop_column("ci_application", "pathway_changes_requested_by")
    op.drop_column("ci_application", "pathway_changes_requested_at")
    op.drop_column("ci_application", "pathway_supplemental_edit_enabled")
