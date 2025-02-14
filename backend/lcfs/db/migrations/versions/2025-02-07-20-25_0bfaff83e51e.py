"""Dashboard counts fix for compliance report and transaction views

Revision ID: 0bfaff83e51e
Revises: e50534b604f2
Create Date: 2025-02-06 23:25:21.194834

"""

import sqlalchemy as sa
from alembic import op
import logging

# revision identifiers, used by Alembic.
revision = "0bfaff83e51e"
down_revision = "67c0765b7e49"
branch_labels = None
depends_on = None


# Set up logging
logger = logging.getLogger("alembic.runtime.migration")


def upgrade():
    try:
        # Create a view for compliance reports list
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
                    AND lws.status = 'Draft'
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
                sr.update_date
            FROM selected_reports sr
            JOIN compliance_period cp 
                ON sr.compliance_period_id = cp.compliance_period_id
            JOIN organization o 
                ON sr.organization_id = o.organization_id
            JOIN compliance_report_status crs 
                ON sr.current_status_id = crs.compliance_report_status_id;
            """
        )
        # Drop org_compliance_count
        op.execute(
            "DROP MATERIALIZED VIEW IF EXISTS mv_org_compliance_report_count CASCADE;"
        )
        op.execute(
            "DROP MATERIALIZED VIEW IF EXISTS mv_compliance_report_count CASCADE;"
        )
        op.execute(
            "DROP FUNCTION IF EXISTS refresh_mv_org_compliance_report_count() CASCADE;"
        )
        op.execute(
            "DROP FUNCTION IF EXISTS refresh_mv_compliance_report_count() CASCADE;"
        )
        op.execute(
            "DROP TRIGGER IF EXISTS refresh_mv_org_compliance_report_count_after_compliance_report ON compliance_report CASCADE;"
        )
        op.execute(
            "DROP TRIGGER IF EXISTS refresh_mv_compliance_report_count_after_change ON compliance_report CASCADE;"
        )
        op.execute(
            "DROP INDEX IF EXISTS mv_org_compliance_report_count_org_id_idx CASCADE;"
        )
        op.execute("DROP INDEX IF EXISTS mv_compliance_report_count_idx CASCADE;")
        op.execute(
            "DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer ON transfer;"
        )
        op.execute(
            "DROP TRIGGER IF EXISTS refresh_transaction_view_after_initiative_agreement ON initiative_agreement;"
        )
        op.execute(
            "DROP TRIGGER IF EXISTS refresh_transaction_view_after_admin_adjustment ON admin_adjustment;"
        )
        op.execute(
            "DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer_history ON transfer_history;"
        )
        op.execute(
            "DROP TRIGGER IF EXISTS refresh_transaction_view_after_initiative_agreement_history ON initiative_agreement_history;"
        )
        op.execute(
            "DROP TRIGGER IF EXISTS refresh_transaction_view_after_admin_adjustment_history ON admin_adjustment_history;"
        )
        op.execute(
            "DROP TRIGGER IF EXISTS refresh_transaction_view_after_compliance_report ON compliance_report;"
        )

        op.execute("DROP FUNCTION IF EXISTS refresh_transaction_aggregate();")
        op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_transaction_aggregate;")
        # Create Materialized Views
        op.execute(
            """
        CREATE MATERIALIZED VIEW mv_transaction_aggregate AS
            with all_transactions as (
            ------------------------------------------------------------------------
            -- Transfers
            ------------------------------------------------------------------------
            SELECT
                t.transfer_id AS transaction_id,
                'Transfer' AS transaction_type,
                NULL AS description,
                org_from.organization_id AS from_organization_id,
                org_from.name AS from_organization,
                org_to.organization_id AS to_organization_id,
                org_to.name AS to_organization,
                t.quantity,
                t.price_per_unit,
                ts.status::text AS status,
                CASE 
                    WHEN ts.status = 'Recorded' THEN EXTRACT(YEAR FROM (
                        SELECT th.create_date
                        FROM transfer_history th
                        WHERE th.transfer_id = t.transfer_id
                        AND th.transfer_status_id = 6  -- Recorded
                        LIMIT 1
                    ))::text
                    ELSE 'N/A'
                END AS compliance_period,
                t.from_org_comment AS comment,
                tc.category,
                (
                    SELECT th.create_date
                    FROM transfer_history th
                    WHERE th.transfer_id = t.transfer_id
                      AND th.transfer_status_id = 6  -- Recorded
                ) AS recorded_date,
                NULL AS approved_date,
                t.transaction_effective_date,
                t.update_date,
                t.create_date
            FROM transfer t
            JOIN organization org_from
                ON t.from_organization_id = org_from.organization_id
            JOIN organization org_to
                ON t.to_organization_id = org_to.organization_id
            JOIN transfer_status ts
                ON t.current_status_id = ts.transfer_status_id
            LEFT JOIN transfer_category tc
                ON t.transfer_category_id = tc.transfer_category_id

            UNION ALL

            ------------------------------------------------------------------------
            -- Initiative Agreements
            ------------------------------------------------------------------------
            SELECT
                ia.initiative_agreement_id AS transaction_id,
                'InitiativeAgreement' AS transaction_type,
                NULL AS description,
                NULL AS from_organization_id,
                NULL AS from_organization,
                org.organization_id AS to_organization_id,
                org.name AS to_organization,
                ia.compliance_units AS quantity,
                NULL AS price_per_unit,
                ias.status::text AS status,
                EXTRACT(YEAR FROM ia.transaction_effective_date)::text AS compliance_period,
                ia.gov_comment AS comment,
                NULL AS category,
                NULL AS recorded_date,
                (
                    SELECT iah.create_date
                    FROM initiative_agreement_history iah
                    WHERE iah.initiative_agreement_id = ia.initiative_agreement_id
                      AND iah.initiative_agreement_status_id = 3 -- Approved
                ) AS approved_date,
                ia.transaction_effective_date,
                ia.update_date,
                ia.create_date
            FROM initiative_agreement ia
            JOIN organization org
                ON ia.to_organization_id = org.organization_id
            JOIN initiative_agreement_status ias
                ON ia.current_status_id = ias.initiative_agreement_status_id

            UNION ALL

            ------------------------------------------------------------------------
            -- Admin Adjustments
            ------------------------------------------------------------------------
            SELECT
                aa.admin_adjustment_id AS transaction_id,
                'AdminAdjustment' AS transaction_type,
                NULL AS description,
                NULL AS from_organization_id,
                NULL AS from_organization,
                org.organization_id AS to_organization_id,
                org.name AS to_organization,
                aa.compliance_units AS quantity,
                NULL AS price_per_unit,
                aas.status::text AS status,
                EXTRACT(YEAR FROM aa.transaction_effective_date)::text AS compliance_period,
                aa.gov_comment AS comment,
                NULL AS category,
                NULL AS recorded_date,
                (
                    SELECT aah.create_date
                    FROM admin_adjustment_history aah
                    WHERE aah.admin_adjustment_id = aa.admin_adjustment_id
                      AND aah.admin_adjustment_status_id = 3 -- Approved
                ) AS approved_date,
                aa.transaction_effective_date,
                aa.update_date,
                aa.create_date
            FROM admin_adjustment aa
            JOIN organization org
                ON aa.to_organization_id = org.organization_id
            JOIN admin_adjustment_status aas
                ON aa.current_status_id = aas.admin_adjustment_status_id

            UNION ALL

            ------------------------------------------------------------------------
            -- Compliance Reports
            ------------------------------------------------------------------------
            SELECT
                cr.compliance_report_id AS transaction_id,
                'ComplianceReport' AS transaction_type,
                cr.nickname AS description,
                NULL AS from_organization_id,
                NULL AS from_organization,
                org.organization_id AS to_organization_id,
                org.name AS to_organization,
                tr.compliance_units AS quantity,
                NULL AS price_per_unit,
                crs.status::text AS status,
                cp.description AS compliance_period,
                NULL AS comment,
                NULL AS category,
                NULL AS recorded_date,
                NULL AS approved_date,
                NULL AS transaction_effective_date,
                cr.update_date,
                cr.create_date
            FROM compliance_report cr
            JOIN organization org
                ON cr.organization_id = org.organization_id
            JOIN compliance_report_status crs
                ON cr.current_status_id = crs.compliance_report_status_id
            JOIN compliance_period cp
                ON cr.compliance_period_id = cp.compliance_period_id
            JOIN "transaction" tr
                ON cr.transaction_id = tr.transaction_id
               AND cr.transaction_id IS NOT NULL
            WHERE crs.status IN ('Assessed', 'Reassessed'))
            SELECT DISTINCT * FROM all_transactions;
        """
        )
        op.execute(
            """
            CREATE MATERIALIZED VIEW mv_org_compliance_report_count AS
            SELECT
                cr.organization_id,
                COUNT(*) FILTER (WHERE cr.current_status_id = 1) AS count_in_progress,
                COUNT(*) FILTER (WHERE cr.current_status_id = 2) AS count_awaiting_gov_review
            FROM compliance_report cr
            JOIN (
                SELECT
                    compliance_report_group_uuid,
                    MAX(version) AS max_version
                FROM compliance_report
                GROUP BY compliance_report_group_uuid
            ) latest ON cr.compliance_report_group_uuid = latest.compliance_report_group_uuid
            AND cr.version = latest.max_version
            WHERE cr.current_status_id IN (1, 2) -- Keep only relevant statuses
            GROUP BY cr.organization_id
            ORDER BY cr.organization_id;
            """
        )
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
            FROM compliance_report cr
            JOIN (
                SELECT 
                    vcr.compliance_report_id,
                    vcr.compliance_report_group_uuid,
                    vcr.version,
                    vcr.compliance_period_id,
                    vcr.compliance_period,
                    vcr.organization_id,
                    vcr.organization_name,
                    vcr.report_type,
                    vcr.report_status_id,
                    vcr.report_status,
                    vcr.update_date
                FROM v_compliance_report vcr
                WHERE 
                    CAST(vcr.report_status AS VARCHAR) != 'Draft'
                    AND CAST(vcr.report_status AS VARCHAR) IN ('Submitted', 'Recommended_by_analyst', 'Recommended_by_manager')
                ORDER BY vcr.update_date DESC
            ) latest 
            ON cr.compliance_report_group_uuid = latest.compliance_report_group_uuid
            AND cr.version = latest.version
            WHERE cr.current_status_id IN (2, 3, 4)
            GROUP BY cr.current_status_id
            ORDER BY status;
            """
        )

        # Create Refresh Functions, triggers and indices for materialized view
        op.execute(
            """
            CREATE OR REPLACE FUNCTION refresh_mv_org_compliance_report_count()
            RETURNS TRIGGER AS $$
            BEGIN
                REFRESH MATERIALIZED VIEW CONCURRENTLY mv_org_compliance_report_count;
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;
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
            CREATE TRIGGER refresh_mv_org_compliance_report_count_after_compliance_report
            AFTER INSERT OR UPDATE OR DELETE ON compliance_report
            FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_org_compliance_report_count();
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
            CREATE UNIQUE INDEX mv_org_compliance_report_count_org_id_idx
            ON mv_org_compliance_report_count (organization_id);
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
        CREATE UNIQUE INDEX mv_transaction_aggregate_unique_idx
            ON mv_transaction_aggregate (
                transaction_id,
                transaction_type
            );
        """
        )
        op.execute(
            """
        CREATE OR REPLACE FUNCTION refresh_transaction_aggregate()
        RETURNS TRIGGER AS $$
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_aggregate;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        """
        )
        op.execute(
            """
        CREATE TRIGGER refresh_transaction_view_after_transfer
        AFTER INSERT OR UPDATE OR DELETE ON transfer
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_transaction_aggregate();
        """
        )
        op.execute(
            """
            CREATE TRIGGER refresh_transaction_view_after_initiative_agreement
            AFTER INSERT OR UPDATE OR DELETE ON initiative_agreement
            FOR EACH STATEMENT
            EXECUTE FUNCTION refresh_transaction_aggregate();
            """
        )
        op.execute(
            """
            CREATE TRIGGER refresh_transaction_view_after_admin_adjustment
            AFTER INSERT OR UPDATE OR DELETE ON admin_adjustment
            FOR EACH STATEMENT
            EXECUTE FUNCTION refresh_transaction_aggregate();
            """
        )
        op.execute(
            """
            CREATE TRIGGER refresh_transaction_view_after_transfer_history
            AFTER INSERT OR UPDATE OR DELETE ON transfer_history
            FOR EACH STATEMENT
            EXECUTE FUNCTION refresh_transaction_aggregate();
            """
        )
        op.execute(
            """
            CREATE TRIGGER refresh_transaction_view_after_initiative_agreement_history
            AFTER INSERT OR UPDATE OR DELETE ON initiative_agreement_history
            FOR EACH STATEMENT
            EXECUTE FUNCTION refresh_transaction_aggregate();
            """
        )
        op.execute(
            """
            CREATE TRIGGER refresh_transaction_view_after_admin_adjustment_history
            AFTER INSERT OR UPDATE OR DELETE ON admin_adjustment_history
            FOR EACH STATEMENT
            EXECUTE FUNCTION refresh_transaction_aggregate();
            """
        )
        op.execute(
            """
            CREATE TRIGGER refresh_transaction_view_after_compliance_report
            AFTER INSERT OR UPDATE OR DELETE ON compliance_report
            FOR EACH STATEMENT
            EXECUTE FUNCTION refresh_transaction_aggregate();
            """
        )

    except Exception as e:
        logger.error(f"Migration upgrade failed: {e}")
        raise


