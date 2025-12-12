"""Include standalone transaction rows in credit ledger.

This migration updates mv_transaction_aggregate to pull in transactions that
live only in the transaction table (e.g., legacy TFRS credit validations/
reductions inserted as Adjustment actions without a compliance_report
transaction_id). mv_credit_ledger is rebuilt to surface these rows.
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "b71c1d2e3f45"
down_revision = "b8c9d0e1f2a3"
branch_labels = None
depends_on = None


def create_mv_transaction_aggregate():
    """Create the mv_transaction_aggregate materialized view with standalone transactions."""
    op.execute(
        """
        CREATE MATERIALIZED VIEW mv_transaction_aggregate AS
            WITH all_transactions AS (
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
                UNION ALL
                ------------------------------------------------------------------------
                -- Standalone Transactions (legacy / unassociated)
                ------------------------------------------------------------------------
                SELECT
                    t.transaction_id AS transaction_id,
                    'StandaloneTransaction' AS transaction_type,
                    NULL AS description,
                    NULL AS from_organization_id,
                    NULL AS from_organization,
                    org.organization_id AS to_organization_id,
                    org.name AS to_organization,
                    t.compliance_units AS quantity,
                    NULL AS price_per_unit,
                    CASE WHEN COALESCE(t.effective_status, TRUE) THEN 'Recorded' ELSE 'Inactive' END AS status,
                    EXTRACT(YEAR FROM COALESCE(t.effective_date, t.create_date))::text AS compliance_period,
                    NULL AS from_org_comment,
                    NULL AS to_org_comment,
                    NULL AS government_comment,
                    NULL AS category,
                    NULL AS recorded_date,
                    NULL AS approved_date,
                    COALESCE(t.effective_date, t.create_date) AS transaction_effective_date,
                    COALESCE(t.update_date, t.create_date) AS update_date,
                    t.create_date
                FROM "transaction" t
                JOIN organization org
                    ON t.organization_id = org.organization_id
                LEFT JOIN compliance_report cr
                    ON cr.transaction_id = t.transaction_id
                LEFT JOIN admin_adjustment aa
                    ON aa.transaction_id = t.transaction_id
                LEFT JOIN initiative_agreement ia
                    ON ia.transaction_id = t.transaction_id
                LEFT JOIN transfer tf_from
                    ON tf_from.from_transaction_id = t.transaction_id
                LEFT JOIN transfer tf_to
                    ON tf_to.to_transaction_id = t.transaction_id
                WHERE cr.transaction_id IS NULL
                  AND aa.transaction_id IS NULL
                  AND ia.transaction_id IS NULL
                  AND tf_from.from_transaction_id IS NULL
                  AND tf_to.to_transaction_id IS NULL
                  AND COALESCE(t.effective_status, TRUE) = TRUE
            )
            , deduped as (
                SELECT
                    *,
                    ROW_NUMBER() OVER (
                        PARTITION BY transaction_id, transaction_type
                        ORDER BY update_date DESC NULLS LAST, create_date DESC NULLS LAST
                    ) AS rn
                FROM all_transactions
            )
            SELECT * FROM deduped WHERE rn = 1;
        """
    )


def create_mv_transaction_aggregate_index():
    """Create unique index on the materialized view for concurrent refresh."""
    op.execute(
        """
        CREATE UNIQUE INDEX mv_transaction_aggregate_unique_idx
            ON mv_transaction_aggregate (
                transaction_id,
                transaction_type
            );
        """
    )


def create_mv_credit_ledger():
    """Create the mv_credit_ledger materialized view, including standalone transactions."""
    op.execute(
        """
        CREATE MATERIALIZED VIEW mv_credit_ledger AS
        WITH base AS (
            SELECT
                t.transaction_id,
                t.transaction_type,
                t.compliance_period,
                t.from_organization_id                       AS organization_id,
                -ABS(t.quantity)                             AS compliance_units,
                t.create_date,
                t.update_date
            FROM   mv_transaction_aggregate t
            WHERE  t.transaction_type = 'Transfer'
            AND  t.status            = 'Recorded'

            UNION ALL

            SELECT
                t.transaction_id,
                t.transaction_type,
                t.compliance_period,
                t.to_organization_id,
                ABS(t.quantity),
                t.create_date,
                t.update_date
            FROM   mv_transaction_aggregate t
            WHERE  t.transaction_type = 'Transfer'
            AND  t.status            = 'Recorded'

            UNION ALL

            SELECT
                t.transaction_id,
                t.transaction_type,
                t.compliance_period,
                t.to_organization_id                       AS organization_id,
                t.quantity,
                t.create_date,
                t.update_date
            FROM   mv_transaction_aggregate t
            WHERE  t.transaction_type  = 'AdminAdjustment'
            AND  t.status            = 'Approved'

            UNION ALL

            SELECT
                t.transaction_id,
                t.transaction_type,
                t.compliance_period,
                t.to_organization_id                       AS organization_id,
                t.quantity,
                t.create_date,
                t.update_date
            FROM   mv_transaction_aggregate t
            WHERE  t.transaction_type  = 'InitiativeAgreement'
            AND  t.status            = 'Approved'

            UNION ALL

            SELECT
                t.transaction_id,
                t.transaction_type,
                t.compliance_period,
                t.to_organization_id                       AS organization_id,
                t.quantity,
                t.create_date,
                t.update_date
            FROM   mv_transaction_aggregate t
            WHERE  t.transaction_type  = 'ComplianceReport'
            AND  t.status            = 'Assessed'

            UNION ALL

            SELECT
                t.transaction_id,
                t.transaction_type,
                t.compliance_period,
                t.to_organization_id                       AS organization_id,
                t.quantity,
                t.create_date,
                t.update_date
            FROM   mv_transaction_aggregate t
            WHERE  t.transaction_type  = 'StandaloneTransaction'
            AND  t.status            = 'Recorded'
        )

        SELECT
            transaction_id,
            transaction_type,
            compliance_period,
            organization_id,
            compliance_units,
            SUM(compliance_units) OVER (
                PARTITION BY organization_id
                ORDER BY update_date
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) AS available_balance,
            create_date,
            update_date
        FROM base;
        """
    )


def create_mv_credit_ledger_indexes():
    """Create indexes for mv_credit_ledger."""
    op.execute(
        "CREATE INDEX mv_credit_ledger_org_year_idx ON mv_credit_ledger (organization_id, compliance_period);"
    )
    op.execute(
        "CREATE INDEX mv_credit_ledger_org_date_idx ON mv_credit_ledger (organization_id, update_date DESC);"
    )
    op.execute(
        "CREATE UNIQUE INDEX mv_credit_ledger_tx_org_idx ON mv_credit_ledger (transaction_id, transaction_type, organization_id);"
    )


def create_previous_mv_transaction_aggregate():
    """Previous mv_transaction_aggregate definition (without standalone transactions)."""
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
            , deduped as (
                SELECT
                    *,
                    ROW_NUMBER() OVER (
                        PARTITION BY transaction_id, transaction_type
                        ORDER BY update_date DESC NULLS LAST, create_date DESC NULLS LAST
                    ) AS rn
                FROM all_transactions
            )
            SELECT * FROM deduped WHERE rn = 1;
        """
    )


