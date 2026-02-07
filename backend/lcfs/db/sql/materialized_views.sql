-- ==========================================
-- Materialized View Definitions (Reference)
-- ==========================================
-- This file contains the current definitions for all materialized views
-- EXCEPT mv_transaction_aggregate and mv_credit_ledger, which are defined
-- in their own migration (2025-12-02-12-00_b71c1d2e3f45.py).
--
-- These are NOT auto-deployed on startup. They are created via migrations
-- and refreshed by database triggers. This file exists as a single
-- source of truth for the current definitions.
-- ==========================================

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
