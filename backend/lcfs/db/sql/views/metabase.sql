-- ==========================================
-- LCFS Database Views - Dependency-Ordered Execution Script
-- ==========================================
-- Execute views in dependency order to avoid reference errors

-- ==========================================
-- LEVEL 1: Views depending only on base tables
-- ==========================================

-- ==========================================
-- Compliance Reports List View
-- ==========================================
create or replace view v_compliance_report as
WITH latest_versions AS (
    SELECT DISTINCT
        compliance_report_group_uuid,
        FIRST_VALUE(version) OVER (
            PARTITION BY compliance_report_group_uuid 
            ORDER BY version DESC
        ) as max_version,
        FIRST_VALUE(current_status_id) OVER (
            PARTITION BY compliance_report_group_uuid 
            ORDER BY version DESC
        ) as latest_status_id,
        FIRST_VALUE(crs.status) OVER (
            PARTITION BY compliance_report_group_uuid 
            ORDER BY version DESC
        ) as latest_status,
        FIRST_VALUE(supplemental_initiator) OVER (
            PARTITION BY compliance_report_group_uuid 
            ORDER BY version DESC
        ) as latest_supplemental_initiator,
        FIRST_VALUE(cr.create_date) OVER (
            PARTITION BY compliance_report_group_uuid 
            ORDER BY version DESC
        ) as latest_supplemental_create_date
    FROM compliance_report cr
    JOIN compliance_report_status crs ON cr.current_status_id = crs.compliance_report_status_id
),
versioned_reports AS (
    SELECT 
        cr.*,
        crs.status,
        ROW_NUMBER() OVER (
            PARTITION BY cr.compliance_report_group_uuid 
            ORDER BY cr.version DESC
        ) as version_rank,
        lws.latest_supplemental_initiator,
        lws.latest_supplemental_create_date,
        lws.latest_status
    FROM compliance_report cr
    JOIN compliance_report_status crs ON cr.current_status_id = crs.compliance_report_status_id
    JOIN latest_versions lws ON cr.compliance_report_group_uuid = lws.compliance_report_group_uuid
),
selected_reports AS (
    SELECT *
    FROM versioned_reports vr
    WHERE version_rank = 1  -- Always include latest
       OR (version_rank = 2   -- Include second-latest when LATEST has these conditions
           AND (vr.latest_status IN ('Draft','Analyst_adjustment') 
                OR vr.latest_supplemental_initiator = 'GOVERNMENT_REASSESSMENT'))
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
    sr.current_status_id AS report_status_id,
    case when sr.latest_status = 'Draft'
	      and sr.version_rank = 2 -- not the latest report
	      and sr.latest_supplemental_initiator = 'GOVERNMENT_INITIATED'::supplementalinitiatortype 
	      	then 'Supplemental_requested'::compliancereportstatusenum 
	     else sr.status 
	  end as report_status,
    sr.update_date,
    sr.supplemental_initiator,
    sr.reporting_frequency,
    sr.legacy_id,
    sr.transaction_id,
    sr.assessment_statement,
    (sr.version_rank = 1) as is_latest,
    sr.latest_supplemental_initiator as latest_report_supplemental_initiator,
    sr.latest_supplemental_create_date,
    sr.latest_status,
    sr.assigned_analyst_id,
    up.first_name AS assigned_analyst_first_name,
    up.last_name AS assigned_analyst_last_name
FROM selected_reports sr
JOIN compliance_period cp ON sr.compliance_period_id = cp.compliance_period_id
JOIN organization o ON sr.organization_id = o.organization_id
LEFT JOIN user_profile up ON sr.assigned_analyst_id = up.user_profile_id
ORDER BY sr.compliance_report_group_uuid, sr.version DESC;

-- ==========================================
-- Transfer base Analytics View
-- ==========================================
DROP VIEW IF EXISTS vw_transfer_base;
CREATE OR REPLACE VIEW vw_transfer_base AS
SELECT
    transfer.transfer_id,
    transfer_status.status,
    coalesce(transfer.transaction_effective_date, transfer_history.update_date) calculated_effective_date,
    from_organization.name AS from_organization,
    to_organization.name AS to_organization,
    price_per_unit,
    quantity,
    price_per_unit * quantity::float AS transfer_value,
    transfer_category.category::text AS transfer_category
FROM
    transfer
    INNER JOIN transfer_status ON transfer.current_status_id = transfer_status.transfer_status_id
    LEFT JOIN organization from_organization ON transfer.from_organization_id = from_organization.organization_id
    LEFT JOIN organization to_organization ON transfer.to_organization_id = to_organization.organization_id
    LEFT JOIN TRANSACTION ON transaction.transaction_id = transfer.from_transaction_id
    LEFT JOIN TRANSACTION t2 ON t2.transaction_id = transfer.to_transaction_id
    LEFT JOIN transfer_history ON transfer_history.transfer_id = transfer.transfer_id
        AND transfer_history.transfer_status_id = 6
    LEFT JOIN transfer_category ON transfer.transfer_category_id = transfer_category.transfer_category_id
WHERE
    price_per_unit != 0
    AND status = 'Recorded';

GRANT SELECT ON vw_transfer_base TO basic_lcfs_reporting_role;
-- ==========================================
-- User Login Analytics Base View
-- ==========================================
DROP VIEW IF EXISTS vw_user_login_analytics_base cascade;
CREATE OR REPLACE VIEW vw_user_login_analytics_base AS
SELECT
    -- User identification
    keycloak_email,
    keycloak_user_id,
    -- Login success/failure
    is_login_successful,
    login_error_message,
    -- Time dimensions
    create_date,
    CAST(create_date AS date) AS login_date,
    DATE_TRUNC('week', CAST(create_date AS date)) AS login_week,
    DATE_TRUNC('month', CAST(create_date AS date)) AS login_month,
    DATE_TRUNC('year', CAST(create_date AS date)) AS login_year,
    EXTRACT(YEAR FROM create_date) AS year_number,
    EXTRACT(MONTH FROM create_date) AS month_number,
    EXTRACT(DOW FROM create_date) AS day_of_week,
    -- User type identification
    CASE WHEN LOWER(keycloak_user_id)
    LIKE '%bceid%' THEN
        'BCeID'
    WHEN LOWER(keycloak_user_id)
    LIKE '%idir%' THEN
        'IDIR'
    ELSE
        'Other'
    END AS user_type,
    -- Boolean flags for easier filtering
    LOWER(keycloak_user_id)
    LIKE '%bceid%' AS is_bceid_user,
    LOWER(keycloak_user_id)
    LIKE '%idir%' AS is_idir_user
FROM
    user_login_history;

GRANT SELECT ON vw_user_login_analytics_base TO basic_lcfs_reporting_role;
-- ==========================================
-- Transaction Base View
-- ==========================================
DROP VIEW IF EXISTS vw_transaction_base;
CREATE OR REPLACE VIEW vw_transaction_base AS
SELECT *
FROM transaction
WHERE transaction_action != 'Released';

GRANT SELECT ON vw_transaction_base TO basic_lcfs_reporting_role;

-- ==========================================
-- Fuel Code Base View
-- ==========================================
DROP VIEW IF EXISTS vw_fuel_code_base cascade;
CREATE OR REPLACE VIEW vw_fuel_code_base AS
SELECT
    fc.fuel_code_id,
    fcp.fuel_code_prefix_id,
    fcp.prefix,
    fc.fuel_suffix,
    fcs.fuel_code_status_id,
    fcs.status,
    ft.fuel_type_id,
    ft.fuel_type,
    fc.company,
    fc.contact_name,
    fc.contact_email,
    fc.carbon_intensity,
    fc.edrms,
    fc.last_updated,
    fc.application_date,
    fc.approval_date,
    fc.create_date,
    fc.effective_date,
    fc.expiration_date,
    fc.effective_status,
    fc.feedstock,
    fc.feedstock_location,
    fc.feedstock_misc,
    fc.fuel_production_facility_city,
    fc.fuel_production_facility_province_state,
    fc.fuel_production_facility_country,
    fc.facility_nameplate_capacity,
    fc.facility_nameplate_capacity_unit,
    fc.former_company,
    finished_modes.transport_modes AS finished_fuel_transport_modes,
    feedstock_modes.transport_modes AS feedstock_fuel_transport_modes,
    fc.notes
FROM fuel_code fc
JOIN fuel_code_prefix fcp ON fc.prefix_id = fcp.fuel_code_prefix_id
JOIN fuel_code_status fcs ON fc.fuel_status_id = fcs.fuel_code_status_id
JOIN fuel_type ft ON fc.fuel_type_id = ft.fuel_type_id
LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(tm.transport_mode ORDER BY tm.transport_mode) AS transport_modes
    FROM finished_fuel_transport_mode fftm
    JOIN transport_mode tm ON fftm.transport_mode_id = tm.transport_mode_id
    WHERE fftm.fuel_code_id = fc.fuel_code_id
) finished_modes ON TRUE
LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(tm.transport_mode ORDER BY tm.transport_mode) AS transport_modes
    FROM feedstock_fuel_transport_mode fftm
    JOIN transport_mode tm ON fftm.transport_mode_id = tm.transport_mode_id
    WHERE fftm.fuel_code_id = fc.fuel_code_id
) feedstock_modes ON TRUE
WHERE fcs.status != 'Deleted';
GRANT SELECT ON vw_fuel_code_base TO basic_lcfs_reporting_role;
-- ==========================================
-- Compliance Reports Time Per Status
-- ==========================================
DROP VIEW IF EXISTS vw_compliance_reports_time_per_status;
CREATE OR REPLACE VIEW vw_compliance_reports_time_per_status AS
WITH time_diff AS (
    SELECT
        cr.compliance_report_id,
        cr.compliance_period_id,
        cr.organization_id,
        crh.status_id,
        LEAD(crh.status_id) OVER (PARTITION BY crh.compliance_report_id ORDER BY crh.create_date) AS next_status_id,
        crh.create_date,
        LEAD(crh.create_date) OVER (PARTITION BY crh.compliance_report_id ORDER BY crh.create_date) AS next_timestamp
    FROM
        compliance_report_history crh
        JOIN compliance_report cr ON crh.compliance_report_id = cr.compliance_report_id
)
SELECT
    compliance_report_id,
    compliance_period_id,
    organization_id,
    -- Duration: Draft → Submitted
    MAX(
        CASE WHEN status_id = 1
            AND next_status_id = 2 THEN
            ROUND((date_part('epoch', next_timestamp - create_date) / 86400)::numeric, 2)
        END) AS "Draft_to_Submitted",
    -- Duration: Submitted → Recommended to Manager
    MAX(
        CASE WHEN status_id = 2
            AND next_status_id = 3 THEN
            ROUND((date_part('epoch', next_timestamp - create_date) / 86400)::numeric, 2)
        WHEN status_id = 2
            AND next_status_id IS NULL THEN
            ROUND((date_part('epoch', NOW() - create_date) / 86400)::numeric, 2)
        END) AS "Submitted_to_Recommended_Manager",
    -- Duration: Recommended to Manager → Director
    MAX(
        CASE WHEN status_id = 3
            AND next_status_id = 4 THEN
            ROUND((date_part('epoch', next_timestamp - create_date) / 86400)::numeric, 2)
        WHEN status_id = 3
            AND next_status_id IS NULL THEN
            ROUND((date_part('epoch', NOW() - create_date) / 86400)::numeric, 2)
        END) AS "Recommended_Manager_to_Director",
    -- Duration: Recommended to Director → Approved
    MAX(
        CASE WHEN status_id = 4
            AND next_status_id = 5 THEN
            ROUND((date_part('epoch', next_timestamp - create_date) / 86400)::numeric, 2)
        WHEN status_id = 4
            AND next_status_id IS NULL THEN
            ROUND((date_part('epoch', NOW() - create_date) / 86400)::numeric, 2)
        END) AS "Recommended_Director_to_Approved"
