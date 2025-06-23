"""Add fuel codes to director review dashboard

Revision ID: a1b2c3d4e5f6
Revises: d432ee9659f
Create Date: 2025-06-18 17:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "d432ee9659f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the existing materialized view and related objects
    op.execute(
        "DROP MATERIALIZED VIEW IF EXISTS mv_director_review_transaction_count CASCADE;"
    )
    op.execute(
        "DROP FUNCTION IF EXISTS refresh_mv_director_review_transaction_count CASCADE;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_transfer ON transfer CASCADE;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_cr on compliance_report CASCADE;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_ia on initiative_agreement CASCADE;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_aa on admin_adjustment CASCADE;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_fc on fuel_code CASCADE;"
    )
    op.execute(
        "DROP INDEX IF EXISTS mv_director_review_transaction_count_unique_idx CASCADE;"
    )

    # Create the updated materialized view with fuel codes
    op.execute(
        """
        CREATE MATERIALIZED VIEW mv_director_review_transaction_count AS
            SELECT
                'transfers' AS transaction_type,
                COUNT(*) FILTER (WHERE t.current_status_id = 5) AS count_for_review
            FROM transfer t

            UNION ALL

            SELECT
                'compliance_reports' AS transaction_type,
                COUNT(*) FILTER (WHERE cr.report_status_id = 4) AS count_for_review
            FROM (
                SELECT vcr.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY vcr.compliance_period, 
                                    vcr.compliance_report_group_uuid, 
                                    vcr.organization_id 
                        ORDER BY vcr.version DESC
                    ) as rn
                FROM v_compliance_report vcr
                JOIN compliance_report_status crs 
                    ON crs.compliance_report_status_id = vcr.report_status_id
                    AND crs.status NOT IN ('Draft'::compliancereportstatusenum, 'Analyst_adjustment'::compliancereportstatusenum)
            ) cr
            WHERE rn = 1

            UNION ALL

            SELECT
                'initiative_agreements' AS transaction_type,
                COUNT(*) FILTER (WHERE ia.current_status_id = 2) AS count_for_review
            FROM initiative_agreement ia

            UNION ALL

            SELECT
                'admin_adjustments' AS transaction_type,
                COUNT(*) FILTER (WHERE aa.current_status_id = 2) AS count_for_review
            FROM admin_adjustment aa

            UNION ALL

            SELECT
                'fuel_codes' AS transaction_type,
                COUNT(*) FILTER (WHERE fc.fuel_status_id = 4) AS count_for_review
            FROM fuel_code fc;
        """
    )

    # Create the index
    op.execute(
        """
        CREATE UNIQUE INDEX mv_director_review_transaction_count_unique_idx
        ON mv_director_review_transaction_count (transaction_type);
        """
    )

    # Create the refresh function
    op.execute(
        """
        CREATE OR REPLACE FUNCTION refresh_mv_director_review_transaction_count()
        RETURNS TRIGGER AS $$
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_director_review_transaction_count;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    # Create triggers for all relevant tables
    op.execute(
        """
        CREATE TRIGGER refresh_mv_director_review_transaction_count_after_transfer
        AFTER INSERT OR UPDATE OR DELETE ON transfer
        FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_director_review_transaction_count();
        """
    )
    op.execute(
        """
        CREATE TRIGGER refresh_mv_director_review_transaction_count_after_cr
        AFTER INSERT OR UPDATE OR DELETE ON compliance_report
        FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_director_review_transaction_count();
        """
    )
    op.execute(
        """
        CREATE TRIGGER refresh_mv_director_review_transaction_count_after_ia
        AFTER INSERT OR UPDATE OR DELETE ON initiative_agreement
        FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_director_review_transaction_count();
        """
    )
    op.execute(
        """
        CREATE TRIGGER refresh_mv_director_review_transaction_count_after_aa
        AFTER INSERT OR UPDATE OR DELETE ON admin_adjustment
        FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_director_review_transaction_count();
        """
    )
    op.execute(
        """
        CREATE TRIGGER refresh_mv_director_review_transaction_count_after_fc
        AFTER INSERT OR UPDATE OR DELETE ON fuel_code
        FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_director_review_transaction_count();
        """
    )