def create_previous_mv_credit_ledger():
    """Previous mv_credit_ledger definition (without standalone transactions)."""
    op.execute(
        """
        CREATE MATERIALIZED VIEW mv_credit_ledger AS
        WITH base AS (
            SELECT
                t.transaction_id,
                t.transaction_type,
                t.compliance_period,
                t.from_organization_id                       AS organization_id,
                -ABS(t.quantity)                             AS compliance_units,
                t.create_date,
                t.update_date
            FROM   mv_transaction_aggregate t
            WHERE  t.transaction_type = 'Transfer'
            AND  t.status            = 'Recorded'

            UNION ALL

            SELECT
                t.transaction_id,
                t.transaction_type,
                t.compliance_period,
                t.to_organization_id,
                ABS(t.quantity),
                t.create_date,
                t.update_date
            FROM   mv_transaction_aggregate t
            WHERE  t.transaction_type = 'Transfer'
            AND  t.status            = 'Recorded'

            UNION ALL

            SELECT
                t.transaction_id,
                t.transaction_type,
                t.compliance_period,
                t.to_organization_id                       AS organization_id,
                t.quantity,
                t.create_date,
                t.update_date
            FROM   mv_transaction_aggregate t
            WHERE  t.transaction_type  = 'AdminAdjustment'
            AND  t.status            = 'Approved'

            UNION ALL

            SELECT
                t.transaction_id,
                t.transaction_type,
                t.compliance_period,
                t.to_organization_id                       AS organization_id,
                t.quantity,
                t.create_date,
                t.update_date
            FROM   mv_transaction_aggregate t
            WHERE  t.transaction_type  = 'InitiativeAgreement'
            AND  t.status            = 'Approved'

            UNION ALL

            SELECT
                t.transaction_id,
                t.transaction_type,
                t.compliance_period,
                t.to_organization_id                       AS organization_id,
                t.quantity,
                t.create_date,
                t.update_date
            FROM   mv_transaction_aggregate t
            WHERE  t.transaction_type  = 'ComplianceReport'
            AND  t.status            = 'Assessed'
        )

        SELECT
            transaction_id,
            transaction_type,
            compliance_period,
            organization_id,
            compliance_units,
            SUM(compliance_units) OVER (
                PARTITION BY organization_id
                ORDER BY update_date
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) AS available_balance,
            create_date,
            update_date
        FROM base;
        """
    )


def upgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_credit_ledger CASCADE;")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_transaction_aggregate CASCADE;")

    create_mv_transaction_aggregate()
    create_mv_transaction_aggregate_index()
    create_mv_credit_ledger()
    create_mv_credit_ledger_indexes()


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_credit_ledger CASCADE;")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_transaction_aggregate CASCADE;")

    create_previous_mv_transaction_aggregate()
    create_mv_transaction_aggregate_index()
    create_previous_mv_credit_ledger()
    create_mv_credit_ledger_indexes()