def downgrade():
    try:
        op.execute(
            "DROP MATERIALIZED VIEW IF EXISTS mv_org_compliance_report_count CASCADE;"
        )
        op.execute(
            "DROP MATERIALIZED VIEW IF EXISTS mv_compliance_report_count CASCADE;"
        )
        op.execute(
            "DROP FUNCTION IF EXISTS refresh_mv_org_compliance_report_count() CASCADE;"
        )
        op.execute(
            "DROP FUNCTION IF EXISTS refresh_mv_compliance_report_count() CASCADE;"
        )
        op.execute(
            "DROP TRIGGER IF EXISTS refresh_mv_org_compliance_report_count_after_compliance_report ON compliance_report CASCADE;"
        )
        op.execute(
            "DROP TRIGGER IF EXISTS refresh_mv_compliance_report_count_after_change ON compliance_report CASCADE;"
        )
        op.execute(
            "DROP INDEX IF EXISTS mv_org_compliance_report_count_org_id_idx CASCADE;"
        )
        op.execute("DROP INDEX IF EXISTS mv_compliance_report_count_idx CASCADE;")
        op.execute("DROP VIEW IF EXISTS v_compliance_report CASCADE;")
        op.execute(
            "DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer ON transfer;"
        )
        op.execute(
            "DROP TRIGGER IF EXISTS refresh_transaction_view_after_initiative_agreement ON initiative_agreement;"
        )
        op.execute(
            "DROP TRIGGER IF EXISTS refresh_transaction_view_after_admin_adjustment ON admin_adjustment;"
        )
        op.execute(
            "DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer_history ON transfer_history;"
        )
        op.execute(
            "DROP TRIGGER IF EXISTS refresh_transaction_view_after_initiative_agreement_history ON initiative_agreement_history;"
        )
        op.execute(
            "DROP TRIGGER IF EXISTS refresh_transaction_view_after_admin_adjustment_history ON admin_adjustment_history;"
        )
        op.execute(
            "DROP TRIGGER IF EXISTS refresh_transaction_view_after_compliance_report ON compliance_report;"
        )

        op.execute("DROP FUNCTION IF EXISTS refresh_transaction_aggregate();")
        op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_transaction_aggregate;")
        # Create Materialized Views
        op.execute(
            """
        CREATE MATERIALIZED VIEW mv_transaction_aggregate AS
        with all_transactions as (
            ------------------------------------------------------------------------
            -- Transfers
            ------------------------------------------------------------------------
            SELECT
                t.transfer_id AS transaction_id,
                'Transfer' AS transaction_type,
                NULL AS description,
                org_from.organization_id AS from_organization_id,
                org_from.name AS from_organization,
                org_to.organization_id AS to_organization_id,
                org_to.name AS to_organization,
                t.quantity,
                t.price_per_unit,
                ts.status::text AS status,
                CASE 
                    WHEN ts.status = 'Recorded' THEN EXTRACT(YEAR FROM (
                        SELECT th.create_date
                        FROM transfer_history th
                        WHERE th.transfer_id = t.transfer_id
                        AND th.transfer_status_id = 6  -- Recorded
                        LIMIT 1
                    ))::text
                    ELSE 'N/A'
                END AS compliance_period,
                t.from_org_comment AS comment,
                tc.category,
                (
                    SELECT th.create_date
                    FROM transfer_history th
                    WHERE th.transfer_id = t.transfer_id
                      AND th.transfer_status_id = 6  -- Recorded
                ) AS recorded_date,
                NULL AS approved_date,
                t.transaction_effective_date,
                t.update_date,
                t.create_date
            FROM transfer t
            JOIN organization org_from
                ON t.from_organization_id = org_from.organization_id
            JOIN organization org_to
                ON t.to_organization_id = org_to.organization_id
            JOIN transfer_status ts
                ON t.current_status_id = ts.transfer_status_id
            LEFT JOIN transfer_category tc
                ON t.transfer_category_id = tc.transfer_category_id

            UNION ALL

            ------------------------------------------------------------------------
            -- Initiative Agreements
            ------------------------------------------------------------------------
            SELECT
                ia.initiative_agreement_id AS transaction_id,
                'InitiativeAgreement' AS transaction_type,
                NULL AS description,
                NULL AS from_organization_id,
                NULL AS from_organization,
                org.organization_id AS to_organization_id,
                org.name AS to_organization,
                ia.compliance_units AS quantity,
                NULL AS price_per_unit,
                ias.status::text AS status,
                EXTRACT(YEAR FROM ia.transaction_effective_date)::text AS compliance_period,
                ia.gov_comment AS comment,
                NULL AS category,
                NULL AS recorded_date,
                (
                    SELECT iah.create_date
                    FROM initiative_agreement_history iah
                    WHERE iah.initiative_agreement_id = ia.initiative_agreement_id
                      AND iah.initiative_agreement_status_id = 3 -- Approved
                ) AS approved_date,
                ia.transaction_effective_date,
                ia.update_date,
                ia.create_date
            FROM initiative_agreement ia
            JOIN organization org
                ON ia.to_organization_id = org.organization_id
            JOIN initiative_agreement_status ias
                ON ia.current_status_id = ias.initiative_agreement_status_id

            UNION ALL

            ------------------------------------------------------------------------
            -- Admin Adjustments
            ------------------------------------------------------------------------
            SELECT
                aa.admin_adjustment_id AS transaction_id,
                'AdminAdjustment' AS transaction_type,
                NULL AS description,
                NULL AS from_organization_id,
                NULL AS from_organization,
                org.organization_id AS to_organization_id,
                org.name AS to_organization,
                aa.compliance_units AS quantity,
                NULL AS price_per_unit,
                aas.status::text AS status,
                EXTRACT(YEAR FROM aa.transaction_effective_date)::text AS compliance_period,
                aa.gov_comment AS comment,
                NULL AS category,
                NULL AS recorded_date,
                (
                    SELECT aah.create_date
                    FROM admin_adjustment_history aah
                    WHERE aah.admin_adjustment_id = aa.admin_adjustment_id
                      AND aah.admin_adjustment_status_id = 3 -- Approved
                ) AS approved_date,
                aa.transaction_effective_date,
                aa.update_date,
                aa.create_date
            FROM admin_adjustment aa
            JOIN organization org
                ON aa.to_organization_id = org.organization_id
            JOIN admin_adjustment_status aas
                ON aa.current_status_id = aas.admin_adjustment_status_id

            UNION ALL

            ------------------------------------------------------------------------
            -- Compliance Reports
            ------------------------------------------------------------------------
            SELECT
                cr.compliance_report_id AS transaction_id,
                'ComplianceReport' AS transaction_type,
                cr.nickname AS description,
                NULL AS from_organization_id,
                NULL AS from_organization,
                org.organization_id AS to_organization_id,
                org.name AS to_organization,
                tr.compliance_units AS quantity,
                NULL AS price_per_unit,
                crs.status::text AS status,
                cp.description AS compliance_period,
                NULL AS comment,
                NULL AS category,
                NULL AS recorded_date,
                NULL AS approved_date,
                NULL AS transaction_effective_date,
                cr.update_date,
                cr.create_date
            FROM compliance_report cr
            JOIN organization org
                ON cr.organization_id = org.organization_id
            JOIN compliance_report_status crs
                ON cr.current_status_id = crs.compliance_report_status_id
            JOIN compliance_period cp
                ON cr.compliance_period_id = cp.compliance_period_id
            JOIN "transaction" tr
                ON cr.transaction_id = tr.transaction_id
               AND cr.transaction_id IS NOT NULL
            WHERE crs.status IN ('Assessed', 'Reassessed'))
            SELECT DISTINCT * FROM all_transactions;
        """
        )
        op.execute(
            """
            CREATE MATERIALIZED VIEW mv_org_compliance_report_count AS
            SELECT
                organization_id,
                COUNT(*) FILTER (WHERE current_status_id = 1) AS count_in_progress,
                COUNT(*) FILTER (WHERE current_status_id = 2) AS count_awaiting_gov_review
            FROM compliance_report
            GROUP BY organization_id;
            """
        )
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

        # Create Refresh Functions, triggers and indices for materialized view
        op.execute(
            """
            CREATE OR REPLACE FUNCTION refresh_mv_org_compliance_report_count()
            RETURNS TRIGGER AS $$
            BEGIN
                REFRESH MATERIALIZED VIEW CONCURRENTLY mv_org_compliance_report_count;
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;
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
            CREATE TRIGGER refresh_mv_org_compliance_report_count_after_compliance_report
            AFTER INSERT OR UPDATE OR DELETE ON compliance_report
            FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_org_compliance_report_count();
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
            CREATE UNIQUE INDEX mv_org_compliance_report_count_org_id_idx
            ON mv_org_compliance_report_count (organization_id);
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
        CREATE OR REPLACE FUNCTION refresh_transaction_aggregate()
        RETURNS TRIGGER AS $$
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_aggregate;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        """
        )
        op.execute(
            """
        CREATE TRIGGER refresh_transaction_view_after_transfer
        AFTER INSERT OR UPDATE OR DELETE ON transfer
        FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
        """
        )
        op.execute(
            """
            CREATE TRIGGER refresh_transaction_view_after_initiative_agreement
            AFTER INSERT OR UPDATE OR DELETE ON initiative_agreement
            FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
            """
        )
        op.execute(
            """
            CREATE TRIGGER refresh_transaction_view_after_admin_adjustment
            AFTER INSERT OR UPDATE OR DELETE ON admin_adjustment
            FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
            """
        )
        op.execute(
            """
            CREATE TRIGGER refresh_transaction_view_after_transfer_history
            AFTER INSERT OR UPDATE OR DELETE ON transfer_history
            FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
            """
        )
        op.execute(
            """
            CREATE TRIGGER refresh_transaction_view_after_initiative_agreement_history
            AFTER INSERT OR UPDATE OR DELETE ON initiative_agreement_history
            FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
            """
        )
        op.execute(
            """
            CREATE TRIGGER refresh_transaction_view_after_admin_adjustment_history
            AFTER INSERT OR UPDATE OR DELETE ON admin_adjustment_history
            FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
            """
        )
        op.execute(
            """
            CREATE TRIGGER refresh_transaction_view_after_compliance_report
            AFTER INSERT OR UPDATE OR DELETE ON compliance_report
            FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
            """
        )
        logger.info("Migration downgrade completed successfully.")

    except Exception as e:
        logger.error(f"Migration downgrade failed: {e}")
        raise
