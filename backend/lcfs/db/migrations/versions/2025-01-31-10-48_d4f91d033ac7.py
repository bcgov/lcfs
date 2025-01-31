"""
Add 'Rejected' Status to ComplianceReportStatusEnum

Revision ID: d4f91d033ac7
Revises: 0d8e7ee6a6e0
Create Date: 2025-01-31 10:48:30.770439
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d4f91d033ac7"
down_revision = "0d8e7ee6a6e0"
branch_labels = None
depends_on = None


def upgrade():
    # Add the new 'Rejected' value to the enum
    op.execute(
        sa.text(
            "ALTER TYPE public.compliancereportstatusenum ADD VALUE IF NOT EXISTS 'Rejected'"
        ).execution_options(autocommit=True)
    )
    # Insert 'Rejected' status into cr status
    op.execute(
        """
        INSERT INTO public.compliance_report_status
        (compliance_report_status_id, display_order, status, create_date, update_date, effective_date, effective_status, expiration_date)
        VALUES(7, NULL, 'Rejected', now(), now(), NULL, true, NULL);
    """
    )


def downgrade():
    op.execute(
        """
        DELETE FROM compliance_report_status WHERE compliance_report_status_id = 7;
    """
    )
