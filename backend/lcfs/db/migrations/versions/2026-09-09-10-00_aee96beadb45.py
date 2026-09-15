"""Add composite index for compliance report lookups by organization and period.

Revision ID: aee96beadb45
Revises: c8d9e0f1a2b3
Create Date: 2026-09-09 10:00:00.000000

The compliance report repository resolves "the latest assessed report for an
organization in a period", "previous/next assessed reports" and "does a report
exist for this org/period" by filtering on organization_id and
compliance_period_id and ordering by version. Single-column indexes exist on
each foreign key (ix_compliance_report_organization_id,
ix_compliance_report_compliance_period_id, ix_compliance_report_current_status_id),
which the planner combined with a BitmapAnd. One composite index covers the
filter and the ordering in a single index scan.
"""

from alembic import op
import sqlalchemy as sa


revision = "aee96beadb45"
down_revision = "c8d9e0f1a2b3"
branch_labels = None
depends_on = None

INDEX_NAME = "idx_compliance_report_org_period_version"


def upgrade() -> None:
    op.create_index(
        INDEX_NAME,
        "compliance_report",
        ["organization_id", "compliance_period_id", sa.text("version DESC")],
        unique=False,
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index(INDEX_NAME, table_name="compliance_report", if_exists=True)
