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
    UNION ALL
    SELECT 'update_organization_balance'
    UNION ALL
    SELECT 'update_count_transfers_in_progress'
    UNION ALL
    SELECT 'audit_trigger_func'
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
    UNION ALL
    SELECT 'update_organization_balance_trigger', 'transaction'
    UNION ALL
    SELECT 'update_count_transfers_in_progress_trigger', 'transfer'
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


-- Audit functions validation
SELECT
    f.function_name,
    f.schema_name,
    CASE
        WHEN p.oid IS NOT NULL THEN 'Exists'
        ELSE 'Does Not Exist'
    END AS existence
FROM
    (VALUES
        ('jsonb_diff', 'public'),
        ('generate_json_delta', 'public')
    ) AS f(function_name, schema_name)
LEFT JOIN
    pg_catalog.pg_proc p ON p.proname = f.function_name
    AND p.pronamespace = (
        SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = f.schema_name
    )
    AND p.proargtypes = ARRAY[
        'jsonb'::regtype,
        'jsonb'::regtype
    ]::oidvector
ORDER BY
    f.function_name;

-- Validation Query: Check Existence of Audit Triggers Considering Truncation

WITH table_list AS (
    SELECT unnest(ARRAY[
        'transaction','compliance_report','compliance_report_history','compliance_report_status',
        'compliance_report_summary','compliance_period','initiative_agreement','initiative_agreement_status',
        'initiative_agreement_history','allocation_agreement','allocation_transaction_type','custom_fuel_type',
        'fuel_code','fuel_code_prefix','fuel_code_status','fuel_category','fuel_instance','fuel_type',
        'fuel_export','organization','organization_address','organization_attorney_address','organization_status',
        'organization_type','transfer','transfer_category','transfer_history','transfer_status','internal_comment',
        'user_profile','user_role','role','notification_message','notification_type','admin_adjustment',
        'admin_adjustment_status','admin_adjustment_history','provision_of_the_act','supplemental_report',
        'final_supply_equipment','notional_transfer','fuel_supply','additional_carbon_intensity','document',
        'end_use_type','energy_density','energy_effectiveness_ratio','transport_mode','final_supply_equipment',
        'level_of_equipment','user_login_history','unit_of_measure','target_carbon_intensity'
    ]) AS tablename
),
trigger_names AS (
    SELECT
        tablename,
        'audit_' || tablename || '_insert_update_delete' AS expected_trigger_name,
        -- Truncate the trigger name to 63 characters if necessary
        CASE
            WHEN length('audit_' || tablename || '_insert_update_delete') > 63
            THEN substring('audit_' || tablename || '_insert_update_delete' from 1 for 63)
            ELSE 'audit_' || tablename || '_insert_update_delete'
        END AS actual_trigger_name
    FROM table_list
)
SELECT
    tn.tablename,
    tn.expected_trigger_name,
    tn.actual_trigger_name,
    CASE
        WHEN t.tgname IS NOT NULL THEN 'Exists'
        ELSE 'Missing'
    END AS trigger_status
FROM trigger_names tn
LEFT JOIN pg_trigger t
    ON t.tgname = tn.actual_trigger_name
    AND t.tgrelid = (
        SELECT oid FROM pg_class WHERE relname = tn.tablename AND relnamespace = 'public'::regnamespace
    )
ORDER BY tn.tablename;


-- Refresh all materialized views
BEGIN;

REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_aggregate;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_count;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_compliance_report_count;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fuel_code_count;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_director_review_transaction_count;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_org_compliance_report_count;

COMMIT;

-- update existing transfer counts
UPDATE organization o
SET count_transfers_in_progress = COALESCE(sub.total_transfer_count, 0)
FROM (
    SELECT
        org.organization_id,
        COUNT(DISTINCT t.transfer_id) AS total_transfer_count
    FROM organization org
    LEFT JOIN transfer t
        ON org.organization_id = t.from_organization_id
        OR org.organization_id = t.to_organization_id
    WHERE t.current_status_id IN (3, 4) -- Sent, Submitted
    GROUP BY org.organization_id
) sub
WHERE o.organization_id = sub.organization_id;





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