FROM
    time_diff
GROUP BY
    compliance_report_id,
    compliance_period_id,
    organization_id
ORDER BY
    compliance_report_id;

GRANT SELECT ON vw_compliance_reports_time_per_status TO basic_lcfs_reporting_role;
-- ==========================================
-- Notional Transfer Base View
-- ==========================================
DROP VIEW IF EXISTS vw_notional_transfer_base CASCADE;
CREATE OR REPLACE VIEW vw_notional_transfer_base AS
WITH latest_notional_transfers AS (
    SELECT 
        nt.notional_transfer_id,
        nt.compliance_report_id,
        nt.legal_name,
        nt.address_for_service,
        nt.fuel_category_id,
        nt.received_or_transferred,
        -- Handle quarterly vs annual reporting - use quarterly quantities if available, otherwise annual
        CASE 
            WHEN nt.q1_quantity IS NOT NULL OR nt.q2_quantity IS NOT NULL OR 
                 nt.q3_quantity IS NOT NULL OR nt.q4_quantity IS NOT NULL THEN
                COALESCE(nt.q1_quantity, 0) + COALESCE(nt.q2_quantity, 0) + 
                COALESCE(nt.q3_quantity, 0) + COALESCE(nt.q4_quantity, 0)
            ELSE nt.quantity
        END as total_quantity,
        nt.quantity as annual_quantity,
        nt.q1_quantity,
        nt.q2_quantity,
        nt.q3_quantity,
        nt.q4_quantity,
        nt.create_date,
        nt.update_date,
        nt.create_user,
        nt.update_user,
        ROW_NUMBER() OVER (
            PARTITION BY cr.compliance_report_group_uuid, nt.legal_name, nt.fuel_category_id, nt.received_or_transferred
            ORDER BY cr.version DESC
        ) as rn
    FROM notional_transfer nt
    JOIN compliance_report cr ON nt.compliance_report_id = cr.compliance_report_id
    JOIN compliance_report_status crs ON cr.current_status_id = crs.compliance_report_status_id
    WHERE crs.status != 'Draft'::compliancereportstatusenum
)
SELECT 
    lnt.notional_transfer_id,
    lnt.compliance_report_id,
    lnt.legal_name as "Legal Name of Trading Partner",
    lnt.address_for_service as "Address for Service",
    fc.category as "Fuel Category",
    lnt.received_or_transferred::text as "Received or Transferred",
    lnt.total_quantity as "Quantity",
    lnt.annual_quantity,
    lnt.q1_quantity as "Q1 Quantity",
    lnt.q2_quantity as "Q2 Quantity", 
    lnt.q3_quantity as "Q3 Quantity",
    lnt.q4_quantity as "Q4 Quantity",
    cp.description as "Compliance Period",
    org.name as "Organization Name",
    crs.status::text as "Report Status",
    cr.version as "Report Version",
    lnt.create_date,
    lnt.update_date,
    lnt.create_user,
    lnt.update_user,
    cr.compliance_period_id,
    cr.organization_id,
    cr.current_status_id
FROM latest_notional_transfers lnt
JOIN compliance_report cr ON lnt.compliance_report_id = cr.compliance_report_id
JOIN fuel_category fc ON lnt.fuel_category_id = fc.fuel_category_id
JOIN compliance_period cp ON cr.compliance_period_id = cp.compliance_period_id
JOIN organization org ON cr.organization_id = org.organization_id
JOIN compliance_report_status crs ON cr.current_status_id = crs.compliance_report_status_id
WHERE lnt.rn = 1  -- Only get the latest version for each unique combination
ORDER BY cp.description DESC, org.name, lnt.legal_name, fc.category;

GRANT SELECT ON vw_notional_transfer_base TO basic_lcfs_reporting_role;
-- ==========================================
-- Fuels for Other Use Data Model
-- ==========================================
DROP VIEW IF EXISTS vw_fuels_other_use_base CASCADE;
CREATE OR REPLACE VIEW vw_fuels_other_use_base AS
WITH latest_other_uses AS (
    SELECT
        ou.group_uuid,
        MAX(ou.version) AS max_version
    FROM other_uses ou
    GROUP BY ou.group_uuid
),
selected_other_uses AS (
    SELECT ou.*
    FROM other_uses ou
    JOIN latest_other_uses lou ON ou.group_uuid = lou.group_uuid 
        AND ou.version = lou.max_version
    WHERE ou.action_type != 'DELETE'
)
SELECT 
    sou.other_uses_id,
    sou.compliance_report_id,
    ft.fuel_type,
    fc.category,
    sou.ci_of_fuel,
    COALESCE(concat(fcp.prefix, fcode.fuel_suffix), 'N/A') as fuel_code,
    sou.quantity_supplied,
    sou.units,
    eut.name as expected_use,
    COALESCE(sou.rationale, 'N/A') as rationale,
    cp.description as compliance_period,
    org.name as organization_name,
    crs.status::text,
    cr.version,
    pota.description as provision_of_the_act,
    sou.create_date,
    sou.update_date,
    sou.create_user,
    sou.update_user,
    cr.compliance_period_id,
    cr.organization_id,
    cr.current_status_id
FROM selected_other_uses sou
JOIN compliance_report cr ON sou.compliance_report_id = cr.compliance_report_id
JOIN fuel_type ft ON sou.fuel_type_id = ft.fuel_type_id
JOIN fuel_category fc ON sou.fuel_category_id = fc.fuel_category_id
JOIN expected_use_type eut ON sou.expected_use_id = eut.expected_use_type_id
JOIN provision_of_the_act pota ON sou.provision_of_the_act_id = pota.provision_of_the_act_id
LEFT JOIN fuel_code fcode ON sou.fuel_code_id = fcode.fuel_code_id
LEFT JOIN fuel_code_prefix fcp ON fcode.prefix_id = fcp.fuel_code_prefix_id
JOIN compliance_period cp ON cr.compliance_period_id = cp.compliance_period_id
JOIN organization org ON cr.organization_id = org.organization_id
JOIN compliance_report_status crs ON cr.current_status_id = crs.compliance_report_status_id
WHERE crs.status != 'Draft'::compliancereportstatusenum
ORDER BY cp.description DESC, org.name, ft.fuel_type, fc.category;

GRANT SELECT ON vw_fuels_other_use_base TO basic_lcfs_reporting_role;

-- ==========================================
-- LEVEL 2: Views depending on Level 1 views
-- ==========================================