def downgrade() -> None:
    # Drop the updated materialized view and related objects
    op.execute(
        "DROP MATERIALIZED VIEW IF EXISTS mv_director_review_transaction_count CASCADE;"
    )
    op.execute(
        "DROP FUNCTION IF EXISTS refresh_mv_director_review_transaction_count CASCADE;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_transfer ON transfer CASCADE;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_cr on compliance_report CASCADE;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_ia on initiative_agreement CASCADE;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_aa on admin_adjustment CASCADE;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_fc on fuel_code CASCADE;"
    )
    op.execute(
        "DROP INDEX IF EXISTS mv_director_review_transaction_count_unique_idx CASCADE;"
    )

    # Recreate the original materialized view without fuel codes
    op.execute(
        """
        CREATE MATERIALIZED VIEW mv_director_review_transaction_count AS
            SELECT
                'transfers' AS transaction_type,
                COUNT(*) FILTER (WHERE t.current_status_id = 5) AS count_for_review
            FROM transfer t

            UNION ALL

            SELECT
                'compliance_reports' AS transaction_type,
                COUNT(*) FILTER (WHERE cr.report_status_id = 4) AS count_for_review
            FROM (
                SELECT vcr.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY vcr.compliance_period, 
                                    vcr.compliance_report_group_uuid, 
                                    vcr.organization_id 
                        ORDER BY vcr.version DESC
                    ) as rn
                FROM v_compliance_report vcr
                JOIN compliance_report_status crs 
                    ON crs.compliance_report_status_id = vcr.report_status_id
                    AND crs.status NOT IN ('Draft'::compliancereportstatusenum, 'Analyst_adjustment'::compliancereportstatusenum)
            ) cr
            WHERE rn = 1

            UNION ALL

            SELECT
                'initiative_agreements' AS transaction_type,
                COUNT(*) FILTER (WHERE ia.current_status_id = 2) AS count_for_review
            FROM initiative_agreement ia

            UNION ALL

            SELECT
                'admin_adjustments' AS transaction_type,
                COUNT(*) FILTER (WHERE aa.current_status_id = 2) AS count_for_review
            FROM admin_adjustment aa;
        """
    )
    # Recreate the index
    op.execute(
        """
        CREATE UNIQUE INDEX mv_director_review_transaction_count_unique_idx
        ON mv_director_review_transaction_count (transaction_type);
        """
    )

    # Recreate the refresh function
    op.execute(
        """
        CREATE OR REPLACE FUNCTION refresh_mv_director_review_transaction_count()
        RETURNS TRIGGER AS $$
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_director_review_transaction_count;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    # Recreate triggers for original tables
    op.execute(
        """
        CREATE TRIGGER refresh_mv_director_review_transaction_count_after_transfer
        AFTER INSERT OR UPDATE OR DELETE ON transfer
        FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_director_review_transaction_count();
        """
    )
    op.execute(
        """
        CREATE TRIGGER refresh_mv_director_review_transaction_count_after_cr
        AFTER INSERT OR UPDATE OR DELETE ON compliance_report
        FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_director_review_transaction_count();
        """
    )
    op.execute(
        """
        CREATE TRIGGER refresh_mv_director_review_transaction_count_after_ia
        AFTER INSERT OR UPDATE OR DELETE ON initiative_agreement
        FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_director_review_transaction_count();
        """
    )
    op.execute(
        """
        CREATE TRIGGER refresh_mv_director_review_transaction_count_after_aa
        AFTER INSERT OR UPDATE OR DELETE ON admin_adjustment
        FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_director_review_transaction_count();
        """
    )
