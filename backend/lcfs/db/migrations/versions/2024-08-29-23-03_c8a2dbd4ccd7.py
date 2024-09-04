"""Add mv_org_compliance_report_count to calculate the number of organization compliance reports for the OrgComplianceReports card on the dashboard.

Revision ID: c8a2dbd4ccd7
Revises: 9d93dc700752
Create Date: 2024-08-29 23:03:35.246219

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "c8a2dbd4ccd7"
down_revision = "9d93dc700752"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
    CREATE MATERIALIZED VIEW mv_org_compliance_report_count AS
    SELECT
        organization_id,
        COUNT(*) FILTER (WHERE current_status_id = 1) AS count_in_progress,
        COUNT(*) FILTER (WHERE current_status_id = 2) AS count_awaiting_gov_review
    FROM
        compliance_report
    GROUP BY
        organization_id;
    """)

    op.execute("""CREATE UNIQUE INDEX mv_org_compliance_report_count_org_id_idx ON mv_org_compliance_report_count (organization_id);""")

    op.execute("""
    CREATE OR REPLACE FUNCTION refresh_mv_org_compliance_report_count()
    RETURNS TRIGGER AS $$
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_org_compliance_report_count;
        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
    """)

    op.execute("""
    CREATE TRIGGER refresh_mv_org_compliance_report_count_after_compliance_report
    AFTER INSERT OR UPDATE OR DELETE ON compliance_report
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_org_compliance_report_count();
    """)


def downgrade() -> None:
    op.execute("""DROP TRIGGER IF EXISTS refresh_mv_org_compliance_report_count_after_compliance_report ON compliance_report;""")
    op.execute("""DROP FUNCTION IF EXISTS refresh_mv_org_compliance_report_count();""")
    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_org_compliance_report_count;""")