-- ==========================================
-- Compliance Reports Analytics View
-- ==========================================
DROP VIEW IF EXISTS vw_compliance_report_analytics_base cascade;
CREATE OR REPLACE VIEW vw_compliance_report_analytics_base AS
SELECT compliance_report_id,
    compliance_report_group_uuid,
    version,
    compliance_period_id,
    compliance_period,
    organization_id,
    organization_name,
    report_type,
    report_status_id,
    report_status,
    update_date,
    supplemental_initiator,
    rn
   FROM ( SELECT vcr.compliance_report_id,
            vcr.compliance_report_group_uuid,
            vcr.version,
            vcr.compliance_period_id,
            vcr.compliance_period,
            vcr.organization_id,
            vcr.organization_name,
            vcr.report_type,
            vcr.report_status_id,
            vcr.report_status,
            vcr.update_date,
            vcr.supplemental_initiator,
            row_number() OVER (PARTITION BY vcr.compliance_period, vcr.compliance_report_group_uuid, vcr.organization_id ORDER BY vcr.version DESC) AS rn
           FROM v_compliance_report vcr
             JOIN compliance_report_status crs ON crs.compliance_report_status_id = vcr.report_status_id AND (crs.status <> ALL (ARRAY['Draft'::compliancereportstatusenum, 'Analyst_adjustment'::compliancereportstatusenum]))) ranked_reports
  WHERE rn = 1;

GRANT SELECT ON vw_compliance_report_analytics_base TO basic_lcfs_reporting_role;
-- ==========================================
-- BCeID Daily Login Summary View
-- ==========================================
DROP VIEW IF EXISTS vw_bceid_daily_login_summary;
CREATE OR REPLACE VIEW vw_bceid_daily_login_summary AS
SELECT
    login_date,
    -- Success metrics
    COUNT(
        CASE WHEN is_login_successful = TRUE THEN
            1
        END) AS successful_logins,
    COUNT(DISTINCT CASE WHEN is_login_successful = TRUE THEN
            keycloak_email
        END) AS unique_successful_users,
    -- Failure metrics
    COUNT(
        CASE WHEN is_login_successful = FALSE THEN
            1
        END) AS failed_logins,
    COUNT(DISTINCT CASE WHEN is_login_successful = FALSE THEN
            keycloak_email
        END) AS unique_failed_users,
    -- Total metrics
    COUNT(*) AS total_login_attempts,
    COUNT(DISTINCT keycloak_email) AS total_unique_users,
    -- Success rate
    ROUND((COUNT(
            CASE WHEN is_login_successful = TRUE THEN
                1
            END)::float / NULLIF(COUNT(*), 0) * 100)::numeric, 2) AS success_rate_percent
FROM
    vw_user_login_analytics_base
WHERE
    is_bceid_user = TRUE
GROUP BY
    login_date;

GRANT SELECT ON vw_bceid_daily_login_summary TO basic_lcfs_reporting_role;
-- ==========================================
-- BCeID User Statistics View
-- ==========================================
DROP VIEW IF EXISTS vw_bceid_user_statistics;
CREATE OR REPLACE VIEW vw_bceid_user_statistics AS
WITH user_daily_stats AS (
    SELECT
        keycloak_email,
        login_date,
        COUNT(*) AS daily_login_count,
        COUNT(
            CASE WHEN is_login_successful = TRUE THEN
                1
            END) AS daily_successful_logins,
        COUNT(
            CASE WHEN is_login_successful = FALSE THEN
                1
            END) AS daily_failed_logins
    FROM
        vw_user_login_analytics_base
    WHERE
        is_bceid_user = TRUE
    GROUP BY
        keycloak_email,
        login_date
)
SELECT
    keycloak_email,
    -- Login frequency metrics
    ROUND(AVG(daily_login_count)::numeric, 2) AS avg_logins_per_day,
    COUNT(DISTINCT login_date) AS total_login_days,
    SUM(daily_login_count) AS total_logins,
    -- Success/failure breakdown
    SUM(daily_successful_logins) AS total_successful_logins,
    SUM(daily_failed_logins) AS total_failed_logins,
    -- Date range
    MIN(login_date) AS first_login_date,
    MAX(login_date) AS last_login_date,
    MAX(login_date) - MIN(login_date) + 1 AS days_since_first_login,
    -- Engagement metrics
    ROUND((COUNT(DISTINCT login_date)::float / NULLIF(MAX(login_date) - MIN(login_date) + 1, 0) * 100)::numeric, 2) AS login_frequency_percent,
    -- Success rate
    ROUND((SUM(daily_successful_logins)::float / NULLIF(SUM(daily_login_count), 0) * 100)::numeric, 2) AS user_success_rate_percent
FROM
    user_daily_stats
GROUP BY
    keycloak_email;

GRANT SELECT ON vw_bceid_user_statistics TO basic_lcfs_reporting_role;
-- ==========================================
-- Login Failures Analysis View
-- ==========================================
DROP VIEW IF EXISTS vw_login_failures_analysis;
CREATE OR REPLACE VIEW vw_login_failures_analysis AS
SELECT
    year_number,
    login_error_message,
    user_type,
    -- Failure counts
    COUNT(*) AS total_failures,
    COUNT(DISTINCT keycloak_email) AS unique_users_with_failures,
    COUNT(DISTINCT login_date) AS days_with_failures,
    -- Monthly breakdown
    ROUND(AVG(monthly_failures), 2) AS avg_failures_per_month,
    MAX(monthly_failures) AS max_failures_in_month,
    MIN(monthly_failures) AS min_failures_in_month
FROM (
    SELECT
        *,
        COUNT(*) OVER (PARTITION BY year_number, login_month, login_error_message, user_type) AS monthly_failures
    FROM
        vw_user_login_analytics_base
    WHERE
        is_login_successful = FALSE
        AND login_error_message IS NOT NULL) monthly_data
GROUP BY
    year_number,
    login_error_message,
    user_type;

