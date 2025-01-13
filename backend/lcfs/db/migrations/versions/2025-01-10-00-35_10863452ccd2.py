"""mv for compliance report count for the dashboard

Revision ID: 10863452ccd2
Revises: 94306eca5261
Create Date: 2025-01-10 00:35:24.596718

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "10863452ccd2"
down_revision = "fa98709e7952"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE MATERIALIZED VIEW mv_compliance_report_count AS
        SELECT 
            CASE current_status_id 
                WHEN 2 THEN 'Submitted'
                WHEN 3 THEN 'Recommended by Analysts'
                WHEN 4 THEN 'Recommended by Manager'
            END as status,
            COUNT(*) as count
        FROM compliance_report
        WHERE current_status_id IN (2,3,4)
        GROUP BY current_status_id;
        """
    )

    op.execute(
        """
        CREATE UNIQUE INDEX mv_compliance_report_count_idx 
        ON mv_compliance_report_count (status);
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION refresh_mv_compliance_report_count()
        RETURNS TRIGGER AS $$
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_compliance_report_count;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    op.execute(
        """
        CREATE TRIGGER refresh_mv_compliance_report_count_after_change
        AFTER INSERT OR UPDATE OR DELETE ON compliance_report
        FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_compliance_report_count();
        """
    )


def downgrade() -> None:
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_mv_compliance_report_count_after_change ON compliance_report;")
    op.execute("DROP FUNCTION IF EXISTS refresh_mv_compliance_report_count();")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_compliance_report_count;")
