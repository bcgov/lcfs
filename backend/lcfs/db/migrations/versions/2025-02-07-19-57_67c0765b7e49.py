"""Transfers have N/A for Compliance Period until recorded, then set to the recorded year.

Revision ID: 67c0765b7e49
Revises: 145e5501e322
Create Date: 2025-02-07 19:57:21.922120

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "67c0765b7e49"
down_revision = "145e5501e322"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------
    # Step 1: Drop old triggers/functions
    # ------------------------------------
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

    # ------------------------------------
    # Step 2: Drop materialized view
    # ------------------------------------
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_transaction_aggregate;")

    # ------------------------------------
    # Step 3: Create new MV with updated logic
    # ------------------------------------
    op.execute(
        """
        CREATE MATERIALIZED VIEW mv_transaction_aggregate AS
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
            WHERE crs.status IN ('Assessed', 'Reassessed');
        """
    )

    # ------------------------------------
    # Step 4: Create index
    # ------------------------------------
    op.execute(
        """
        CREATE UNIQUE INDEX mv_transaction_aggregate_unique_idx
            ON mv_transaction_aggregate (
                transaction_id,
                transaction_type
            );
        """
    )

    # ------------------------------------
    # Step 5: Create refresh function & triggers
    # ------------------------------------
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


def downgrade() -> None:
    # ------------------------------------
    # 1) Drop new triggers & function
    # ------------------------------------
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

    # ------------------------------------
    # 2) Drop new MV
    # ------------------------------------
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_transaction_aggregate;")

    # ------------------------------------
    # 3) Recreate OLD MV definition
    #    (with compliance_period = NULL for everything except CR)
    # ------------------------------------
    op.execute(
        """
        CREATE MATERIALIZED VIEW mv_transaction_aggregate AS
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
                EXTRACT(YEAR FROM t.transaction_effective_date)::text AS compliance_period,
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
            WHERE crs.status IN ('Assessed', 'Reassessed');
        """
    )

    # Recreate old unique index
    op.execute(
        """
        CREATE UNIQUE INDEX mv_transaction_aggregate_unique_idx
            ON mv_transaction_aggregate (
                transaction_id,
                description,
                transaction_type
            );
        """
    )

    # ------------------------------------
    # 4) Recreate old function/triggers
    # ------------------------------------
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
