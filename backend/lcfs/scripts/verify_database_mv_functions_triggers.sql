-- Query 1: Verify Materialized Views
WITH expected_materialized_views AS (
    SELECT 'mv_transaction_aggregate' AS name
    UNION ALL
    SELECT 'mv_transaction_count'
    UNION ALL
    SELECT 'mv_director_review_transaction_count'
    UNION ALL
    SELECT 'mv_org_compliance_report_count'
    UNION ALL
    SELECT 'mv_compliance_report_count'
    UNION ALL
    SELECT 'mv_fuel_code_count'
)
SELECT 
    'Materialized View' AS item_type,
    ev.name AS name,
    CASE 
        WHEN mv.matviewname IS NOT NULL THEN 'Exists' 
        ELSE 'Missing' 
    END AS status
FROM 
    expected_materialized_views ev
LEFT JOIN 
    pg_matviews mv 
    ON mv.matviewname = ev.name
ORDER BY 
    ev.name;


-- Query 2: Verify Functions
WITH expected_functions AS (
    SELECT 'refresh_transaction_aggregate' AS name
    UNION ALL
    SELECT 'refresh_mv_transaction_count'
    UNION ALL
    SELECT 'refresh_mv_director_review_transaction_count'
    UNION ALL
    SELECT 'refresh_mv_org_compliance_report_count'
    UNION ALL
    SELECT 'refresh_mv_compliance_report_count'
    UNION ALL
    SELECT 'refresh_mv_fuel_code_count'
)
SELECT 
    'Function' AS item_type,
    ef.name AS name,
    CASE 
        WHEN f.proname IS NOT NULL AND pg_get_function_result(f.oid) = 'trigger' THEN 'Exists'
        WHEN f.proname IS NOT NULL THEN 'Incorrect Return Type'
        ELSE 'Missing'
    END AS status
FROM 
    expected_functions ef
LEFT JOIN 
    pg_proc f 
    ON f.proname = ef.name 
    AND pg_get_function_identity_arguments(f.oid) = ''
    AND f.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY 
    ef.name;


-- Query 3: Verify Triggers
WITH expected_triggers AS (
    SELECT 'refresh_transaction_view_after_transfer' AS trigger_name, 'transfer' AS table_name
    UNION ALL
    SELECT 'refresh_transaction_view_after_initiative_agreement', 'initiative_agreement'
    UNION ALL
    SELECT 'refresh_transaction_view_after_admin_adjustment', 'admin_adjustment'
    UNION ALL
    SELECT 'refresh_transaction_view_after_transfer_history', 'transfer_history'
    UNION ALL
    SELECT 'refresh_transaction_view_after_initiative_agreement_history', 'initiative_agreement_history'
    UNION ALL
    SELECT 'refresh_transaction_view_after_admin_adjustment_history', 'admin_adjustment_history'
    UNION ALL
    SELECT 'refresh_mv_transaction_count_after_transfer', 'transfer'
    UNION ALL
    SELECT 'refresh_mv_transaction_count_after_initiative_agreement', 'initiative_agreement'
    UNION ALL
    SELECT 'refresh_mv_transaction_count_after_admin_adjustment', 'admin_adjustment'
    UNION ALL
    SELECT 'refresh_mv_director_review_transaction_count_after_transfer', 'transfer'
    UNION ALL
    SELECT 'refresh_mv_director_review_transaction_count_after_cr', 'compliance_report'
    UNION ALL
    SELECT 'refresh_mv_director_review_transaction_count_after_ia', 'initiative_agreement'
    UNION ALL
    SELECT 'refresh_mv_director_review_transaction_count_after_aa', 'admin_adjustment'
    UNION ALL
    SELECT 'refresh_mv_org_compliance_report_count_after_compliance_report', 'compliance_report'
    UNION ALL
    SELECT 'refresh_mv_compliance_report_count_after_change', 'compliance_report'
    UNION ALL
    SELECT 'refresh_mv_fuel_code_count_after_change', 'fuel_code'
)
SELECT 
    'Trigger' AS item_type,
    et.trigger_name || ' on ' || et.table_name AS name,
    CASE 
        WHEN t.tgname IS NOT NULL THEN 'Exists' 
        ELSE 'Missing' 
    END AS status
FROM 
    expected_triggers et
LEFT JOIN 
    pg_trigger t 
    ON t.tgname = et.trigger_name
    AND t.tgrelid = (
        SELECT c.oid 
        FROM pg_class c
        JOIN pg_namespace n 
            ON c.relnamespace = n.oid
        WHERE 
            c.relname = et.table_name 
            AND n.nspname = 'public' 
            AND c.relkind = 'r'
        LIMIT 1
    )
    AND NOT t.tgisinternal
ORDER BY 
    et.trigger_name;


-- Refresh all materialized views
BEGIN;

REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_aggregate;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_count;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_compliance_report_count;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fuel_code_count;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_director_review_transaction_count;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_org_compliance_report_count;

COMMIT;


-- FIXES
-- Previous to migration updates, these three trigger names were truncated automatically by postgres
-- original names
DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_compliance_report ON compliance_report CASCADE;
DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_initiative_agreement ON initiative_agreement CASCADE;
DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_admin_adjustment ON admin_adjustment CASCADE;
-- auto truncated names
DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_compliance_r ON compliance_report CASCADE;
DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_initiative_a ON initiative_agreement CASCADE;
DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_admin_adjust ON admin_adjustment CASCADE;

-- We needed to update the names in order to avoid truncation
-- These were the names used to avoid truncation
CREATE TRIGGER refresh_mv_director_review_transaction_count_after_cr
AFTER INSERT OR UPDATE OR DELETE ON compliance_report
FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_director_review_transaction_count();

CREATE TRIGGER refresh_mv_director_review_transaction_count_after_ia
AFTER INSERT OR UPDATE OR DELETE ON initiative_agreement
FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_director_review_transaction_count();

CREATE TRIGGER refresh_mv_director_review_transaction_count_after_aa
AFTER INSERT OR UPDATE OR DELETE ON admin_adjustment
FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_director_review_transaction_count();