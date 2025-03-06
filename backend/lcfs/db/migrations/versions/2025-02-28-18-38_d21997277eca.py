"""Add not recommended

Revision ID: d21997277eca
Revises: c1e2d64aeea4
Create Date: 2025-02-28 18:38:10.952016

"""

from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = "d21997277eca"
down_revision = "c1e2d64aeea4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Check and add enum values if they do not exist
    check_enum_query = text(
        """
        SELECT 1 FROM pg_enum
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
        WHERE pg_type.typname = 'compliancereportstatusenum'
        AND pg_enum.enumlabel = :enum_value
    """
    )

    if not conn.execute(
        check_enum_query, {"enum_value": "Not_recommended_by_analyst"}
    ).scalar():
        op.execute(
            "ALTER TYPE compliancereportstatusenum ADD VALUE 'Not_recommended_by_analyst'"
        )

    if not conn.execute(
        check_enum_query, {"enum_value": "Not_recommended_by_manager"}
    ).scalar():
        op.execute(
            "ALTER TYPE compliancereportstatusenum ADD VALUE 'Not_recommended_by_manager'"
        )

    # Commit enum changes before using them in INSERT statements
    op.execute("COMMIT")

    # Insert new statuses only if they do not already exist
    check_status_query = text(
        """
        SELECT 1 FROM public.compliance_report_status WHERE compliance_report_status_id = :status_id
    """
    )

    if not conn.execute(check_status_query, {"status_id": 8}).scalar():
        op.execute(
            """
            INSERT INTO public.compliance_report_status (compliance_report_status_id, status, effective_status)
            VALUES (8, 'Not_recommended_by_analyst', 't')
        """
        )

    if not conn.execute(check_status_query, {"status_id": 9}).scalar():
        op.execute(
            """
            INSERT INTO public.compliance_report_status (compliance_report_status_id, status, effective_status)
            VALUES (9, 'Not_recommended_by_manager', 't')
        """
        )


def downgrade() -> None:
    pass
