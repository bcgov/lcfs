"""Add CI application additional-documentation request fields.

Enables the "request further documentation" workflow: an analyst can open
document uploads on a submitted CI application so the supplier can attach the
requested files. Mirrors the supplemental pathway-edit request fields (#4644).

Revision ID: e7f8a9b0c1d2
Revises: d4e5f6a7b8c9
Create Date: 2026-07-20 10:00:00.000000
"""

import sqlalchemy as sa
from alembic import op


revision = "e7f8a9b0c1d2"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ci_application",
        sa.Column(
            "document_upload_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="True when the supplier may upload additional documents after "
            "a request for further documentation on a submitted application.",
        ),
    )
    op.add_column(
        "ci_application",
        sa.Column(
            "document_changes_requested_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            comment="UTC date and time additional documentation was requested.",
        ),
    )
    op.add_column(
        "ci_application",
        sa.Column(
            "document_changes_requested_by",
            sa.String(length=500),
            nullable=True,
            comment="Username of the IDIR user who requested additional documentation.",
        ),
    )


def downgrade() -> None:
    op.drop_column("ci_application", "document_changes_requested_by")
    op.drop_column("ci_application", "document_changes_requested_at")
    op.drop_column("ci_application", "document_upload_enabled")
