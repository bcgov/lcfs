"""Add soft deletion to documents.

The business area asked that nothing a user removes truly disappears, so
the folder tree can be kept tidy without losing anything. Removing a file
now stamps it rather than destroying it, and it moves to a bin the user
can restore from.

Two nullable columns on the shared document table. Every existing read
gains "deleted_date IS NULL", which is inert for the six other surfaces:
only the allow-listed parent types have a route that can set it, so
nothing changes for compliance reports, administrative adjustments,
initiative agreements, charging sites, CI applications or internal
comments.

Nothing is ever purged, so the existing hard-delete path is left exactly
as it is and is simply never called for the allow-listed types.

Revision ID: e2a4c6b8d0f1
Revises: d1f3a5b7c9e2
Create Date: 2026-08-26 10:00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "e2a4c6b8d0f1"
down_revision = "d1f3a5b7c9e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "document",
        sa.Column(
            "deleted_date",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            comment=(
                "When the document was removed from its parent's tree. "
                "NULL means it is live; documents are never hard-deleted "
                "for folder-enabled parents."
            ),
        ),
    )
    op.add_column(
        "document",
        sa.Column(
            "deleted_by",
            sa.String(length=500),
            nullable=True,
            comment="Username of whoever removed it, matching create_user",
        ),
    )
    # The bin is read per parent, and every live read filters on this, so
    # a partial index on the live rows keeps the common path cheap.
    op.create_index(
        "ix_document_live",
        "document",
        ["document_id"],
        postgresql_where=sa.text("deleted_date IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_document_live", table_name="document")
    op.drop_column("document", "deleted_by")
    op.drop_column("document", "deleted_date")