GRANT SELECT ON vw_login_failures_analysis TO basic_lcfs_reporting_role;
-- ==========================================
-- Compliance Report Base View With Early Issuance By Year
-- ==========================================
DROP VIEW IF EXISTS vw_compliance_report_base cascade;
CREATE OR REPLACE VIEW vw_compliance_report_base AS
SELECT
      "compliance_report"."compliance_report_id" AS "compliance_report_id",
      "compliance_report"."compliance_period_id" AS "compliance_period_id",
      "compliance_report"."organization_id" AS "organization_id",
      "compliance_report"."current_status_id" AS "current_status_id",
      "compliance_report"."transaction_id" AS "transaction_id",
      "compliance_report"."compliance_report_group_uuid" AS "compliance_report_group_uuid",
      "compliance_report"."legacy_id" AS "legacy_id",
      "compliance_report"."version" AS "version",
      "compliance_report"."supplemental_initiator" AS "supplemental_initiator",
      "compliance_report"."reporting_frequency" AS "reporting_frequency",
      "compliance_report"."nickname" AS "nickname",
      "compliance_report"."supplemental_note" AS "supplemental_note",
      "compliance_report"."create_date" AS "create_date",
      "compliance_report"."update_date" AS "update_date",
      "compliance_report"."create_user" AS "create_user",
      "compliance_report"."update_user" AS "update_user",
      "compliance_report"."assessment_statement" AS "assessment_statement",
      CASE
        WHEN "Compliance Report Summary - Compliance Report"."line_11_fossil_derived_base_fuel_total" > 0 THEN 'Not Met'
        ELSE 'Met'
      END AS "Renewable Requirements",
      CASE
        WHEN "Compliance Report Summary - Compliance Report"."line_21_non_compliance_penalty_payable" > 0 THEN 'Not Met'
        ELSE 'Met'
      END AS "Low Carbon Requirements",
      "Compliance Period"."compliance_period_id" AS "Compliance Period__compliance_period_id",
      "Compliance Period"."description" AS "Compliance Period__description",
      "Compliance Period"."display_order" AS "Compliance Period__display_order",
      "Compliance Period"."create_date" AS "Compliance Period__create_date",
      "Compliance Period"."update_date" AS "Compliance Period__update_date",
      "Compliance Period"."effective_date" AS "Compliance Period__effective_date",
      "Compliance Period"."effective_status" AS "Compliance Period__effective_status",
      "Compliance Period"."expiration_date" AS "Compliance Period__expiration_date",
      "Compliance Report Status - Current Status"."compliance_report_status_id" AS "Compliance Report Status - Current Status__complian_8aca39b7",
      "Compliance Report Status - Current Status"."display_order" AS "Compliance Report Status - Current Status__display_order",
      "Compliance Report Status - Current Status"."status" AS "Compliance Report Status - Current Status__status",
      "Compliance Report Status - Current Status"."create_date" AS "Compliance Report Status - Current Status__create_date",
      "Compliance Report Status - Current Status"."update_date" AS "Compliance Report Status - Current Status__update_date",
      "Compliance Report Status - Current Status"."effective_date" AS "Compliance Report Status - Current Status__effective_date",
      "Compliance Report Status - Current Status"."effective_status" AS "Compliance Report Status - Current Status__effective_status",
      "Compliance Report Status - Current Status"."expiration_date" AS "Compliance Report Status - Current Status__expiration_date",
      "Compliance Report Summary - Compliance Report"."summary_id" AS "Compliance Report Summary - Compliance Report__summary_id",
      "Compliance Report Summary - Compliance Report"."compliance_report_id" AS "Compliance Report Summary - Compliance Report__comp_1db2e1e9",
      "Compliance Report Summary - Compliance Report"."quarter" AS "Compliance Report Summary - Compliance Report__quarter",
      "Compliance Report Summary - Compliance Report"."is_locked" AS "Compliance Report Summary - Compliance Report__is_locked",
      "Compliance Report Summary - Compliance Report"."line_1_fossil_derived_base_fuel_gasoline" AS "Compliance Report Summary - Compliance Report__line_2c0818fb",
      "Compliance Report Summary - Compliance Report"."line_1_fossil_derived_base_fuel_diesel" AS "Compliance Report Summary - Compliance Report__line_2ff66c5b",
      "Compliance Report Summary - Compliance Report"."line_1_fossil_derived_base_fuel_jet_fuel" AS "Compliance Report Summary - Compliance Report__line_1fcf7a18",
      "Compliance Report Summary - Compliance Report"."line_2_eligible_renewable_fuel_supplied_gasoline" AS "Compliance Report Summary - Compliance Report__line_d70f8aef",
      "Compliance Report Summary - Compliance Report"."line_2_eligible_renewable_fuel_supplied_diesel" AS "Compliance Report Summary - Compliance Report__line_2773c83c",
      "Compliance Report Summary - Compliance Report"."line_2_eligible_renewable_fuel_supplied_jet_fuel" AS "Compliance Report Summary - Compliance Report__line_e4c8e80c",
      "Compliance Report Summary - Compliance Report"."line_3_total_tracked_fuel_supplied_gasoline" AS "Compliance Report Summary - Compliance Report__line_9cec896d",
      "Compliance Report Summary - Compliance Report"."line_3_total_tracked_fuel_supplied_diesel" AS "Compliance Report Summary - Compliance Report__line_489bea32",
      "Compliance Report Summary - Compliance Report"."line_3_total_tracked_fuel_supplied_jet_fuel" AS "Compliance Report Summary - Compliance Report__line_af2beb8e",
      "Compliance Report Summary - Compliance Report"."line_4_eligible_renewable_fuel_required_gasoline" AS "Compliance Report Summary - Compliance Report__line_a26a000d",
      "Compliance Report Summary - Compliance Report"."line_4_eligible_renewable_fuel_required_diesel" AS "Compliance Report Summary - Compliance Report__line_0ef43e75",
      "Compliance Report Summary - Compliance Report"."line_4_eligible_renewable_fuel_required_jet_fuel" AS "Compliance Report Summary - Compliance Report__line_91ad62ee",
      "Compliance Report Summary - Compliance Report"."line_5_net_notionally_transferred_gasoline" AS "Compliance Report Summary - Compliance Report__line_b1027537",
      "Compliance Report Summary - Compliance Report"."line_5_net_notionally_transferred_diesel" AS "Compliance Report Summary - Compliance Report__line_38be33f3",
      "Compliance Report Summary - Compliance Report"."line_5_net_notionally_transferred_jet_fuel" AS "Compliance Report Summary - Compliance Report__line_82c517d4",
      "Compliance Report Summary - Compliance Report"."line_6_renewable_fuel_retained_gasoline" AS "Compliance Report Summary - Compliance Report__line_6927f733",
      "Compliance Report Summary - Compliance Report"."line_6_renewable_fuel_retained_diesel" AS "Compliance Report Summary - Compliance Report__line_93d805cb",
      "Compliance Report Summary - Compliance Report"."line_6_renewable_fuel_retained_jet_fuel" AS "Compliance Report Summary - Compliance Report__line_5ae095d0",
      "Compliance Report Summary - Compliance Report"."line_7_previously_retained_gasoline" AS "Compliance Report Summary - Compliance Report__line_157d6973",
      "Compliance Report Summary - Compliance Report"."line_7_previously_retained_diesel" AS "Compliance Report Summary - Compliance Report__line_31fd1f1b",
      "Compliance Report Summary - Compliance Report"."line_7_previously_retained_jet_fuel" AS "Compliance Report Summary - Compliance Report__line_26ba0b90",
      "Compliance Report Summary - Compliance Report"."line_8_obligation_deferred_gasoline" AS "Compliance Report Summary - Compliance Report__line_27419684",
      "Compliance Report Summary - Compliance Report"."line_8_obligation_deferred_diesel" AS "Compliance Report Summary - Compliance Report__line_ac263897",
      "Compliance Report Summary - Compliance Report"."line_8_obligation_deferred_jet_fuel" AS "Compliance Report Summary - Compliance Report__line_1486f467",
      "Compliance Report Summary - Compliance Report"."line_9_obligation_added_gasoline" AS "Compliance Report Summary - Compliance Report__line_c12cb8c0",
      "Compliance Report Summary - Compliance Report"."line_9_obligation_added_diesel" AS "Compliance Report Summary - Compliance Report__line_05eb459f",
      "Compliance Report Summary - Compliance Report"."line_9_obligation_added_jet_fuel" AS "Compliance Report Summary - Compliance Report__line_f2ebda23",
      "Compliance Report Summary - Compliance Report"."line_10_net_renewable_fuel_supplied_gasoline" AS "Compliance Report Summary - Compliance Report__line_1be763e7",
      "Compliance Report Summary - Compliance Report"."line_10_net_renewable_fuel_supplied_diesel" AS "Compliance Report Summary - Compliance Report__line_b72177b0",
      "Compliance Report Summary - Compliance Report"."line_10_net_renewable_fuel_supplied_jet_fuel" AS "Compliance Report Summary - Compliance Report__line_28200104",
      "Compliance Report Summary - Compliance Report"."line_11_non_compliance_penalty_gasoline" AS "Compliance Report Summary - Compliance Report__line_53735f1d",
      "Compliance Report Summary - Compliance Report"."line_11_non_compliance_penalty_diesel" AS "Compliance Report Summary - Compliance Report__line_64a07c80",
      "Compliance Report Summary - Compliance Report"."line_11_non_compliance_penalty_jet_fuel" AS "Compliance Report Summary - Compliance Report__line_60b43dfe",
      "Compliance Report Summary - Compliance Report"."line_12_low_carbon_fuel_required" AS "Compliance Report Summary - Compliance Report__line_da2710ad",
      "Compliance Report Summary - Compliance Report"."line_13_low_carbon_fuel_supplied" AS "Compliance Report Summary - Compliance Report__line_b25fca1c",
      "Compliance Report Summary - Compliance Report"."line_14_low_carbon_fuel_surplus" AS "Compliance Report Summary - Compliance Report__line_4b98033f",
      "Compliance Report Summary - Compliance Report"."line_15_banked_units_used" AS "Compliance Report Summary - Compliance Report__line_1d7d6a31",
      "Compliance Report Summary - Compliance Report"."line_16_banked_units_remaining" AS "Compliance Report Summary - Compliance Report__line_684112bb",
      "Compliance Report Summary - Compliance Report"."line_17_non_banked_units_used" AS "Compliance Report Summary - Compliance Report__line_b1d3ad5e",
      "Compliance Report Summary - Compliance Report"."line_18_units_to_be_banked" AS "Compliance Report Summary - Compliance Report__line_e173956e",
      "Compliance Report Summary - Compliance Report"."line_19_units_to_be_exported" AS "Compliance Report Summary - Compliance Report__line_9a885574",
      "Compliance Report Summary - Compliance Report"."line_20_surplus_deficit_units" AS "Compliance Report Summary - Compliance Report__line_8e71546f",
      "Compliance Report Summary - Compliance Report"."line_21_surplus_deficit_ratio" AS "Compliance Report Summary - Compliance Report__line_00d2728d",
      "Compliance Report Summary - Compliance Report"."line_22_compliance_units_issued" AS "Compliance Report Summary - Compliance Report__line_29d9cb9c",
      "Compliance Report Summary - Compliance Report"."line_11_fossil_derived_base_fuel_gasoline" AS "Compliance Report Summary - Compliance Report__line_d8942234",
      "Compliance Report Summary - Compliance Report"."line_11_fossil_derived_base_fuel_diesel" AS "Compliance Report Summary - Compliance Report__line_125e31fc",
      "Compliance Report Summary - Compliance Report"."line_11_fossil_derived_base_fuel_jet_fuel" AS "Compliance Report Summary - Compliance Report__line_eb5340d7",
      "Compliance Report Summary - Compliance Report"."line_11_fossil_derived_base_fuel_total" AS "Compliance Report Summary - Compliance Report__line_bff5157d",
      "Compliance Report Summary - Compliance Report"."line_21_non_compliance_penalty_payable" AS "Compliance Report Summary - Compliance Report__line_7c9c21b1",
      "Compliance Report Summary - Compliance Report"."total_non_compliance_penalty_payable" AS "Compliance Report Summary - Compliance Report__tota_0e1e6fb3",
      "Compliance Report Summary - Compliance Report"."create_date" AS "Compliance Report Summary - Compliance Report__create_date",
      "Compliance Report Summary - Compliance Report"."update_date" AS "Compliance Report Summary - Compliance Report__update_date",
      "Compliance Report Summary - Compliance Report"."create_user" AS "Compliance Report Summary - Compliance Report__create_user",
      "Compliance Report Summary - Compliance Report"."update_user" AS "Compliance Report Summary - Compliance Report__update_user",
      "Compliance Report Summary - Compliance Report"."early_issuance_credits_q1" AS "Compliance Report Summary - Compliance Report__earl_6d4994a4",
      "Compliance Report Summary - Compliance Report"."early_issuance_credits_q2" AS "Compliance Report Summary - Compliance Report__earl_f440c51e",
      "Compliance Report Summary - Compliance Report"."early_issuance_credits_q3" AS "Compliance Report Summary - Compliance Report__earl_8347f588",
      "Compliance Report Summary - Compliance Report"."early_issuance_credits_q4" AS "Compliance Report Summary - Compliance Report__earl_1d23602b",
      "Transaction"."transaction_id" AS "Transaction__transaction_id",
      "Transaction"."compliance_units" AS "Transaction__compliance_units",
      "Transaction"."organization_id" AS "Transaction__organization_id",
      "Transaction"."transaction_action" AS "Transaction__transaction_action",
      "Transaction"."create_date" AS "Transaction__create_date",
      "Transaction"."update_date" AS "Transaction__update_date",
      "Transaction"."create_user" AS "Transaction__create_user",
      "Transaction"."update_user" AS "Transaction__update_user",
      "Transaction"."effective_date" AS "Transaction__effective_date",
      "Transaction"."effective_status" AS "Transaction__effective_status",
      "Transaction"."expiration_date" AS "Transaction__expiration_date",
      "Organization"."organization_id" AS "Organization__organization_id",
      "Organization"."organization_code" AS "Organization__organization_code",
      "Organization"."name" AS "Organization__name",
      "Organization"."operating_name" AS "Organization__operating_name",
      "Organization"."email" AS "Organization__email",
      "Organization"."phone" AS "Organization__phone",
      "Organization"."edrms_record" AS "Organization__edrms_record",
      "Organization"."total_balance" AS "Organization__total_balance",
      "Organization"."reserved_balance" AS "Organization__reserved_balance",
      "Organization"."count_transfers_in_progress" AS "Organization__count_transfers_in_progress",
      "Organization"."organization_status_id" AS "Organization__organization_status_id",
      "Organization"."organization_type_id" AS "Organization__organization_type_id",
      "Organization"."organization_address_id" AS "Organization__organization_address_id",
      "Organization"."organization_attorney_address_id" AS "Organization__organization_attorney_address_id",
      "Organization"."create_date" AS "Organization__create_date",
      "Organization"."update_date" AS "Organization__update_date",
      "Organization"."create_user" AS "Organization__create_user",
      "Organization"."update_user" AS "Organization__update_user",
      "Organization"."effective_date" AS "Organization__effective_date",
      "Organization"."effective_status" AS "Organization__effective_status",
      "Organization"."expiration_date" AS "Organization__expiration_date",
      COALESCE("Organization Early Issuance"."has_early_issuance", false) AS "Organization__has_early_issuance",
      "Organization"."records_address" AS "Organization__records_address",
      "Compliance Reports Chained - Compliance Report Group UUID"."group_uuid" AS "Compliance Reports Chained - Compliance Report Grou_1a77e4cb",
      "Compliance Reports Chained - Compliance Report Group UUID"."max_version" AS "Compliance Reports Chained - Compliance Report Grou_480bb7b1"
    FROM
      "compliance_report"
      INNER JOIN "compliance_period" AS "Compliance Period" ON "compliance_report"."compliance_period_id" = "Compliance Period"."compliance_period_id"
      INNER JOIN "compliance_report_status" AS "Compliance Report Status - Current Status" ON "compliance_report"."current_status_id" = "Compliance Report Status - Current Status"."compliance_report_status_id"
      INNER JOIN "compliance_report_summary" AS "Compliance Report Summary - Compliance Report" ON "compliance_report"."compliance_report_id" = "Compliance Report Summary - Compliance Report"."compliance_report_id"
     
