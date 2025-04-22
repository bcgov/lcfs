"""Fix compliance report view and counts

Revision ID: 4f18d1a47c91
Revises: ddc2db9c2def
Create Date: 2025-04-17 09:42:14.547424

"""

import sqlalchemy as sa
from alembic import op
import logging

# revision identifiers, used by Alembic.
revision = "4f18d1a47c91"
down_revision = "aa79bc6d6152"
branch_labels = None
depends_on = None

# Set up logging
logger = logging.getLogger("alembic.runtime.migration")


def upgrade() -> None:
    try:
        op.execute(
            """
            CREATE OR REPLACE VIEW v_compliance_report AS
                WITH latest_versions AS (
                    -- Get the latest version of each compliance_report_group_uuid
                    SELECT
                        cr.compliance_report_group_uuid,
                        MAX(cr.version) AS max_version
                    FROM compliance_report cr
                    GROUP BY cr.compliance_report_group_uuid
                ),
                latest_with_status AS (
                    -- Get the latest version with its status
                    SELECT
                        cr.compliance_report_group_uuid,
                        cr.version,
                        crs.status
                    FROM compliance_report cr
                    JOIN latest_versions lv
                        ON cr.compliance_report_group_uuid = lv.compliance_report_group_uuid
                        AND cr.version = lv.max_version
                    JOIN compliance_report_status crs
                        ON cr.current_status_id = crs.compliance_report_status_id
                ),
                second_latest_versions AS (
                    -- Get the second latest version only for reports where the latest is Draft
                    SELECT
                        cr.compliance_report_group_uuid,
                        MAX(cr.version) AS second_max_version
                    FROM compliance_report cr
                    JOIN latest_with_status lws
                        ON cr.compliance_report_group_uuid = lws.compliance_report_group_uuid
                    WHERE cr.version < lws.version
                        AND lws.status in ('Draft', 'Submitted')
                    GROUP BY cr.compliance_report_group_uuid
                ),
                selected_reports AS (
                    -- Always select the latest version
                    SELECT cr.*
                    FROM compliance_report cr
                    JOIN latest_versions lv
                        ON cr.compliance_report_group_uuid = lv.compliance_report_group_uuid
                        AND cr.version = lv.max_version
                    UNION ALL
                    -- Select second latest version only where the latest is Draft
                    SELECT cr.*
                    FROM compliance_report cr
                    JOIN second_latest_versions slv
                        ON cr.compliance_report_group_uuid = slv.compliance_report_group_uuid
                        AND cr.version = slv.second_max_version
                )
                SELECT DISTINCT
                    sr.compliance_report_id,
                    sr.compliance_report_group_uuid,
                    sr.version,
                    cp.compliance_period_id,
                    cp.description AS compliance_period,
                    o.organization_id,
                    o.name AS organization_name,
                    sr.nickname AS report_type,
                    crs.compliance_report_status_id AS report_status_id,
                    crs.status AS report_status,
                    sr.update_date,
                    sr.supplemental_initiator
                FROM selected_reports sr
                JOIN compliance_period cp
                    ON sr.compliance_period_id = cp.compliance_period_id
                JOIN organization o
                    ON sr.organization_id = o.organization_id
                JOIN compliance_report_status crs
                    ON sr.current_status_id = crs.compliance_report_status_id;
            """
        )
        op.execute(
            "DROP MATERIALIZED VIEW IF EXISTS mv_compliance_report_count CASCADE;"
        )
        op.execute(
            "DROP FUNCTION IF EXISTS refresh_mv_compliance_report_count() CASCADE;"
        )
        op.execute(
            "DROP TRIGGER IF EXISTS refresh_mv_compliance_report_count_after_change ON compliance_report CASCADE;"
        )
        op.execute("DROP INDEX IF EXISTS mv_compliance_report_count_idx CASCADE;")
        op.execute(
            """
            CREATE MATERIALIZED VIEW mv_compliance_report_count AS
            SELECT 
                CAST(vcr.report_status AS VARCHAR) AS status,
                COUNT(*) AS status_count
            FROM v_compliance_report vcr
            WHERE
                vcr.report_status_id NOT IN (1)
                AND CAST(vcr.report_status AS VARCHAR) IN ('Submitted', 'Recommended_by_analyst', 'Recommended_by_manager', 'Analyst_adjustment')
                AND vcr.version = (
                    SELECT MAX(cr.version)
                    FROM compliance_report cr
                    WHERE vcr.compliance_report_group_uuid = cr.compliance_report_group_uuid
                    AND cr.current_status_id NOT IN (1)
                )
            GROUP BY CAST(vcr.report_status AS VARCHAR)
            ORDER BY status_count DESC
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
        op.execute(
            """
            CREATE UNIQUE INDEX mv_compliance_report_count_idx
            ON mv_compliance_report_count (status);
            """
        )
    except Exception as e:
        logger.error(f"Migration upgrade failed: {e}")
        raise


def downgrade() -> None:
    try:
        op.execute(
            """
        CREATE OR REPLACE VIEW v_compliance_report AS
        SELECT
            cr.compliance_report_id,
            cr.compliance_report_group_uuid,
            cr.version,
            cp.compliance_period_id,
            cp.description AS compliance_period,
            o.organization_id,
            o.name AS organization_name,
            cr.nickname AS report_type,
            crs.compliance_report_status_id AS report_status_id,
            crs.status AS report_status,
            cr.update_date,
            cr.supplemental_initiator
        FROM compliance_report cr
        JOIN compliance_period cp
            ON cr.compliance_period_id = cp.compliance_period_id
        JOIN organization o
            ON cr.organization_id = o.organization_id
        JOIN compliance_report_status crs
            ON cr.current_status_id = crs.compliance_report_status_id;
        """
        )
        op.execute(
            "DROP MATERIALIZED VIEW IF EXISTS mv_compliance_report_count CASCADE;"
        )
        op.execute(
            "DROP FUNCTION IF EXISTS refresh_mv_compliance_report_count() CASCADE;"
        )
        op.execute(
            "DROP TRIGGER IF EXISTS refresh_mv_compliance_report_count_after_change ON compliance_report CASCADE;"
        )
        op.execute("DROP INDEX IF EXISTS mv_compliance_report_count_idx CASCADE;")
        op.execute(
            """
            CREATE MATERIALIZED VIEW mv_compliance_report_count AS
            SELECT
                CASE cr.current_status_id
                    WHEN 2 THEN 'Submitted'
                    WHEN 3 THEN 'Recommended by Analysts'
                    WHEN 4 THEN 'Recommended by Manager'
                    ELSE 'Other'
                END AS status,
                COUNT(*) AS count
            FROM
                compliance_report cr
            JOIN (
                SELECT
                    compliance_report_group_uuid,
                    MAX(version) AS max_version
                FROM
                    compliance_report
                GROUP BY
                    compliance_report_group_uuid
            ) latest ON cr.compliance_report_group_uuid = latest.compliance_report_group_uuid
                    AND cr.version = latest.max_version
            WHERE
                cr.current_status_id IN (2, 3, 4)
            GROUP BY
                cr.current_status_id
            ORDER BY
                status;
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
        op.execute(
            """
            CREATE UNIQUE INDEX mv_compliance_report_count_idx
            ON mv_compliance_report_count (status);
            """
        )
    except Exception as e:
        logger.error(f"Migration upgrade failed: {e}")
        raise
