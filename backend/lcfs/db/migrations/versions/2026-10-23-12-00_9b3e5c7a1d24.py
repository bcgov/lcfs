"""Document macro review status (#5239)

Adds the macro review state for uploaded documents. Macro-enabled workbooks
uploaded to CI applications wait as pending_approval until an IDIR
Administrator approves or rejects them. Existing rows become `legacy`.

Revision ID: 9b3e5c7a1d24
Revises: 4f2a9c8d6e1b
Create Date: 2026-10-23 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "9b3e5c7a1d24"
down_revision = "4f2a9c8d6e1b"
branch_labels = None
depends_on = None

SCAN_STATUSES = ("legacy", "clean", "pending_approval", "approved", "rejected")


def upgrade() -> None:
    postgresql.ENUM(*SCAN_STATUSES, name="document_scan_status_enum").create(
        op.get_bind(), checkfirst=True
    )
    op.add_column(
        "document",
        sa.Column(
            "scan_status",
            postgresql.ENUM(name="document_scan_status_enum", create_type=False),
            nullable=False,
            server_default="legacy",
            comment=(
                "Macro review state; pending_approval and rejected files can't "
                "be downloaded"
            ),
        ),
    )
    op.add_column(
        "document",
        sa.Column(
            "scan_findings",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="Plain-language macro analysis findings shown to staff",
        ),
    )
    op.add_column(
        "document",
        sa.Column(
            "scan_reviewed_by",
            sa.String(length=500),
            nullable=True,
            comment="Username of the administrator who approved or rejected the file",
        ),
    )
    op.add_column(
        "document",
        sa.Column(
            "scan_reviewed_date",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            comment="When the file was approved or rejected",
        ),
    )


def downgrade() -> None:
    op.drop_column("document", "scan_reviewed_date")
    op.drop_column("document", "scan_reviewed_by")
    op.drop_column("document", "scan_findings")
    op.drop_column("document", "scan_status")
    postgresql.ENUM(name="document_scan_status_enum").drop(
        op.get_bind(), checkfirst=True
    )