LEFT JOIN "transaction" AS "Transaction" ON "compliance_report"."transaction_id" = "Transaction"."transaction_id"
      LEFT JOIN "organization" AS "Organization" ON "compliance_report"."organization_id" = "Organization"."organization_id"
      LEFT JOIN "organization_early_issuance_by_year" AS "Organization Early Issuance" ON "compliance_report"."organization_id" = "Organization Early Issuance"."organization_id" AND "compliance_report"."compliance_period_id" = "Organization Early Issuance"."compliance_period_id"
      INNER JOIN (
        SELECT
          compliance_report_group_uuid AS group_uuid,
          max(VERSION) AS max_version
        FROM
          COMPLIANCE_REPORT
       
GROUP BY
          COMPLIANCE_REPORT.compliance_report_group_uuid
      ) AS "Compliance Reports Chained - Compliance Report Group UUID" ON (
        "compliance_report"."compliance_report_group_uuid" = "Compliance Reports Chained - Compliance Report Group UUID"."group_uuid"
      )
     
   AND (
        "compliance_report"."version" = "Compliance Reports Chained - Compliance Report Group UUID"."max_version"
      );

GRANT SELECT ON vw_compliance_report_base TO basic_lcfs_reporting_role;
-- ==========================================
-- Final Supply Equipment Base View
-- ==========================================
DROP VIEW IF EXISTS vw_fse_base CASCADE;
CREATE OR REPLACE VIEW vw_fse_base AS
WITH
fse_intended_uses AS (
    SELECT 
        fse.final_supply_equipment_id,
        STRING_AGG(DISTINCT eut.type, ', ' ORDER BY eut.type) AS intended_uses
    FROM final_supply_equipment fse
    LEFT JOIN final_supply_intended_use_association fsiua 
        ON fse.final_supply_equipment_id = fsiua.final_supply_equipment_id
    LEFT JOIN end_use_type eut 
        ON fsiua.end_use_type_id = eut.end_use_type_id
        AND eut.intended_use = true
    GROUP BY fse.final_supply_equipment_id
),
fse_intended_users AS (
    SELECT 
        fse.final_supply_equipment_id,
        STRING_AGG(DISTINCT eurt.type_name, ', ' ORDER BY eurt.type_name) AS intended_users
    FROM final_supply_equipment fse
    LEFT JOIN final_supply_intended_user_association fsiura 
        ON fse.final_supply_equipment_id = fsiura.final_supply_equipment_id
    LEFT JOIN end_user_type eurt 
        ON fsiura.end_user_type_id = eurt.end_user_type_id
        AND eurt.intended_use = true
    GROUP BY fse.final_supply_equipment_id
)
SELECT 
    o.name AS "Organization",
    fse.supply_from_date AS "Supply From Date",
    fse.supply_to_date AS "Supply To Date",
    fse.kwh_usage AS "kWh Usage",
    fse.serial_nbr AS "Serial #",
    fse.manufacturer AS "Manufacturer",
    fse.model AS "Model",
    loe.name AS "Level of Equipment",
    fse.ports AS "Ports",
    COALESCE(fiu.intended_uses, '') AS "Intended Use",
    COALESCE(fiur.intended_users, '') AS "Intended Users",
    fse.street_address AS "Street Address",
    fse.city AS "City",
    fse.postal_code AS "Postal Code",
    fse.latitude AS "Latitude",
    fse.longitude AS "Longitude",
    fse.notes AS "Notes"
    
FROM final_supply_equipment fse
JOIN v_compliance_report vcr 
    ON vcr.compliance_report_id = fse.compliance_report_id
    AND vcr.is_latest = true
JOIN compliance_report cr 
    ON cr.compliance_report_id = fse.compliance_report_id
JOIN compliance_report_status crs 
    ON crs.compliance_report_status_id = cr.current_status_id
    AND crs.status != 'Draft'  -- Exclude draft reports
JOIN organization o 
    ON o.organization_id = cr.organization_id
JOIN compliance_period cp 
    ON cp.compliance_period_id = cr.compliance_period_id
LEFT JOIN level_of_equipment loe 
    ON loe.level_of_equipment_id = fse.level_of_equipment_id
LEFT JOIN fse_intended_uses fiu 
    ON fiu.final_supply_equipment_id = fse.final_supply_equipment_id
LEFT JOIN fse_intended_users fiur 
    ON fiur.final_supply_equipment_id = fse.final_supply_equipment_id

ORDER BY 
    o.name,
    cp.description DESC,
    fse.supply_from_date,
    fse.serial_nbr;

GRANT SELECT ON vw_fse_base TO basic_lcfs_reporting_role;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fse_info_org_year
    ON final_supply_equipment (compliance_report_id);
CREATE INDEX IF NOT EXISTS idx_fse_info_supply_dates
    ON final_supply_equipment (supply_from_date, supply_to_date);
CREATE INDEX IF NOT EXISTS idx_fse_info_location
    ON final_supply_equipment (latitude, longitude);
-- ==========================================
-- Electricity Allocation FSE Match Query
-- ==========================================
DROP VIEW IF EXISTS vw_electricity_allocation_fse_match CASCADE;
CREATE OR REPLACE VIEW vw_electricity_allocation_fse_match AS
WITH electricity_allocations AS (
    SELECT DISTINCT
        vcr.compliance_period AS "Compliance Year",
        vcr.organization_name AS "Reporting Organization",
        aa.transaction_partner AS "Legal Name of Transaction Partner",
        COALESCE(ft.fuel_type, aa.fuel_type_other) AS "Fuel Type",
        aa.quantity AS "Quantity",
        aa.units AS "Units"
    FROM allocation_agreement aa
    JOIN v_compliance_report vcr 
        ON vcr.compliance_report_id = aa.compliance_report_id
        AND vcr.report_status != 'Draft'
    LEFT JOIN fuel_type ft ON aa.fuel_type_id = ft.fuel_type_id
    WHERE (LOWER(COALESCE(ft.fuel_type, aa.fuel_type_other)) LIKE '%electricity%')
),
fse_organizations AS (
    SELECT DISTINCT
        vcr.compliance_period AS "Compliance Year",
        vcr.organization_name AS "Reporting Organization",
        fse.organization_name AS "FSE Organization Name",
        COUNT(*) AS "FSE Equipment Count"
    FROM final_supply_equipment fse
    JOIN v_compliance_report vcr 
        ON vcr.compliance_report_id = fse.compliance_report_id
        AND vcr.report_status != 'Draft'
    GROUP BY vcr.compliance_period, vcr.organization_name, fse.organization_name
)
SELECT 
    ea."Compliance Year",
    ea."Reporting Organization",
    ea."Legal Name of Transaction Partner",
    ea."Fuel Type",
    ea."Quantity",
    ea."Units",
    fo."FSE Organization Name",
    COALESCE(fo."FSE Equipment Count", 0) AS "FSE Equipment Count",
    CASE 
        WHEN fo."FSE Organization Name" IS NOT NULL THEN 'Matched'
        ELSE 'Missing FSE Data'
    END AS "FSE Match Status"
