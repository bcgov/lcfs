"""Fix director dashboard counts

Revision ID: ac2cb0248135
Revises: 72a3e3f6ac9a
Create Date: 2025-05-27 23:41:04.559282

"""

import sqlalchemy as sa
from alembic import op
from alembic_postgresql_enum import TableReference
from sqlalchemy.dialects import postgresql
import logging

# revision identifiers, used by Alembic.
revision = "ac2cb0248135"
down_revision = "72a3e3f6ac9a"
branch_labels = None
depends_on = None

# Set up logging
logger = logging.getLogger("alembic.runtime.migration")


def upgrade() -> None:
    try:
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
            "DROP INDEX IF EXISTS mv_director_review_transaction_count_unique_idx CASCADE;"
        )
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
                    FROM lcfs.public.v_compliance_report vcr
                    JOIN lcfs.public.compliance_report_status crs 
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
        logger.info("Created materialized view: mv_director_review_transaction_count")
        op.execute(
            """
            CREATE UNIQUE INDEX mv_director_review_transaction_count_unique_idx
            ON mv_director_review_transaction_count (transaction_type);
            """
        )
        logger.info("Created index for mv_director_review_transaction_count")
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
        logger.info("Created function: refresh_mv_director_review_transaction_count")
        # Triggers for mv_director_review_transaction_count
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
        logger.info("Created index for mv_director_review_transaction_count")
    except Exception as e:
        logger.error(f"Migration downgrade failed: {e}", exc_info=True)
        raise


def downgrade() -> None:
    try:
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
            "DROP INDEX IF EXISTS mv_director_review_transaction_count_unique_idx CASCADE;"
        )
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
                    COUNT(*) FILTER (WHERE cr.current_status_id = 4) AS count_for_review
                FROM compliance_report cr

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
        logger.info("Created materialized view: mv_director_review_transaction_count")
        op.execute(
            """
            CREATE UNIQUE INDEX mv_director_review_transaction_count_unique_idx
            ON mv_director_review_transaction_count (transaction_type);
            """
        )
        logger.info("Created index for mv_director_review_transaction_count")
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
        logger.info("Created function: refresh_mv_director_review_transaction_count")
        # Triggers for mv_director_review_transaction_count
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
        logger.info("Created triggers for mv_director_review_transaction_count")
    except Exception as e:
        logger.error(f"Migration downgrade failed: {e}", exc_info=True)
        raise
