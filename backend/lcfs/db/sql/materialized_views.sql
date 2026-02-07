-- ==========================================
-- Materialized View Definitions (Reference)
-- ==========================================
-- This file contains the current definitions for ALL materialized views.
-- These are NOT auto-deployed on startup. They are created via migrations
-- and refreshed by database triggers. This file exists as a single
-- source of truth for the current definitions.
-- ==========================================

-- ==========================================
-- mv_transaction_aggregate
-- Source: 2025-12-02-12-00_b71c1d2e3f45.py
-- Depends on: transfer, initiative_agreement, admin_adjustment,
--             compliance_report, transaction (standalone)
-- ==========================================
DROP MATERIALIZED VIEW IF EXISTS mv_credit_ledger CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_transaction_aggregate CASCADE;

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
                    EXTRACT(YEAR FROM (
                        COALESCE(t.transaction_effective_date, (
                            SELECT th.create_date
                            FROM transfer_history th
                            WHERE th.transfer_id = t.transfer_id
                            AND th.transfer_status_id = 6  -- Recorded
                            LIMIT 1
                        )) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver'
                    ))::text
                ELSE 'N/A'
            END AS compliance_period,
            (
                SELECT tc.comment
                FROM transfer_comment tc
                WHERE tc.transfer_id = t.transfer_id
                AND tc.comment_source = 'FROM_ORG'
                LIMIT 1
            ) AS from_org_comment,
            (
                SELECT tc.comment
                FROM transfer_comment tc
                WHERE tc.transfer_id = t.transfer_id
                AND tc.comment_source = 'TO_ORG'
                LIMIT 1
            ) AS to_org_comment,
            (
                SELECT tc.comment
                FROM transfer_comment tc
                WHERE tc.transfer_id = t.transfer_id
                AND tc.comment_source = 'GOVERNMENT'
                LIMIT 1
            ) AS government_comment,
            tc.category,
            (
                SELECT (th.create_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver')::date
                FROM transfer_history th
                WHERE th.transfer_id = t.transfer_id
                AND th.transfer_status_id = 6  -- Recorded
                LIMIT 1
            ) AS recorded_date,
            NULL AS approved_date,
            (t.transaction_effective_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver')::date AS transaction_effective_date,
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
            ia.description,
            NULL AS from_organization_id,
            NULL AS from_organization,
            org.organization_id AS to_organization_id,
            org.name AS to_organization,
            ia.compliance_units AS quantity,
            NULL AS price_per_unit,
            ias.status::text AS status,
            EXTRACT(YEAR FROM (ia.transaction_effective_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver'))::text AS compliance_period,
            null as from_org_comment,
            null as to_org_comment,
            ia.gov_comment AS government_comment,
            NULL AS category,
            NULL AS recorded_date,
            (
                SELECT (iah.create_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver')::date
                FROM initiative_agreement_history iah
                WHERE iah.initiative_agreement_id = ia.initiative_agreement_id
                AND iah.initiative_agreement_status_id = 3 -- Approved
                LIMIT 1
            ) AS approved_date,
            (ia.transaction_effective_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver')::date AS transaction_effective_date,
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
            aa.description,
            NULL AS from_organization_id,
            NULL AS from_organization,
            org.organization_id AS to_organization_id,
            org.name AS to_organization,
            aa.compliance_units AS quantity,
            NULL AS price_per_unit,
            aas.status::text AS status,
            EXTRACT(YEAR FROM (aa.transaction_effective_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver'))::text AS compliance_period,
            null as from_org_comment,
            null as to_org_comment,
            aa.gov_comment AS government_comment,
            NULL AS category,
            NULL AS recorded_date,
            (
                SELECT (aah.create_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver')::date
                FROM admin_adjustment_history aah
                WHERE aah.admin_adjustment_id = aa.admin_adjustment_id
                AND aah.admin_adjustment_status_id = 3 -- Approved
                LIMIT 1
            ) AS approved_date,
            (aa.transaction_effective_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver')::date AS transaction_effective_date,
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
            NULL AS description,
            NULL AS from_organization_id,
            NULL AS from_organization,
            org.organization_id AS to_organization_id,
            org.name AS to_organization,
            cr.compliance_units AS quantity,
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
        UNION ALL
        ------------------------------------------------------------------------
        -- Standalone Transactions (legacy / unassociated)
        ------------------------------------------------------------------------
        SELECT
            t.transaction_id,
            'StandaloneTransaction' AS transaction_type,
            t.description,
            NULL AS from_organization_id,
            NULL AS from_organization,
            org.organization_id AS to_organization_id,
            org.name AS to_organization,
            t.compliance_units AS quantity,
            NULL AS price_per_unit,
            CASE WHEN COALESCE(t.effective_status, TRUE) THEN 'Recorded' ELSE 'Inactive' END AS status,
            EXTRACT(YEAR FROM (COALESCE(t.effective_date, t.create_date) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver'))::text AS compliance_period,
            NULL AS from_org_comment,
            NULL AS to_org_comment,
            NULL AS government_comment,
            NULL AS category,
            NULL AS recorded_date,
            NULL AS approved_date,
            (COALESCE(t.effective_date, t.create_date) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver')::date AS transaction_effective_date,
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
    SELECT * FROM all_transactions;

CREATE INDEX idx_mv_transaction_aggregate_from_org ON mv_transaction_aggregate(from_organization_id);
CREATE INDEX idx_mv_transaction_aggregate_to_org ON mv_transaction_aggregate(to_organization_id);

-- ==========================================
-- mv_credit_ledger
-- Source: 2025-12-02-12-00_b71c1d2e3f45.py
-- Depends on: mv_transaction_aggregate
-- ==========================================
CREATE MATERIALIZED VIEW mv_credit_ledger AS
WITH base AS (
    SELECT
        t.transaction_id,
        t.transaction_type,
        t.compliance_period,
        t.quantity AS compliance_units,
        CASE
            WHEN t.to_organization_id IS NOT NULL THEN t.to_organization_id
            WHEN t.from_organization_id IS NOT NULL THEN t.from_organization_id
        END AS organization_id,
        t.create_date,
        t.update_date,
        CASE
            WHEN t.to_organization_id IS NOT NULL THEN t.quantity
            WHEN t.from_organization_id IS NOT NULL THEN -t.quantity
            ELSE 0
        END AS unit_change
    FROM mv_transaction_aggregate t
    WHERE t.status IN ('Recorded', 'Assessed')
),
cumulative AS (
    SELECT
        b.transaction_id,
        b.transaction_type,
        b.organization_id,
        b.compliance_period,
        b.compliance_units,
        b.create_date,
        b.update_date,
        SUM(b.unit_change) OVER (
            PARTITION BY b.organization_id
            ORDER BY b.update_date, b.transaction_id
        ) AS available_balance
    FROM base b
)
SELECT * FROM cumulative;

CREATE INDEX idx_mv_credit_ledger_org ON mv_credit_ledger(organization_id);
CREATE INDEX idx_mv_credit_ledger_period ON mv_credit_ledger(compliance_period);

-- ==========================================
-- mv_transaction_count
-- Source: 2025-01-20-14-37_f217cd32474b.py
-- ==========================================
DROP MATERIALIZED VIEW IF EXISTS mv_transaction_count CASCADE;

CREATE MATERIALIZED VIEW mv_transaction_count AS
SELECT
    'transfers' AS transaction_type,
    COUNT(*) FILTER (WHERE t.current_status_id IN (4,5)) AS count_in_progress
FROM transfer t

UNION ALL

SELECT
    'initiative_agreements' AS transaction_type,
    COUNT(*) FILTER (WHERE ia.current_status_id IN (1,2)) AS count_in_progress
FROM initiative_agreement ia

UNION ALL

SELECT
    'admin_adjustments' AS transaction_type,
    COUNT(*) FILTER (WHERE aa.current_status_id IN (1,2)) AS count_in_progress
FROM admin_adjustment aa;

-- ==========================================
-- mv_compliance_report_count
-- Source: 2025-05-05-22-42_3365d6360912.py
-- ==========================================
DROP MATERIALIZED VIEW IF EXISTS mv_compliance_report_count CASCADE;

CREATE MATERIALIZED VIEW mv_compliance_report_count AS
SELECT
    CAST(vcr.report_status AS VARCHAR) AS status,
    COUNT(*) AS count
FROM v_compliance_report vcr
WHERE
    vcr.report_status_id NOT IN (1)  -- Draft
    AND CAST(vcr.report_status AS VARCHAR) IN ('Submitted',
                                                'Recommended_by_analyst',
                                                'Recommended_by_manager',
                                                'Analyst_adjustment')
    AND vcr.version = (
        SELECT MAX(cr.version)
        FROM compliance_report cr
        WHERE vcr.compliance_report_group_uuid = cr.compliance_report_group_uuid
          AND cr.current_status_id NOT IN (1)
    )
GROUP BY CAST(vcr.report_status AS VARCHAR)
ORDER BY status DESC;

-- ==========================================
-- mv_fuel_code_count
-- Source: 2025-01-20-14-37_f217cd32474b.py
-- ==========================================
DROP MATERIALIZED VIEW IF EXISTS mv_fuel_code_count CASCADE;

CREATE MATERIALIZED VIEW mv_fuel_code_count AS
SELECT
    CASE fuel_status_id
        WHEN 1 THEN 'Draft'
    END AS status,
    COUNT(*) AS count
FROM fuel_code
WHERE fuel_status_id = 1
GROUP BY fuel_status_id;

-- ==========================================
-- mv_director_review_transaction_count
-- Source: 2025-06-18-17-00_a1b2c3d4e5f6.py
-- ==========================================
DROP MATERIALIZED VIEW IF EXISTS mv_director_review_transaction_count CASCADE;

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

-- ==========================================
-- mv_org_compliance_report_count
-- Source: 2025-03-26-07-08_2e2f6f7ff390.py
-- ==========================================
DROP MATERIALIZED VIEW IF EXISTS mv_org_compliance_report_count CASCADE;

CREATE MATERIALIZED VIEW mv_org_compliance_report_count AS
SELECT
    cr.organization_id,
    COUNT(*) FILTER (WHERE cr.current_status_id = (SELECT compliance_report_status_id
                                                     FROM compliance_report_status
                                                    WHERE status = 'Draft' LIMIT 1)
    ) AS count_in_progress,
    COUNT(*) FILTER (WHERE cr.current_status_id in (
        SELECT compliance_report_status_id
        FROM compliance_report_status where status in (
                'Submitted',
                'Recommended_by_analyst',
                'Recommended_by_manager',
                'Not_recommended_by_analyst',
                'Not_recommended_by_manager',
                'Analyst_adjustment'
            )
        )
    ) AS count_awaiting_gov_review
FROM compliance_report cr
JOIN (
    SELECT
        compliance_report_group_uuid,
        MAX(version) AS max_version
    FROM compliance_report
    GROUP BY compliance_report_group_uuid
) latest ON cr.compliance_report_group_uuid = latest.compliance_report_group_uuid
AND cr.version = latest.max_version
GROUP BY cr.organization_id
ORDER BY cr.organization_id;