FROM electricity_allocations ea
LEFT JOIN fse_organizations fo 
    ON ea."Compliance Year" = fo."Compliance Year"
    AND ea."Reporting Organization" = fo."Reporting Organization"
    AND LOWER(TRIM(ea."Legal Name of Transaction Partner")) = LOWER(TRIM(fo."FSE Organization Name"))

ORDER BY 
    ea."Compliance Year" DESC,
    ea."Reporting Organization",
    ea."Legal Name of Transaction Partner";

GRANT SELECT ON vw_electricity_allocation_fse_match TO basic_lcfs_reporting_role;
-- ==========================================
-- Allocation Agreement Duplicate Check
-- ==========================================
DROP VIEW IF EXISTS vw_allocation_agreement_duplicate_check CASCADE;
CREATE OR REPLACE VIEW vw_allocation_agreement_duplicate_check AS
WITH latest_aa AS (
    SELECT DISTINCT ON (group_uuid) *
    FROM allocation_agreement
    WHERE action_type != 'DELETE'
    ORDER BY group_uuid, version DESC
),
base_data AS (
    SELECT
        aa.postal_address,
        LOWER(TRIM(aa.postal_address))     AS address_normalized,
        aa.transaction_partner,
        LOWER(TRIM(aa.transaction_partner)) AS organization_name_normalized,
        cp.description                     AS compliance_year,
        o.organization_code                AS organization_code,
        o.name                             AS reporting_organization_name,
        lr.compliance_report_id            AS compliance_report_id
    FROM latest_aa aa
    JOIN v_compliance_report lr
      ON lr.compliance_report_id = aa.compliance_report_id
     AND lr.report_status != 'Draft'
    JOIN organization       o  ON o.organization_id       = lr.organization_id
    JOIN compliance_period  cp ON cp.compliance_period_id = lr.compliance_period_id
),
address_duplicates AS (
    SELECT 
        postal_address,
        address_normalized,
        compliance_year,
        COUNT(DISTINCT compliance_report_id) as duplicate_count,
        STRING_AGG(DISTINCT organization_code, ', ') as organization_codes,
        STRING_AGG(DISTINCT reporting_organization_name, ', ') as reporting_organizations,
        STRING_AGG(DISTINCT compliance_report_id::text, ', ') as compliance_report_ids
    FROM base_data
    GROUP BY postal_address, address_normalized, compliance_year
    HAVING COUNT(DISTINCT organization_code) > 1
),
org_name_duplicates AS (
    SELECT 
        transaction_partner,
        organization_name_normalized,
        compliance_year,
        COUNT(DISTINCT compliance_report_id) as duplicate_count,
        STRING_AGG(DISTINCT organization_code, ', ') as organization_codes,
        STRING_AGG(DISTINCT reporting_organization_name, ', ') as reporting_organizations,
        STRING_AGG(DISTINCT compliance_report_id::text, ', ') as compliance_report_ids
    FROM base_data
    GROUP BY transaction_partner, organization_name_normalized, compliance_year
    HAVING COUNT(DISTINCT organization_code) > 1
)
SELECT 
    'Address Duplicate' AS "Issue Type",
    ad.postal_address AS "Duplicate Value",
    ad.compliance_year AS "Year",
    ad.duplicate_count AS "Number of Compliance Reports",
    ad.compliance_report_ids AS "Compliance Report IDs",
    ad.organization_codes AS "Organization Codes"
FROM address_duplicates ad

UNION ALL

SELECT 
    'Allocator Name Duplicate' AS "Issue Type",
    od.transaction_partner AS "Duplicate Value",
    od.compliance_year AS "Year",
    od.duplicate_count AS "Number of Compliance Reports",
    od.compliance_report_ids AS "Compliance Report IDs",
    od.organization_codes AS "Organization Codes"
FROM org_name_duplicates od

ORDER BY "Year" DESC, "Issue Type", "Number of Compliance Reports" DESC;

GRANT SELECT ON vw_allocation_agreement_duplicate_check TO basic_lcfs_reporting_role;

CREATE INDEX IF NOT EXISTS idx_allocation_agreement_addr_norm
    ON allocation_agreement (LOWER(TRIM(postal_address)));
-- ==========================================
-- Final Supply Equipment Duplicate Check
-- ==========================================
DROP VIEW IF EXISTS vw_fse_duplicate_check CASCADE;
CREATE OR REPLACE VIEW vw_fse_duplicate_check AS
WITH base_data AS (
    SELECT
        fse.street_address,
        LOWER(TRIM(fse.street_address))     AS street_address_normalized,
        fse.city,
        LOWER(TRIM(fse.city))               AS city_normalized,
        fse.postal_code,
        LOWER(TRIM(fse.postal_code))        AS postal_code_normalized,
        fse.organization_name,
        LOWER(TRIM(fse.organization_name))  AS organization_name_normalized,
        CONCAT(LOWER(TRIM(fse.street_address)), ', ', LOWER(TRIM(fse.city)), ', ', LOWER(TRIM(fse.postal_code))) AS full_address_normalized,
        vcr.compliance_period               AS compliance_year,
        o.organization_code                 AS organization_code,
        o.name                              AS reporting_organization_name,
        vcr.compliance_report_id            AS compliance_report_id
    FROM final_supply_equipment fse
    JOIN v_compliance_report vcr
      ON vcr.compliance_report_id = fse.compliance_report_id
     AND vcr.report_status != 'Draft'
    JOIN organization       o  ON o.organization_id       = vcr.organization_id
    JOIN compliance_period  cp ON cp.compliance_period_id = vcr.compliance_period_id
),
full_address_duplicates AS (
    SELECT 
        CONCAT(street_address, ', ', city, ', ', postal_code) as full_address,
        full_address_normalized,
        compliance_year,
        COUNT(DISTINCT compliance_report_id) as duplicate_count,
        STRING_AGG(DISTINCT compliance_report_id::text, ', ') as compliance_report_ids,
        STRING_AGG(DISTINCT organization_code, ', ') as organization_codes
    FROM base_data
    GROUP BY street_address, city, postal_code, full_address_normalized, compliance_year
    HAVING COUNT(DISTINCT organization_code) > 1
),
organization_name_duplicates AS (
    SELECT 
        organization_name,
        organization_name_normalized,
        compliance_year,
        COUNT(DISTINCT compliance_report_id) as duplicate_count,
        STRING_AGG(DISTINCT compliance_report_id::text, ', ') as compliance_report_ids,
        STRING_AGG(DISTINCT organization_code, ', ') as organization_codes
    FROM base_data
    GROUP BY organization_name, organization_name_normalized, compliance_year
    HAVING COUNT(DISTINCT organization_code) > 1
)
SELECT 
    'Full Address Duplicate' AS "Issue Type",
    fad.full_address AS "Duplicate Value",
    fad.compliance_year AS "Year",
    fad.duplicate_count AS "Number of Compliance Reports",
    fad.compliance_report_ids AS "Compliance Report IDs",
    fad.organization_codes AS "Organization Codes"
FROM full_address_duplicates fad

UNION ALL

SELECT 
    'Organization Name Duplicate' AS "Issue Type",
    ond.organization_name AS "Duplicate Value",
    ond.compliance_year AS "Year",
    ond.duplicate_count AS "Number of Compliance Reports",
    ond.compliance_report_ids AS "Compliance Report IDs",
    ond.organization_codes AS "Organization Codes"
FROM organization_name_duplicates ond

ORDER BY "Year" DESC, "Issue Type", "Number of Compliance Reports" DESC;

GRANT SELECT ON vw_fse_duplicate_check TO basic_lcfs_reporting_role;

CREATE INDEX IF NOT EXISTS idx_fse_full_address_norm
    ON final_supply_equipment (LOWER(TRIM(street_address)), LOWER(TRIM(city)), LOWER(TRIM(postal_code)));
CREATE INDEX IF NOT EXISTS idx_fse_organization_name_norm
    ON final_supply_equipment (LOWER(TRIM(organization_name)));

-- ==========================================
-- LEVEL 3: Views depending on Level 2 views
-- ==========================================

-- ==========================================
-- Compliance Reports Waiting review
-- ==========================================
DROP VIEW IF EXISTS vw_reports_waiting_review;
CREATE OR REPLACE VIEW vw_reports_waiting_review AS
WITH latest_history AS (
    SELECT
        crh.compliance_report_id,
        crh.create_date,
        cr.compliance_report_group_uuid,
        ROW_NUMBER() OVER (PARTITION BY cr.compliance_report_group_uuid ORDER BY crh.create_date DESC) AS rn
    FROM
        vw_compliance_report_analytics_base cr
        JOIN compliance_report_history crh ON cr.compliance_report_id = crh.compliance_report_id
    WHERE
        crh.status_id != 1
)
SELECT
    compliance_period.description AS "Compliance Period",
    organization.name AS "organization",
    cr.compliance_report_id,
    crs.status,
    DATE_PART('epoch', NOW() - lh.create_date) / 86400 AS days_in_status
