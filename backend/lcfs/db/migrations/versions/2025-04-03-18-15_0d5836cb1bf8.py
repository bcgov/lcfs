"""Expose all Comment Fields on Transactions

Revision ID: 0d5836cb1bf8
Revises: 2e2f6f7ff390
Create Date: 2025-02-12 18:15:36.744698

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "0d5836cb1bf8"
down_revision = "2e2f6f7ff390"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------
    # 1) Drop old triggers/functions
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
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer_comment ON transfer_comment;"
    )

    op.execute("DROP FUNCTION IF EXISTS refresh_transaction_aggregate();")

    # ------------------------------------
    # 2) Drop materialized view
    # ------------------------------------
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_transaction_aggregate;")

    # --------------------------------------------------
    # 3) Create the updated mv_transaction_aggregate with FROM_ORG comments for transfers.
    # --------------------------------------------------
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
                        WHEN ts.status = 'Recorded' THEN
                            EXTRACT(YEAR FROM COALESCE(t.transaction_effective_date, (
                                SELECT th.create_date
                                FROM transfer_history th
                                WHERE th.transfer_id = t.transfer_id
                                AND th.transfer_status_id = 6  -- Recorded
                                LIMIT 1
                            )))::text
                        ELSE 'N/A'
                    END AS compliance_period,

                    -- Get the FROM_ORG comment if it exists
                    (
                        SELECT tc.comment
                        FROM transfer_comment tc
                        WHERE tc.transfer_id = t.transfer_id
                        AND tc.comment_source = 'FROM_ORG'
                        LIMIT 1
                    ) AS from_org_comment,

                    -- Get the TO_ORG comment if it exists
                    (
                        SELECT tc.comment
                        FROM transfer_comment tc
                        WHERE tc.transfer_id = t.transfer_id
                        AND tc.comment_source = 'TO_ORG'
                        LIMIT 1
                    ) AS to_org_comment,

                    -- Get the GOVERNMENT comment if it exists
                    (
                        SELECT tc.comment
                        FROM transfer_comment tc
                        WHERE tc.transfer_id = t.transfer_id
                        AND tc.comment_source = 'GOVERNMENT'
                        LIMIT 1
                    ) AS government_comment,

                    tc.category,
                    (
                        SELECT th.create_date
                        FROM transfer_history th
                        WHERE th.transfer_id = t.transfer_id
                        AND th.transfer_status_id = 6  -- Recorded
                        LIMIT 1
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
                    null as from_org_comment,
                    null as to_org_comment,
                    ia.gov_comment AS government_comment,
                    NULL AS category,
                    NULL AS recorded_date,
                    (
                        SELECT iah.create_date
                        FROM initiative_agreement_history iah
                        WHERE iah.initiative_agreement_id = ia.initiative_agreement_id
                        AND iah.initiative_agreement_status_id = 3 -- Approved
                        LIMIT 1
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
                    null as from_org_comment,
                    null as to_org_comment,
                    aa.gov_comment AS government_comment,
                    NULL AS category,
                    NULL AS recorded_date,
                    (
                        SELECT aah.create_date
                        FROM admin_adjustment_history aah
                        WHERE aah.admin_adjustment_id = aa.admin_adjustment_id
                        AND aah.admin_adjustment_status_id = 3 -- Approved
                        LIMIT 1
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
                    NULL as from_org_comment,
                    NULL as to_org_comment,
                    NULL AS government_comment,
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
                WHERE crs.status IN ('Assessed', 'Reassessed')
            )
            SELECT DISTINCT * FROM all_transactions;
        """
    )

    # ------------------------------------
    # 4) Create index
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
    # 5) Create refresh function & triggers
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
    op.execute(
        """
        CREATE TRIGGER refresh_transaction_view_after_transfer_comment
        AFTER INSERT OR UPDATE OR DELETE ON transfer_comment
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_transaction_aggregate();
        """
    )


def downgrade() -> None:
    # ------------------------------------
    # 1) Drop old triggers/functions
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
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer_comment ON transfer_comment;"
    )

    op.execute("DROP FUNCTION IF EXISTS refresh_transaction_aggregate();")

    # ------------------------------------
    # 2) Drop old materialized view
    # ------------------------------------
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_transaction_aggregate;")

    # ------------------------------------
    # 3) Recreate the old materialized view
    # ------------------------------------
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
                        WHEN ts.status = 'Recorded' THEN
                            EXTRACT(YEAR FROM COALESCE(t.transaction_effective_date, (
                                SELECT th.create_date
                                FROM transfer_history th
                                WHERE th.transfer_id = t.transfer_id
                                AND th.transfer_status_id = 6  -- Recorded
                                LIMIT 1
                            )))::text
                        ELSE 'N/A'
                    END AS compliance_period,

                    -- Get the FROM_ORG comment if it exists
                    (
                        SELECT tc.comment
                        FROM transfer_comment tc
                        WHERE tc.transfer_id = t.transfer_id
                        AND tc.comment_source = 'FROM_ORG'
                        LIMIT 1
                    ) AS comment,

                    tc.category,
                    (
                        SELECT th.create_date
                        FROM transfer_history th
                        WHERE th.transfer_id = t.transfer_id
                        AND th.transfer_status_id = 6  -- Recorded
                        LIMIT 1
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
                        LIMIT 1
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
                        LIMIT 1
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
                WHERE crs.status IN ('Assessed', 'Reassessed')
            )
            SELECT DISTINCT * FROM all_transactions;
        """
    )

    # ------------------------------------
    # 4) Create old index
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
    # 5) Recreate old refresh function & triggers
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