FROM
    latest_history lh
    JOIN vw_compliance_report_analytics_base cr ON cr.compliance_report_id = lh.compliance_report_id
    JOIN compliance_report_status crs ON cr.report_status_id = crs.compliance_report_status_id
    JOIN compliance_period ON compliance_period.compliance_period_id = cr.compliance_period_id
    JOIN organization ON cr.organization_id = organization.organization_id
WHERE
    lh.rn = 1
    AND crs.status NOT IN ('Assessed'::compliancereportstatusenum, 'Rejected'::compliancereportstatusenum, 'Not_recommended_by_analyst'::compliancereportstatusenum, 'Not_recommended_by_manager'::compliancereportstatusenum)
ORDER BY
    days_in_status DESC NULLS LAST;

GRANT SELECT ON vw_reports_waiting_review TO basic_lcfs_reporting_role;
-- ==========================================
-- Fuel Supply Analytics Base View
-- ==========================================
DROP VIEW IF EXISTS vw_fuel_supply_analytics_base;
CREATE OR REPLACE VIEW vw_fuel_supply_analytics_base AS
WITH
  latest_fs AS (
    SELECT
      fs.group_uuid,
      MAX(fs.version) AS max_version
    FROM
      fuel_supply fs
    WHERE
      action_type <> 'DELETE'
    GROUP BY
      fs.group_uuid
  ),
  selected_fs AS (
    SELECT
      fs.*
    FROM
      fuel_supply fs
      JOIN latest_fs lfs ON fs.group_uuid = lfs.group_uuid
      AND fs.version = lfs.max_version
    WHERE
      fs.action_type != 'DELETE'
  ),
  finished_fuel_transport_modes_agg AS (
    SELECT
      fc.fuel_code_id,
      ARRAY_AGG(tm.transport_mode ORDER BY tm.transport_mode) AS transport_modes
    FROM
      fuel_code fc
      JOIN finished_fuel_transport_mode fftm ON fc.fuel_code_id = fftm.fuel_code_id
      JOIN transport_mode tm ON fftm.transport_mode_id = tm.transport_mode_id
    GROUP BY
      fc.fuel_code_id
  ),
  feedstock_fuel_transport_modes_agg AS (
    SELECT
      fc.fuel_code_id,
      ARRAY_AGG(tm.transport_mode ORDER BY tm.transport_mode) AS transport_modes
    FROM
      fuel_code fc
      JOIN feedstock_fuel_transport_mode fftm ON fc.fuel_code_id = fftm.fuel_code_id
      JOIN transport_mode tm ON fftm.transport_mode_id = tm.transport_mode_id
    GROUP BY
      fc.fuel_code_id
  ),
  grouped_reports AS (
    SELECT
      compliance_report_id,
      compliance_report_group_uuid,
      VERSION,
      compliance_period_id,
      current_status_id,
      organization_id
    FROM
      compliance_report
    WHERE
      compliance_report_group_uuid IN (
        SELECT
          vcrb.compliance_report_group_uuid
        FROM
          vw_compliance_report_analytics_base vcrb
      )
  )
SELECT DISTINCT
  gr.compliance_report_group_uuid,
  vcrb.report_status,
  vcrb.compliance_report_id,
  org.organization_id,
  org.name AS supplier_name,
  cp.description AS compliance_year,
  ft.fuel_type,
  fcat.category as fuel_category,
  eut.type AS end_use_type,
  pa.description as provision_description,
  fs.compliance_units,
  fs.quantity,
  fs.q1_quantity,
  fs.q2_quantity,
  fs.q3_quantity,
  fs.q4_quantity,
  ft.units as fuel_units,
  fs.target_ci,
  fs.ci_of_fuel as rci,
  fs.uci,
  fs.energy_density,
  fs.eer,
  fs.energy as energy_content,
  concat(fcp.prefix, fc.fuel_suffix) AS fuel_code,
  fc.company as fuel_code_company,
  fc.feedstock,
  fc.feedstock_location,
  fc.feedstock_misc,
  fc.effective_date,
  fc.application_date,
  fc.approval_date,
  fc.expiration_date,
  ft.renewable,
  ft.fossil_derived,
  fc.carbon_intensity,
  fc.fuel_production_facility_city,
  fc.fuel_production_facility_province_state,
  fc.fuel_production_facility_country,
  fc.facility_nameplate_capacity,
  fc.facility_nameplate_capacity_unit,
  finishedftma.transport_modes as Finished_fuel_transport_modes,
  feedstockftma.transport_modes as Feedstock_fuel_transport_modes,
  fcs.status as fuel_code_status,
  fs.fuel_supply_id,
  fs.fuel_type_id,
  fs.fuel_code_id,
  fs.provision_of_the_act_id,
  fs.fuel_category_id,
  fs.end_use_id
FROM
  selected_fs fs
  JOIN grouped_reports gr ON fs.compliance_report_id = gr.compliance_report_id
  JOIN vw_compliance_report_analytics_base vcrb ON vcrb.compliance_report_group_uuid = gr.compliance_report_group_uuid
  JOIN compliance_period cp ON gr.compliance_period_id = cp.compliance_period_id
  JOIN organization org ON gr.organization_id = org.organization_id
  LEFT JOIN fuel_code fc ON fs.fuel_code_id = fc.fuel_code_id
  LEFT JOIN fuel_code_status fcs ON fc.fuel_status_id = fcs.fuel_code_status_id
  LEFT JOIN fuel_code_prefix fcp ON fc.prefix_id = fcp.fuel_code_prefix_id
  LEFT JOIN fuel_type ft ON fs.fuel_type_id = ft.fuel_type_id
  LEFT JOIN fuel_category fcat ON fcat.fuel_category_id = fs.fuel_category_id
  LEFT JOIN end_use_type eut ON fs.end_use_id = eut.end_use_type_id
  LEFT JOIN provision_of_the_act pa ON fs.provision_of_the_act_id = pa.provision_of_the_act_id
  LEFT JOIN finished_fuel_transport_modes_agg finishedftma ON fc.fuel_code_id = finishedftma.fuel_code_id
  LEFT JOIN feedstock_fuel_transport_modes_agg feedstockftma ON fc.fuel_code_id = feedstockftma.fuel_code_id;
GRANT SELECT ON vw_fuel_supply_analytics_base TO basic_lcfs_reporting_role;
-- ==========================================
-- Fuel Export Analytics Base View
-- ==========================================
DROP VIEW IF EXISTS vw_fuel_export_analytics_base;
CREATE OR REPLACE VIEW vw_fuel_export_analytics_base AS
WITH
  latest_fe AS (
    SELECT
      fe.group_uuid,
      MAX(fe.version) AS max_version
    FROM
      fuel_export fe
    WHERE
      action_type <> 'DELETE'
    GROUP BY
      fe.group_uuid
  ),
  selected_fe AS (
    SELECT
      fe.*
    FROM
      fuel_export fe
      JOIN latest_fe lfe ON fe.group_uuid = lfe.group_uuid
      AND fe.version = lfe.max_version
    WHERE
      fe.action_type != 'DELETE'
  ),
  finished_fuel_transport_modes_agg AS (
    SELECT
      fc.fuel_code_id,
      ARRAY_AGG(tm.transport_mode ORDER BY tm.transport_mode) AS transport_modes
    FROM
      fuel_code fc
      JOIN finished_fuel_transport_mode fftm ON fc.fuel_code_id = fftm.fuel_code_id
      JOIN transport_mode tm ON fftm.transport_mode_id = tm.transport_mode_id
    GROUP BY
      fc.fuel_code_id
  ),
  feedstock_fuel_transport_modes_agg AS (
    SELECT
      fc.fuel_code_id,
      ARRAY_AGG(tm.transport_mode ORDER BY tm.transport_mode) AS transport_modes
    FROM
      fuel_code fc
      JOIN feedstock_fuel_transport_mode fftm ON fc.fuel_code_id = fftm.fuel_code_id
      JOIN transport_mode tm ON fftm.transport_mode_id = tm.transport_mode_id
    GROUP BY
      fc.fuel_code_id
  ),
  grouped_reports AS (
    SELECT
      compliance_report_id,
      compliance_report_group_uuid,
      VERSION,
      compliance_period_id,
      current_status_id,
      organization_id
    FROM
      compliance_report
    WHERE
      compliance_report_group_uuid IN (
        SELECT
          vcrb.compliance_report_group_uuid
        FROM
          vw_compliance_report_analytics_base vcrb
      )
  )
SELECT DISTINCT
  gr.compliance_report_group_uuid,
  vcrb.report_status,
  vcrb.compliance_report_id,
  org.organization_id,
  org.name AS supplier_name,
  cp.description AS compliance_year,
  ft.fuel_type,
  fcat.category as fuel_category,
  eut.type AS end_use_type,
  pa.description as provision_description,
  fe.compliance_units,
  fe.quantity,
  ft.units as fuel_units,
  fe.target_ci,
  fe.ci_of_fuel as rci,
  fe.uci,
  fe.energy_density,
  fe.eer,
  fe.energy as energy_content,
  concat(fcp.prefix, fc.fuel_suffix) AS fuel_code,
  fc.company as fuel_code_company,
  fc.feedstock,
  fc.feedstock_location,
  fc.feedstock_misc,
  fc.effective_date,
  fc.application_date,
  fc.approval_date,
  fc.expiration_date,
  ft.renewable,
  ft.fossil_derived,
  fc.carbon_intensity,
  fc.fuel_production_facility_city,
  fc.fuel_production_facility_province_state,
  fc.fuel_production_facility_country,
  fc.facility_nameplate_capacity,
  fc.facility_nameplate_capacity_unit,
  finishedftma.transport_modes as Finished_fuel_transport_modes,
  feedstockftma.transport_modes as Feedstock_fuel_transport_modes,
  fcs.status as fuel_code_status,
  fe.fuel_export_id,
  fe.fuel_type_id,
  fe.fuel_code_id,
  fe.provision_of_the_act_id,
  fe.fuel_category_id,
  fe.end_use_id
FROM
  selected_fe fe
  JOIN grouped_reports gr ON fe.compliance_report_id = gr.compliance_report_id
  JOIN vw_compliance_report_analytics_base vcrb ON vcrb.compliance_report_group_uuid = gr.compliance_report_group_uuid
  JOIN compliance_period cp ON gr.compliance_period_id = cp.compliance_period_id
  JOIN organization org ON gr.organization_id = org.organization_id
  LEFT JOIN fuel_code fc ON fe.fuel_code_id = fc.fuel_code_id
  LEFT JOIN fuel_code_status fcs ON fc.fuel_status_id = fcs.fuel_code_status_id
  LEFT JOIN fuel_code_prefix fcp ON fc.prefix_id = fcp.fuel_code_prefix_id
  LEFT JOIN fuel_type ft ON fe.fuel_type_id = ft.fuel_type_id
  LEFT JOIN fuel_category fcat ON fcat.fuel_category_id = fe.fuel_category_id
  LEFT JOIN end_use_type eut ON fe.end_use_id = eut.end_use_type_id
  LEFT JOIN provision_of_the_act pa ON fe.provision_of_the_act_id = pa.provision_of_the_act_id
  LEFT JOIN finished_fuel_transport_modes_agg finishedftma ON fc.fuel_code_id = finishedftma.fuel_code_id
  LEFT JOIN feedstock_fuel_transport_modes_agg feedstockftma ON fc.fuel_code_id = feedstockftma.fuel_code_id;
  
grant select on vw_fuel_export_analytics_base to basic_lcfs_reporting_role;
-- ==========================================
-- Allocation agreement Analytics Base View
-- ==========================================
DROP VIEW IF EXISTS vw_allocation_agreement_analytics_base;
CREATE OR REPLACE VIEW vw_allocation_agreement_analytics_base AS
WITH
  latest_aa AS (
    SELECT
      aa.group_uuid,
      MAX(aa.version) AS max_version
    FROM
      allocation_agreement aa
    WHERE
      action_type <> 'DELETE'
    GROUP BY
      aa.group_uuid
  ),
  selected_aa AS (
    SELECT
      aa.*
    FROM
      allocation_agreement aa
      JOIN latest_aa laa ON aa.group_uuid = laa.group_uuid
      AND aa.version = laa.max_version
    WHERE
      aa.action_type != 'DELETE'
  ),
  finished_fuel_transport_modes_agg AS (
    SELECT
      fc.fuel_code_id,
      ARRAY_AGG(tm.transport_mode ORDER BY tm.transport_mode) AS transport_modes
    FROM
      fuel_code fc
      JOIN finished_fuel_transport_mode fftm ON fc.fuel_code_id = fftm.fuel_code_id
      JOIN transport_mode tm ON fftm.transport_mode_id = tm.transport_mode_id
    GROUP BY
      fc.fuel_code_id
  ),
  feedstock_fuel_transport_modes_agg AS (
    SELECT
      fc.fuel_code_id,
      ARRAY_AGG(tm.transport_mode ORDER BY tm.transport_mode) AS transport_modes
    FROM
      fuel_code fc
      JOIN feedstock_fuel_transport_mode fftm ON fc.fuel_code_id = fftm.fuel_code_id
      JOIN transport_mode tm ON fftm.transport_mode_id = tm.transport_mode_id
    GROUP BY
      fc.fuel_code_id
  ),
  grouped_reports AS (
    SELECT
      compliance_report_id,
      compliance_report_group_uuid,
      VERSION,
      compliance_period_id,
      current_status_id,
      organization_id
    FROM
      compliance_report
    WHERE
      compliance_report_group_uuid IN (
        SELECT
          vcrb.compliance_report_group_uuid
        FROM
          vw_compliance_report_analytics_base vcrb
      )
  )
SELECT DISTINCT
  gr.compliance_report_group_uuid,
  vcrb.report_status,
  vcrb.compliance_report_id,
  org.organization_id,
  org.name AS supplier_name,
  cp.description AS compliance_year,
  aa.transaction_partner,
  aa.postal_address,
  CASE
    WHEN aa.allocation_transaction_type_id = 1 THEN 'Allocated From'
    WHEN aa.allocation_transaction_type_id = 2 THEN 'Allocation To'
  END AS allocation_transaction_type,
  aa.quantity,
  aa.q1_quantity,
  aa.q2_quantity,
  aa.q3_quantity,
  aa.q4_quantity,
  aa.units as fuel_units,
  aa.ci_of_fuel as rci,
  ft.fuel_type,
  aa.fuel_type_other,
  fcat.category as fuel_category,
  pa.description as provision_description,
  concat(fcp.prefix, fc.fuel_suffix) AS fuel_code,
  fc.company as fuel_code_company,
  fc.feedstock,
  fc.feedstock_location,
  fc.feedstock_misc,
  fc.effective_date,
  fc.application_date,
  fc.approval_date,
  fc.expiration_date,
  ft.renewable,
  ft.fossil_derived,
  fc.carbon_intensity,
  fc.fuel_production_facility_city,
  fc.fuel_production_facility_province_state,
  fc.fuel_production_facility_country,
  fc.facility_nameplate_capacity,
  fc.facility_nameplate_capacity_unit,
  finishedftma.transport_modes as Finished_fuel_transport_modes,
  feedstockftma.transport_modes as Feedstock_fuel_transport_modes,
  fcs.status as fuel_code_status,
  aa.allocation_agreement_id,
  aa.fuel_type_id,
  aa.fuel_code_id,
  aa.provision_of_the_act_id,
  aa.fuel_category_id
FROM
  selected_aa aa
  JOIN grouped_reports gr ON aa.compliance_report_id = gr.compliance_report_id
  JOIN vw_compliance_report_analytics_base vcrb ON vcrb.compliance_report_group_uuid = gr.compliance_report_group_uuid
  JOIN compliance_period cp ON gr.compliance_period_id = cp.compliance_period_id
  JOIN organization org ON gr.organization_id = org.organization_id
  LEFT JOIN fuel_code fc ON aa.fuel_code_id = fc.fuel_code_id
  LEFT JOIN fuel_code_status fcs ON fc.fuel_status_id = fcs.fuel_code_status_id
  LEFT JOIN fuel_code_prefix fcp ON fc.prefix_id = fcp.fuel_code_prefix_id
  LEFT JOIN fuel_type ft ON aa.fuel_type_id = ft.fuel_type_id
  LEFT JOIN fuel_category fcat ON fcat.fuel_category_id = aa.fuel_category_id
  LEFT JOIN provision_of_the_act pa ON aa.provision_of_the_act_id = pa.provision_of_the_act_id
  LEFT JOIN finished_fuel_transport_modes_agg finishedftma ON fc.fuel_code_id = finishedftma.fuel_code_id
  LEFT JOIN feedstock_fuel_transport_modes_agg feedstockftma ON fc.fuel_code_id = feedstockftma.fuel_code_id;
GRANT SELECT ON vw_allocation_agreement_analytics_base TO basic_lcfs_reporting_role;
-- ==========================================
-- Allocation Agreement Base View With Early Issuance By Year
-- ==========================================
DROP VIEW IF EXISTS vw_allocation_agreement_base;
CREATE OR REPLACE VIEW vw_allocation_agreement_base AS
WITH latest_aa AS (
    SELECT DISTINCT ON (group_uuid) *
    FROM allocation_agreement
    WHERE action_type != 'DELETE'
    ORDER BY group_uuid, version DESC
)
SELECT
    aa.allocation_agreement_id,
    aa.transaction_partner,
    CASE
        WHEN aa.allocation_transaction_type_id = 1 THEN 'Allocated From'
        WHEN aa.allocation_transaction_type_id = 2 THEN 'Allocation To'
    END AS allocation_transaction_type,
    aa.ci_of_fuel,
    aa.quantity,
    aa.units,
    aa.fuel_type_other,
    aa.fuel_type_id,
    aa.fuel_category_id,
    aa.provision_of_the_act_id,
    aa.fuel_code_id,
    aa.compliance_report_id,
    aa.quantity_not_sold,
    cr.compliance_period_id,
    cr.organization_id,
    cr.current_status_id,
    cp.description AS compliance_period,
    org.name AS organization_name
FROM latest_aa aa
LEFT JOIN compliance_report cr ON aa.compliance_report_id = cr.compliance_report_id
LEFT JOIN compliance_period cp ON cr.compliance_period_id = cp.compliance_period_id
LEFT JOIN organization org ON cr.organization_id = org.organization_id;

GRANT SELECT ON vw_allocation_agreement_base TO basic_lcfs_reporting_role;

-- ==========================================
-- Additional permissions for base tables
-- ==========================================
GRANT SELECT ON organization, transfer_status, transfer_category, compliance_period, compliance_report_status TO basic_lcfs_reporting_role;
GRANT SELECT ON fuel_category, fuel_type, fuel_code, fuel_code_status, fuel_code_prefix, provision_of_the_act, end_use_type TO basic_lcfs_reporting_role;