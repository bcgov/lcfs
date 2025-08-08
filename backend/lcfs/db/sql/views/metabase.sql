-- ==========================================
-- Compliance Reports Analytics View
-- ==========================================
drop view if exists vw_compliance_report_analytics_base cascade;
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

GRANT SELECT ON vw_compliance_report_analytics_base, compliance_report_history TO basic_lcfs_reporting_role;

-- ==========================================
-- Compliance Reports Waiting review
-- ==========================================
drop view if exists vw_reports_waiting_review;
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
-- Compliance reports time per status
-- ==========================================
drop view if exists vw_compliance_reports_time_per_status;
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
-- Transfer base Analytics View
-- ==========================================
drop view if exists vw_transfer_base;
CREATE OR REPLACE VIEW vw_transfer_base AS
SELECT
    transfer.transfer_id,
    transfer_status.status,
    coalesce(transfer.transaction_effective_date, transfer_history.update_date) "Calculated Effective Date",
    from_organization.name AS from_organization,
    to_organization.name AS to_organization,
    price_per_unit,
    quantity,
    price_per_unit * quantity::float AS transfer_value,
    transfer_category.category::text AS "transfer_category"
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

GRANT SELECT ON organization, transfer_status, transfer_category, compliance_period, compliance_report_status TO basic_lcfs_reporting_role;

-- ==========================================
-- User Login Analytics Base View
-- ==========================================
drop view if exists vw_user_login_analytics_base cascade;
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
-- BCeID Daily Login Summary View
-- ==========================================
drop view if exists vw_bceid_daily_login_summary;
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
drop view if exists vw_bceid_user_statistics;
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
drop view if exists vw_login_failures_analysis;
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
-- Fuel Supply Analytics Base View
-- ==========================================
drop view if exists vw_fuel_supply_analytics_base;
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
grant select on vw_fuel_supply_analytics_base to basic_lcfs_reporting_role;
grant select on fuel_category, fuel_type, fuel_code, fuel_code_status, fuel_code_prefix, provision_of_the_act, end_use_type to basic_lcfs_reporting_role;

-- ==========================================
-- Transaction Base View
-- ==========================================
drop view if exists vw_transaction_base;
CREATE OR REPLACE VIEW vw_transaction_base AS
SELECT *
FROM transaction
WHERE transaction_action != 'Released';

GRANT SELECT ON vw_transaction_base TO basic_lcfs_reporting_role;

-- ==========================================
-- Fuel Supply Fuel Code Base View
-- ==========================================
drop view if exists vw_fuel_supply_fuel_code_base;
CREATE OR REPLACE VIEW vw_fuel_supply_fuel_code_base AS
SELECT
      "source"."compliance_report_id" AS "compliance_report_id",
      "source"."organization_id" AS "organization_id",
      "source"."organization" AS "organization",
      "source"."compliance_period" AS "compliance_period",
      "source"."report_status" AS "report_status",
      "source"."fuel_supply_id" AS "fuel_supply_id",
      "source"."fuel_type_id" AS "fuel_type_id",
      "source"."fuel_type" AS "fuel_type",
      "source"."renewable" AS "renewable",
      "source"."fuel_category_id" AS "fuel_category_id",
      "source"."fuel_category" AS "fuel_category",
      "source"."fuel_code_id" AS "fuel_code_id",
      "source"."quantity" AS "quantity",
      "source"."units" AS "units",
      "source"."compliance_units" AS "compliance_units",
      "source"."provision_of_the_act_id" AS "provision_of_the_act_id",
      "source"."provision_of_the_act" AS "provision_of_the_act",
      "source"."end_use_id" AS "end_use_id",
      "source"."end_use_type" AS "end_use_type",
      "source"."ci_of_fuel" AS "ci_of_fuel",
      "source"."target_ci" AS "target_ci",
      "source"."uci" AS "uci",
      "source"."energy_density" AS "energy_density",
      "source"."eer" AS "eer",
      "source"."energy" AS "energy",
      "source"."fuel_type_other" AS "fuel_type_other",
      "Fuel Code - fuel_code_id"."fuel_code_id" AS "FC - id__fuel_code_id",
      "Fuel Code - fuel_code_id"."fuel_status_id" AS "FC - id__fuel_status_id",
      "Fuel Code - fuel_code_id"."prefix_id" AS "FC - id__prefix_id",
      "Fuel Code - fuel_code_id"."fuel_suffix" AS "FC - id__fuel_suffix",
      "Fuel Code - fuel_code_id"."company" AS "FC - id__company",
      "Fuel Code - fuel_code_id"."carbon_intensity" AS "FC - id__carbon_intensity",
      "Fuel Code - fuel_code_id"."last_updated" AS "FC - id__last_updated",
      "Fuel Code - fuel_code_id"."application_date" AS "FC - id__application_date",
      "Fuel Code - fuel_code_id"."approval_date" AS "FC - id__approval_date",
      "Fuel Code - fuel_code_id"."fuel_type_id" AS "FC - id__fuel_type_id",
      "Fuel Code - fuel_code_id"."feedstock" AS "FC - id__feedstock",
      "Fuel Code - fuel_code_id"."feedstock_location" AS "FC - id__feedstock_location",
      "Fuel Code - fuel_code_id"."feedstock_misc" AS "FC - id__feedstock_misc",
      "Fuel Code - fuel_code_id"."fuel_production_facility_city" AS "FC - id__fuel_production_facility_city",
      "Fuel Code - fuel_code_id"."fuel_production_facility_province_state" AS "FC - id__fuel_production_facility_province_state",
      "Fuel Code - fuel_code_id"."fuel_production_facility_country" AS "FC - id__fuel_production_facility_country",
      "Fuel Code - fuel_code_id"."facility_nameplate_capacity" AS "FC - id__facility_nameplate_capacity",
      "Fuel Code - fuel_code_id"."effective_date" AS "FC - id__effective_date",
      "Fuel Code - fuel_code_id"."effective_status" AS "FC - id__effective_status",
      "Fuel Code - fuel_code_id"."expiration_date" AS "FC - id__expiration_date"
    FROM
      (
        WITH latest_fs AS (
          SELECT
            DISTINCT ON (group_uuid) *
          FROM
            fuel_supply
         
ORDER BY
            group_uuid,
            VERSION DESC
        )
        SELECT
          -----------------------------------------------------
          -- compliance_report, organization, compliance_period
          -----------------------------------------------------
          compliance_report.compliance_report_id,
          compliance_report.organization_id,
          organization.name AS organization,
          compliance_period.description AS compliance_period,
          compliance_report_status.status AS report_status,
          -------------------------------------------------
          -- fuel_supply
          -------------------------------------------------
          fuel_supply.fuel_supply_id,
          fuel_supply.fuel_type_id,
          fuel_type.fuel_type,
          fuel_type.renewable,
          fuel_supply.fuel_category_id,
          fuel_category.category AS fuel_category,
          fuel_supply.fuel_code_id,
          fuel_supply.quantity,
          fuel_supply.units,
          fuel_supply.compliance_units,
          fuel_supply.provision_of_the_act_id,
          provision_of_the_act.name AS provision_of_the_act,
          fuel_supply.end_use_id,
          end_use_type.type AS end_use_type,
          fuel_supply.ci_of_fuel,
          fuel_supply.target_ci,
          fuel_supply.uci,
          fuel_supply.energy_density,
          fuel_supply.eer,
          fuel_supply.energy,
          fuel_supply.fuel_type_other
        FROM
          compliance_report
          JOIN compliance_report_status ON compliance_report.current_status_id = compliance_report_status.compliance_report_status_id
          JOIN organization ON compliance_report.organization_id = organization.organization_id
          JOIN compliance_period ON compliance_report.compliance_period_id = compliance_period.compliance_period_id
          JOIN latest_fs fuel_supply ON compliance_report.compliance_report_id = fuel_supply.compliance_report_id
          JOIN fuel_type ON fuel_supply.fuel_type_id = fuel_type.fuel_type_id
          JOIN fuel_category ON fuel_supply.fuel_category_id = fuel_category.fuel_category_id
         
LEFT JOIN provision_of_the_act ON fuel_supply.provision_of_the_act_id = provision_of_the_act.provision_of_the_act_id
          LEFT JOIN end_use_type ON fuel_supply.end_use_id = end_use_type.end_use_type_id
       
WHERE
          compliance_report.current_status_id IN (2, 3, 4, 5)
      ) AS "source"
      LEFT JOIN "fuel_code" AS "Fuel Code - fuel_code_id" ON "source"."fuel_code_id" = "Fuel Code - fuel_code_id"."fuel_code_id";


GRANT SELECT ON vw_fuel_supply_fuel_code_base TO basic_lcfs_reporting_role;

-- ==========================================
-- Fuel Supply Base View
-- ==========================================
drop view if exists vw_fuel_supply_base;
CREATE OR REPLACE VIEW vw_fuel_supply_base AS
WITH latest_fs AS (
      SELECT
        DISTINCT ON (group_uuid) *
      FROM
        fuel_supply
     
ORDER BY
        group_uuid,
        VERSION DESC
    )
    SELECT
      compliance_report.compliance_report_id,
      compliance_report.organization_id,
      organization.name AS organization,
      compliance_period.description AS compliance_period,
      compliance_report_status.status AS report_status,
      fuel_supply.fuel_supply_id,
      fuel_supply.fuel_type_id,
      fuel_type.fuel_type,
      fuel_type.renewable,
      fuel_supply.fuel_category_id,
      fuel_category.category AS fuel_category,
      fuel_supply.fuel_code_id,
      fuel_supply.quantity,
      fuel_supply.units,
      fuel_supply.compliance_units,
      fuel_supply.provision_of_the_act_id,
      provision_of_the_act.name AS provision_of_the_act,
      fuel_supply.end_use_id,
      end_use_type.type AS end_use_type,
      fuel_supply.ci_of_fuel,
      fuel_supply.target_ci,
      fuel_supply.uci,
      fuel_supply.energy_density,
      fuel_supply.eer,
      fuel_supply.energy,
      fuel_supply.fuel_type_other
    FROM
      compliance_report
      JOIN compliance_report_status ON compliance_report.current_status_id = compliance_report_status.compliance_report_status_id
      JOIN organization ON compliance_report.organization_id = organization.organization_id
      JOIN compliance_period ON compliance_report.compliance_period_id = compliance_period.compliance_period_id
      JOIN latest_fs fuel_supply ON compliance_report.compliance_report_id = fuel_supply.compliance_report_id
      JOIN fuel_type ON fuel_supply.fuel_type_id = fuel_type.fuel_type_id
      JOIN fuel_category ON fuel_supply.fuel_category_id = fuel_category.fuel_category_id
     
LEFT JOIN provision_of_the_act ON fuel_supply.provision_of_the_act_id = provision_of_the_act.provision_of_the_act_id
      LEFT JOIN end_use_type ON fuel_supply.end_use_id = end_use_type.end_use_type_id
   
WHERE
      compliance_report.current_status_id IN (2, 3, 4, 5);

GRANT SELECT ON vw_fuel_supply_base TO basic_lcfs_reporting_role;

-- ==========================================
-- Compliance Report Fuel Supply Base View
-- ==========================================
drop view if exists vw_compliance_report_fuel_supply_base;
CREATE OR REPLACE VIEW vw_compliance_report_fuel_supply_base AS
SELECT
      "source"."fuel_supply_id" AS "fuel_supply_id",
      "source"."compliance_report_id" AS "compliance_report_id",
      "source"."quantity" AS "quantity",
      "source"."units" AS "units",
      "source"."compliance_units" AS "compliance_units",
      "source"."target_ci" AS "target_ci",
      "source"."ci_of_fuel" AS "ci_of_fuel",
      "source"."energy_density" AS "energy_density",
      "source"."eer" AS "eer",
      "source"."uci" AS "uci",
      "source"."energy" AS "energy",
      "source"."fuel_type_other" AS "fuel_type_other",
      "source"."fuel_category_id" AS "fuel_category_id",
      "source"."fuel_code_id" AS "fuel_code_id",
      "source"."fuel_type_id" AS "fuel_type_id",
      "source"."provision_of_the_act_id" AS "provision_of_the_act_id",
      "source"."end_use_id" AS "end_use_id",
      "source"."q1_quantity" AS "q1_quantity",
      "source"."q2_quantity" AS "q2_quantity",
      "source"."q3_quantity" AS "q3_quantity",
      "source"."q4_quantity" AS "q4_quantity",
      "Compliance Report groups - Compliance Report"."compliance_report_id" AS "CR groups - id",
      "Compliance Report groups - Compliance Report"."compliance_report_group_uuid" AS "CR groups - group_uuid",
      "Compliance Report groups - Compliance Report"."version" AS "CR groups - version",
      "Compliance Report groups - Compliance Report"."compliance_period" AS "CR groups - compliance_period",
      "Compliance Report groups - Compliance Report"."organization_name" AS "CR groups - organization_name",
      "Compliance Report groups - Compliance Report"."report_status" AS "CR groups - report_status"
    FROM
      (
        SELECT
          "fuel_supply"."fuel_supply_id" AS "fuel_supply_id",
          "fuel_supply"."compliance_report_id" AS "compliance_report_id",
          "fuel_supply"."quantity" AS "quantity",
          "fuel_supply"."units" AS "units",
          "fuel_supply"."compliance_units" AS "compliance_units",
          "fuel_supply"."target_ci" AS "target_ci",
          "fuel_supply"."ci_of_fuel" AS "ci_of_fuel",
          "fuel_supply"."energy_density" AS "energy_density",
          "fuel_supply"."eer" AS "eer",
          "fuel_supply"."uci" AS "uci",
          "fuel_supply"."energy" AS "energy",
          "fuel_supply"."fuel_type_other" AS "fuel_type_other",
          "fuel_supply"."fuel_category_id" AS "fuel_category_id",
          "fuel_supply"."fuel_code_id" AS "fuel_code_id",
          "fuel_supply"."fuel_type_id" AS "fuel_type_id",
          "fuel_supply"."provision_of_the_act_id" AS "provision_of_the_act_id",
          "fuel_supply"."end_use_id" AS "end_use_id",
          "fuel_supply"."q1_quantity" AS "q1_quantity",
          "fuel_supply"."q2_quantity" AS "q2_quantity",
          "fuel_supply"."q3_quantity" AS "q3_quantity",
          "fuel_supply"."q4_quantity" AS "q4_quantity"
        FROM
          "fuel_supply"
          INNER JOIN (
            SELECT
              "fuel_supply"."group_uuid" AS "group_uuid",
              MAX("fuel_supply"."version") AS "max"
            FROM
              "fuel_supply"
           
GROUP BY
              "fuel_supply"."group_uuid"
           
ORDER BY
              "fuel_supply"."group_uuid" ASC
          ) AS "Latest Fuel Supply per Group - Version" ON (
            "fuel_supply"."group_uuid" = "Latest Fuel Supply per Group - Version"."group_uuid"
          )
         
   AND (
            "fuel_supply"."version" = "Latest Fuel Supply per Group - Version"."max"
          )
       
WHERE
          "fuel_supply"."action_type" = CAST('CREATE' AS "actiontypeenum")
      ) AS "source"
     
LEFT JOIN (
        SELECT
          "source"."compliance_report_id" AS "compliance_report_id",
          "source"."compliance_report_group_uuid" AS "compliance_report_group_uuid",
          "source"."version" AS "version",
          "source"."compliance_period" AS "compliance_period",
          "source"."organization_name" AS "organization_name",
          "source"."report_status" AS "report_status",
          "Compliance Report - Compliance Report Group UUID"."compliance_report_id" AS "CR - Group UUID__compliance_report_id",
          "Compliance Report - Compliance Report Group UUID"."transaction_id" AS "CR - Group UUID__transaction_id",
          "Compliance Report - Compliance Report Group UUID"."legacy_id" AS "CR - Group UUID__legacy_id",
          "Compliance Report - Compliance Report Group UUID"."version" AS "CR - Group UUID__version",
          "Compliance Report - Compliance Report Group UUID"."supplemental_initiator" AS "CR - Group UUID__supplemental_initiator",
          "Compliance Report - Compliance Report Group UUID"."current_status_id" AS "CR - Group UUID__current_status_id"
        FROM
          (
            SELECT
              "v_compliance_report"."compliance_report_id" AS "compliance_report_id",
              "v_compliance_report"."compliance_report_group_uuid" AS "compliance_report_group_uuid",
              "v_compliance_report"."version" AS "version",
              "v_compliance_report"."compliance_period_id" AS "compliance_period_id",
              "v_compliance_report"."compliance_period" AS "compliance_period",
              "v_compliance_report"."organization_id" AS "organization_id",
              "v_compliance_report"."organization_name" AS "organization_name",
              "v_compliance_report"."report_type" AS "report_type",
              "v_compliance_report"."report_status_id" AS "report_status_id",
              "v_compliance_report"."report_status" AS "report_status",
              "v_compliance_report"."update_date" AS "update_date",
              "v_compliance_report"."supplemental_initiator" AS "supplemental_initiator"
            FROM
              "v_compliance_report"
            WHERE
              (
                "v_compliance_report"."report_status" <> CAST('Draft' AS "compliancereportstatusenum")
              )
             
    OR (
                "v_compliance_report"."report_status" IS NULL
              )
          ) AS "source"
          INNER JOIN "compliance_report" AS "Compliance Report - Compliance Report Group UUID" ON "source"."compliance_report_group_uuid" = "Compliance Report - Compliance Report Group UUID"."compliance_report_group_uuid"
      ) AS "Compliance Report groups - Compliance Report" ON "source"."compliance_report_id" = "Compliance Report groups - Compliance Report"."compliance_report_id";

GRANT SELECT ON vw_compliance_report_fuel_supply_base TO basic_lcfs_reporting_role;

-- ==========================================
-- Compliance Report Chained View
-- ==========================================
drop view if exists vw_compliance_report_chained;
CREATE OR REPLACE VIEW vw_compliance_report_chained AS
SELECT
      compliance_report_group_uuid AS group_uuid,
      max(VERSION) AS max_version
    FROM
      COMPLIANCE_REPORT
   
GROUP BY
      COMPLIANCE_REPORT.compliance_report_group_uuid;

-- Grant SELECT privileges to the reporting role
GRANT SELECT ON vw_compliance_report_chained TO basic_lcfs_reporting_role;

-- ==========================================
-- Compliance Report Base View
-- ==========================================
drop view if exists vw_compliance_report_base cascade;
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
      "Compliance Reports Chained - Compliance Report Group UUID"."group_uuid" AS "CR Chained - CR Group UUID__group_uuid",
      "Compliance Reports Chained - Compliance Report Group UUID"."max_version" AS "CR Chained - CR Group UUID__max_version"
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
-- Allocation Agreement Chained View
-- ==========================================
drop view if exists vw_allocation_agreement_chained;
CREATE OR REPLACE VIEW vw_allocation_agreement_chained AS
SELECT
      "allocation_agreement"."group_uuid" AS "group_uuid",
      MAX("allocation_agreement"."version") AS "max"
    FROM
      "allocation_agreement"
   
GROUP BY
      "allocation_agreement"."group_uuid"
   
ORDER BY
      "allocation_agreement"."group_uuid" ASC;

GRANT SELECT ON vw_allocation_agreement_chained TO basic_lcfs_reporting_role;

-- ==========================================
-- Allocation Agreement Base View
-- ==========================================
drop view if exists vw_allocation_agreement_base;
CREATE OR REPLACE VIEW vw_allocation_agreement_base AS
WITH latest_aa AS (
    SELECT DISTINCT ON (group_uuid) *
    FROM allocation_agreement
    ORDER BY group_uuid, version DESC
)
SELECT
      "source"."group_uuid" AS "group_uuid",
      "source"."max" AS "max",
      CASE
        WHEN "Allocation Agreement - Group UUID"."allocation_transaction_type_id" = 1 THEN 'Allocated From'
        WHEN "Allocation Agreement - Group UUID"."allocation_transaction_type_id" = 2 THEN 'Allocation To'
      END AS "Allocation transaction type",
      "Allocation Agreement - Group UUID"."allocation_agreement_id" AS "Allocation Agreement - Group UUID__allocation_agreement_id",
      "Allocation Agreement - Group UUID"."transaction_partner" AS "Allocation Agreement - Group UUID__transaction_partner",
      "Allocation Agreement - Group UUID"."postal_address" AS "Allocation Agreement - Group UUID__postal_address",
      "Allocation Agreement - Group UUID"."transaction_partner_email" AS "Allocation Agreement - Group UUID__transaction_partner_email",
      "Allocation Agreement - Group UUID"."transaction_partner_phone" AS "Allocation Agreement - Group UUID__transaction_partner_phone",
      "Allocation Agreement - Group UUID"."ci_of_fuel" AS "Allocation Agreement - Group UUID__ci_of_fuel",
      "Allocation Agreement - Group UUID"."quantity" AS "Allocation Agreement - Group UUID__quantity",
      "Allocation Agreement - Group UUID"."units" AS "Allocation Agreement - Group UUID__units",
      "Allocation Agreement - Group UUID"."fuel_type_other" AS "Allocation Agreement - Group UUID__fuel_type_other",
      "Allocation Agreement - Group UUID"."allocation_transaction_type_id" AS "Allocation Agreement - Group UUID__allocation_trans_ad55ef48",
      "Allocation Agreement - Group UUID"."fuel_type_id" AS "Allocation Agreement - Group UUID__fuel_type_id",
      "Allocation Agreement - Group UUID"."fuel_category_id" AS "Allocation Agreement - Group UUID__fuel_category_id",
      "Allocation Agreement - Group UUID"."provision_of_the_act_id" AS "Allocation Agreement - Group UUID__provision_of_the_act_id",
      "Allocation Agreement - Group UUID"."fuel_code_id" AS "Allocation Agreement - Group UUID__fuel_code_id",
      "Allocation Agreement - Group UUID"."compliance_report_id" AS "Allocation Agreement - Group UUID__compliance_report_id",
      "Allocation Agreement - Group UUID"."create_date" AS "Allocation Agreement - Group UUID__create_date",
      "Allocation Agreement - Group UUID"."update_date" AS "Allocation Agreement - Group UUID__update_date",
      "Allocation Agreement - Group UUID"."create_user" AS "Allocation Agreement - Group UUID__create_user",
      "Allocation Agreement - Group UUID"."update_user" AS "Allocation Agreement - Group UUID__update_user",
      "Allocation Agreement - Group UUID"."display_order" AS "Allocation Agreement - Group UUID__display_order",
      "Allocation Agreement - Group UUID"."group_uuid" AS "Allocation Agreement - Group UUID__group_uuid",
      "Allocation Agreement - Group UUID"."version" AS "Allocation Agreement - Group UUID__version",
      "Allocation Agreement - Group UUID"."action_type" AS "Allocation Agreement - Group UUID__action_type",
      "Allocation Agreement - Group UUID"."quantity_not_sold" AS "Allocation Agreement - Group UUID__quantity_not_sold",
      "Compliance Report Base - Compliance Report"."compliance_report_id" AS "Compliance Report Base - Compliance Report__complia_6afb9aaa",
      "Compliance Report Base - Compliance Report"."compliance_period_id" AS "Compliance Report Base - Compliance Report__complia_cda244b4",
      "Compliance Report Base - Compliance Report"."organization_id" AS "Compliance Report Base - Compliance Report__organization_id",
      "Compliance Report Base - Compliance Report"."current_status_id" AS "Compliance Report Base - Compliance Report__current_4315b3a2",
      "Compliance Report Base - Compliance Report"."transaction_id" AS "Compliance Report Base - Compliance Report__transaction_id",
      "Compliance Report Base - Compliance Report"."compliance_report_group_uuid" AS "Compliance Report Base - Compliance Report__complia_8e1217db",
      "Compliance Report Base - Compliance Report"."legacy_id" AS "Compliance Report Base - Compliance Report__legacy_id",
      "Compliance Report Base - Compliance Report"."version" AS "Compliance Report Base - Compliance Report__version",
      "Compliance Report Base - Compliance Report"."supplemental_initiator" AS "Compliance Report Base - Compliance Report__supplem_3e383c17",
      "Compliance Report Base - Compliance Report"."reporting_frequency" AS "Compliance Report Base - Compliance Report__reporti_c3204642",
      "Compliance Report Base - Compliance Report"."nickname" AS "Compliance Report Base - Compliance Report__nickname",
      "Compliance Report Base - Compliance Report"."supplemental_note" AS "Compliance Report Base - Compliance Report__supplem_76c93d97",
      "Compliance Report Base - Compliance Report"."create_date" AS "Compliance Report Base - Compliance Report__create_date",
      "Compliance Report Base - Compliance Report"."update_date" AS "Compliance Report Base - Compliance Report__update_date",
      "Compliance Report Base - Compliance Report"."create_user" AS "Compliance Report Base - Compliance Report__create_user",
      "Compliance Report Base - Compliance Report"."update_user" AS "Compliance Report Base - Compliance Report__update_user",
      "Compliance Report Base - Compliance Report"."assessment_statement" AS "Compliance Report Base - Compliance Report__assessm_7b8d860b",
      "Compliance Report Base - Compliance Report"."Renewable Requirements" AS "Compliance Report Base - Compliance Report__Renewab_f11c34b5",
      "Compliance Report Base - Compliance Report"."Low Carbon Requirements" AS "Compliance Report Base - Compliance Report__Low Car_035b150f",
      "Compliance Report Base - Compliance Report"."Compliance Period__compliance_period_id" AS "Compliance Report Base - Compliance Report__Complia_dd118a33",
      "Compliance Report Base - Compliance Report"."Compliance Period__description" AS "Compliance Report Base - Compliance Report__Complia_cb30ad19",
      "Compliance Report Base - Compliance Report"."Compliance Period__display_order" AS "Compliance Report Base - Compliance Report__Complia_721c9a5e",
      "Compliance Report Base - Compliance Report"."Compliance Period__create_date" AS "Compliance Report Base - Compliance Report__Complia_8deb472c",
      "Compliance Report Base - Compliance Report"."Compliance Period__update_date" AS "Compliance Report Base - Compliance Report__Complia_d8268dda",
      "Compliance Report Base - Compliance Report"."Compliance Period__effective_date" AS "Compliance Report Base - Compliance Report__Complia_6a450a4b",
      "Compliance Report Base - Compliance Report"."Compliance Period__effective_status" AS "Compliance Report Base - Compliance Report__Complia_e535ee64",
      "Compliance Report Base - Compliance Report"."Compliance Period__expiration_date" AS "Compliance Report Base - Compliance Report__Complia_27d99d4c",
      "Compliance Report Base - Compliance Report"."Compliance Report Status - Current Status__complian_8aca39b7" AS "Compliance Report Base - Compliance Report__Complia_35a08ff4",
      "Compliance Report Base - Compliance Report"."Compliance Report Status - Current Status__display_order" AS "Compliance Report Base - Compliance Report__Complia_617d3c08",
      "Compliance Report Base - Compliance Report"."Compliance Report Status - Current Status__status" AS "Compliance Report Base - Compliance Report__Complia_f6d97a34",
      "Compliance Report Base - Compliance Report"."Compliance Report Status - Current Status__create_date" AS "Compliance Report Base - Compliance Report__Complia_de8161a6",
      "Compliance Report Base - Compliance Report"."Compliance Report Status - Current Status__update_date" AS "Compliance Report Base - Compliance Report__Complia_8b4cab50",
      "Compliance Report Base - Compliance Report"."Compliance Report Status - Current Status__effective_date" AS "Compliance Report Base - Compliance Report__Complia_e85e9f2c",
      "Compliance Report Base - Compliance Report"."Compliance Report Status - Current Status__effective_status" AS "Compliance Report Base - Compliance Report__Complia_4fecf6d4",
      "Compliance Report Base - Compliance Report"."Compliance Report Status - Current Status__expiration_date" AS "Compliance Report Base - Compliance Report__Complia_f48d7222",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__summary_id" AS "Compliance Report Base - Compliance Report__Complia_fe5bffa9",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__comp_1db2e1e9" AS "Compliance Report Base - Compliance Report__Complia_ac5855d3",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__quarter" AS "Compliance Report Base - Compliance Report__Complia_716d2691",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__is_locked" AS "Compliance Report Base - Compliance Report__Complia_9880522d",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_2c0818fb" AS "Compliance Report Base - Compliance Report__Complia_e084f95e",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_2ff66c5b" AS "Compliance Report Base - Compliance Report__Complia_bbf3740d",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_1fcf7a18" AS "Compliance Report Base - Compliance Report__Complia_0948e373",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_d70f8aef" AS "Compliance Report Base - Compliance Report__Complia_1151727e",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_2773c83c" AS "Compliance Report Base - Compliance Report__Complia_8c046bfd",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_e4c8e80c" AS "Compliance Report Base - Compliance Report__Complia_0c86fc50",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_9cec896d" AS "Compliance Report Base - Compliance Report__Complia_817c5f4a",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_489bea32" AS "Compliance Report Base - Compliance Report__Complia_d930be19",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_af2beb8e" AS "Compliance Report Base - Compliance Report__Complia_c9668257",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_a26a000d" AS "Compliance Report Base - Compliance Report__Complia_eef8c8e5",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_0ef43e75" AS "Compliance Report Base - Compliance Report__Complia_469410d8",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_91ad62ee" AS "Compliance Report Base - Compliance Report__Complia_169c9f01",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_b1027537" AS "Compliance Report Base - Compliance Report__Complia_ba262a42",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_38be33f3" AS "Compliance Report Base - Compliance Report__Complia_3609a003",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_82c517d4" AS "Compliance Report Base - Compliance Report__Complia_3d0e6803",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_6927f733" AS "Compliance Report Base - Compliance Report__Complia_aad5cfd2",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_93d805cb" AS "Compliance Report Base - Compliance Report__Complia_c437462d",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_5ae095d0" AS "Compliance Report Base - Compliance Report__Complia_6bd2da0d",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_157d6973" AS "Compliance Report Base - Compliance Report__Complia_ed316fbb",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_31fd1f1b" AS "Compliance Report Base - Compliance Report__Complia_2c880057",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_26ba0b90" AS "Compliance Report Base - Compliance Report__Complia_84fd8648",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_27419684" AS "Compliance Report Base - Compliance Report__Complia_c8859563",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_ac263897" AS "Compliance Report Base - Compliance Report__Complia_45fe3e7a",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_1486f467" AS "Compliance Report Base - Compliance Report__Complia_256023d8",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_c12cb8c0" AS "Compliance Report Base - Compliance Report__Complia_eee3c998",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_05eb459f" AS "Compliance Report Base - Compliance Report__Complia_c90c8a63",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_f2ebda23" AS "Compliance Report Base - Compliance Report__Complia_c7afbbd2",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_1be763e7" AS "Compliance Report Base - Compliance Report__Complia_b7c1da7c",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_b72177b0" AS "Compliance Report Base - Compliance Report__Complia_eddee97b",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_28200104" AS "Compliance Report Base - Compliance Report__Complia_656afc20",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_53735f1d" AS "Compliance Report Base - Compliance Report__Complia_5698e212",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_64a07c80" AS "Compliance Report Base - Compliance Report__Complia_91c16e81",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_60b43dfe" AS "Compliance Report Base - Compliance Report__Complia_a38eca8f",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_da2710ad" AS "Compliance Report Base - Compliance Report__Complia_83fb46a6",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_b25fca1c" AS "Compliance Report Base - Compliance Report__Complia_677a2191",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_4b98033f" AS "Compliance Report Base - Compliance Report__Complia_d3db4f29",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_1d7d6a31" AS "Compliance Report Base - Compliance Report__Complia_805e5698",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_684112bb" AS "Compliance Report Base - Compliance Report__Complia_ba662a5c",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_b1d3ad5e" AS "Compliance Report Base - Compliance Report__Complia_407ecab4",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_e173956e" AS "Compliance Report Base - Compliance Report__Complia_884b89fd",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_9a885574" AS "Compliance Report Base - Compliance Report__Complia_6030ea9c",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_8e71546f" AS "Compliance Report Base - Compliance Report__Complia_392f751b",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_00d2728d" AS "Compliance Report Base - Compliance Report__Complia_889450ac",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_29d9cb9c" AS "Compliance Report Base - Compliance Report__Complia_875531b4",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_d8942234" AS "Compliance Report Base - Compliance Report__Complia_ea067573",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_125e31fc" AS "Compliance Report Base - Compliance Report__Complia_a93845e5",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_eb5340d7" AS "Compliance Report Base - Compliance Report__Complia_2ef7cee4",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_bff5157d" AS "Compliance Report Base - Compliance Report__Complia_87c65017",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_7c9c21b1" AS "Compliance Report Base - Compliance Report__Complia_4bc20903",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__tota_0e1e6fb3" AS "Compliance Report Base - Compliance Report__Complia_0dd060c1",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__create_date" AS "Compliance Report Base - Compliance Report__Complia_e63c35ab",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__update_date" AS "Compliance Report Base - Compliance Report__Complia_b3f1ff5d",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__create_user" AS "Compliance Report Base - Compliance Report__Complia_c131d498",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__update_user" AS "Compliance Report Base - Compliance Report__Complia_94fc1e6e",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__earl_6d4994a4" AS "Compliance Report Base - Compliance Report__Complia_df1f10d1",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__earl_f440c51e" AS "Compliance Report Base - Compliance Report__Complia_a759d116",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__earl_8347f588" AS "Compliance Report Base - Compliance Report__Complia_63b4b44e",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__earl_1d23602b" AS "Compliance Report Base - Compliance Report__Complia_05c7a0a8",
      "Compliance Report Base - Compliance Report"."Transaction__transaction_id" AS "Compliance Report Base - Compliance Report__Transac_cf3e7bc2",
      "Compliance Report Base - Compliance Report"."Transaction__compliance_units" AS "Compliance Report Base - Compliance Report__Transac_2787ccf9",
      "Compliance Report Base - Compliance Report"."Transaction__organization_id" AS "Compliance Report Base - Compliance Report__Transac_d7fde363",
      "Compliance Report Base - Compliance Report"."Transaction__transaction_action" AS "Compliance Report Base - Compliance Report__Transac_5afd1852",
      "Compliance Report Base - Compliance Report"."Transaction__create_date" AS "Compliance Report Base - Compliance Report__Transac_1a243093",
      "Compliance Report Base - Compliance Report"."Transaction__update_date" AS "Compliance Report Base - Compliance Report__Transac_4fe9fa65",
      "Compliance Report Base - Compliance Report"."Transaction__create_user" AS "Compliance Report Base - Compliance Report__Transac_3d29d1a0",
      "Compliance Report Base - Compliance Report"."Transaction__update_user" AS "Compliance Report Base - Compliance Report__Transac_68e41b56",
      "Compliance Report Base - Compliance Report"."Transaction__effective_date" AS "Compliance Report Base - Compliance Report__Transac_cfe283e1",
      "Compliance Report Base - Compliance Report"."Transaction__effective_status" AS "Compliance Report Base - Compliance Report__Transac_25b92424",
      "Compliance Report Base - Compliance Report"."Transaction__expiration_date" AS "Compliance Report Base - Compliance Report__Transac_117f7033",
      "Compliance Report Base - Compliance Report"."Organization__organization_id" AS "Compliance Report Base - Compliance Report__Organiz_ea2b8583",
      "Compliance Report Base - Compliance Report"."Organization__organization_code" AS "Compliance Report Base - Compliance Report__Organiz_93047002",
      "Compliance Report Base - Compliance Report"."Organization__name" AS "Compliance Report Base - Compliance Report__Organiz_825c76de",
      "Compliance Report Base - Compliance Report"."Organization__operating_name" AS "Compliance Report Base - Compliance Report__Organiz_1e26fe43",
      "Compliance Report Base - Compliance Report"."Organization__email" AS "Compliance Report Base - Compliance Report__Organiz_6f46599a",
      "Compliance Report Base - Compliance Report"."Organization__phone" AS "Compliance Report Base - Compliance Report__Organiz_cc9bb233",
      "Compliance Report Base - Compliance Report"."Organization__edrms_record" AS "Compliance Report Base - Compliance Report__Organiz_f96b3406",
      "Compliance Report Base - Compliance Report"."Organization__total_balance" AS "Compliance Report Base - Compliance Report__Organiz_5b0e3a8e",
      "Compliance Report Base - Compliance Report"."Organization__reserved_balance" AS "Compliance Report Base - Compliance Report__Organiz_002dae56",
      "Compliance Report Base - Compliance Report"."Organization__count_transfers_in_progress" AS "Compliance Report Base - Compliance Report__Organiz_ddd4cd6e",
      "Compliance Report Base - Compliance Report"."Organization__organization_status_id" AS "Compliance Report Base - Compliance Report__Organiz_4ca3989e",
      "Compliance Report Base - Compliance Report"."Organization__organization_type_id" AS "Compliance Report Base - Compliance Report__Organiz_af01dea6",
      "Compliance Report Base - Compliance Report"."Organization__organization_address_id" AS "Compliance Report Base - Compliance Report__Organiz_57f78a9f",
      "Compliance Report Base - Compliance Report"."Organization__organization_attorney_address_id" AS "Compliance Report Base - Compliance Report__Organiz_b438bcc2",
      "Compliance Report Base - Compliance Report"."Organization__create_date" AS "Compliance Report Base - Compliance Report__Organiz_48401463",
      "Compliance Report Base - Compliance Report"."Organization__update_date" AS "Compliance Report Base - Compliance Report__Organiz_1d8dde95",
      "Compliance Report Base - Compliance Report"."Organization__create_user" AS "Compliance Report Base - Compliance Report__Organiz_6f4df550",
      "Compliance Report Base - Compliance Report"."Organization__update_user" AS "Compliance Report Base - Compliance Report__Organiz_3a803fa6",
      "Compliance Report Base - Compliance Report"."Organization__effective_date" AS "Compliance Report Base - Compliance Report__Organiz_c111b484",
      "Compliance Report Base - Compliance Report"."Organization__effective_status" AS "Compliance Report Base - Compliance Report__Organiz_858e103a",
      "Compliance Report Base - Compliance Report"."Organization__expiration_date" AS "Compliance Report Base - Compliance Report__Organiz_2ca916d3",
      "Compliance Report Base - Compliance Report"."Organization__has_early_issuance" AS "Compliance Report Base - Compliance Report__Organiz_23acfb32",
      "Compliance Report Base - Compliance Report"."Organization__records_address" AS "Compliance Report Base - Compliance Report__Organiz_eb230b97",
      "Compliance Report Base - Compliance Report"."Compliance Reports Chained - Compliance Report Grou_1a77e4cb" AS "Compliance Report Base - Compliance Report__Complia_a81d65f5",
      "Compliance Report Base - Compliance Report"."Compliance Reports Chained - Compliance Report Grou_480bb7b1" AS "Compliance Report Base - Compliance Report__Complia_cfae0019"
    FROM
      (
        SELECT
          "allocation_agreement"."group_uuid" AS "group_uuid",
          MAX("allocation_agreement"."version") AS "max"
        FROM
          "allocation_agreement"
       
GROUP BY
          "allocation_agreement"."group_uuid"
       
ORDER BY
          "allocation_agreement"."group_uuid" ASC
      ) AS "source"
     
LEFT JOIN "allocation_agreement" AS "Allocation Agreement - Group UUID" ON (
        "source"."group_uuid" = "Allocation Agreement - Group UUID"."group_uuid"
      )
     
   AND (
        "source"."max" = "Allocation Agreement - Group UUID"."version"
      )
      LEFT JOIN (
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
          )
      ) AS "Compliance Report Base - Compliance Report" ON "Allocation Agreement - Group UUID"."compliance_report_id" = "Compliance Report Base - Compliance Report"."compliance_report_id";

GRANT SELECT ON vw_allocation_agreement_base TO basic_lcfs_reporting_role;

-- ==========================================
-- Fuel Code Base View
-- ==========================================
drop view if exists vw_fuel_code_base cascade;
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
GRANT SELECT ON fuel_code, fuel_code_prefix, fuel_code_status, fuel_type, fuel_category TO basic_lcfs_reporting_role;
-- ==========================================
-- Compliance Reports List View
-- ==========================================
create or replace view v_compliance_report as
WITH latest_versions AS (
    -- Use window function instead of GROUP BY for better performance
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
    -- Single scan to get both latest and second-latest with their statuses
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
-- Compliance Report Base View With Early Issuance By Year
-- ==========================================
drop view if exists vw_compliance_report_base cascade;
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
      "Compliance Report Summary - Compliance Report"."credits_offset_a" AS "Compliance Report Summary - Compliance Report__cred_0f455db6",
      "Compliance Report Summary - Compliance Report"."credits_offset_b" AS "Compliance Report Summary - Compliance Report__cred_964c0c0c",
      "Compliance Report Summary - Compliance Report"."credits_offset_c" AS "Compliance Report Summary - Compliance Report__cred_e14b3c9a",
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
-- Allocation Agreement Base View With Early Issuance By Year
-- ==========================================
drop view if exists vw_allocation_agreement_base;
CREATE OR REPLACE VIEW vw_allocation_agreement_base AS
SELECT
      "source"."group_uuid" AS "group_uuid",
      "source"."max" AS "max",
      CASE
        WHEN "Allocation Agreement - Group UUID"."allocation_transaction_type_id" = 1 THEN 'Allocated From'
        WHEN "Allocation Agreement - Group UUID"."allocation_transaction_type_id" = 2 THEN 'Allocation To'
      END AS "Allocation transaction type",
      "Allocation Agreement - Group UUID"."allocation_agreement_id" AS "Allocation Agreement - Group UUID__allocation_agreement_id",
      "Allocation Agreement - Group UUID"."transaction_partner" AS "Allocation Agreement - Group UUID__transaction_partner",
      "Allocation Agreement - Group UUID"."postal_address" AS "Allocation Agreement - Group UUID__postal_address",
      "Allocation Agreement - Group UUID"."transaction_partner_email" AS "Allocation Agreement - Group UUID__transaction_partner_email",
      "Allocation Agreement - Group UUID"."transaction_partner_phone" AS "Allocation Agreement - Group UUID__transaction_partner_phone",
      "Allocation Agreement - Group UUID"."ci_of_fuel" AS "Allocation Agreement - Group UUID__ci_of_fuel",
      "Allocation Agreement - Group UUID"."quantity" AS "Allocation Agreement - Group UUID__quantity",
      "Allocation Agreement - Group UUID"."units" AS "Allocation Agreement - Group UUID__units",
      "Allocation Agreement - Group UUID"."fuel_type_other" AS "Allocation Agreement - Group UUID__fuel_type_other",
      "Allocation Agreement - Group UUID"."allocation_transaction_type_id" AS "Allocation Agreement - Group UUID__allocation_trans_ad55ef48",
      "Allocation Agreement - Group UUID"."fuel_type_id" AS "Allocation Agreement - Group UUID__fuel_type_id",
      "Allocation Agreement - Group UUID"."fuel_category_id" AS "Allocation Agreement - Group UUID__fuel_category_id",
      "Allocation Agreement - Group UUID"."provision_of_the_act_id" AS "Allocation Agreement - Group UUID__provision_of_the_act_id",
      "Allocation Agreement - Group UUID"."fuel_code_id" AS "Allocation Agreement - Group UUID__fuel_code_id",
      "Allocation Agreement - Group UUID"."compliance_report_id" AS "Allocation Agreement - Group UUID__compliance_report_id",
      "Allocation Agreement - Group UUID"."create_date" AS "Allocation Agreement - Group UUID__create_date",
      "Allocation Agreement - Group UUID"."update_date" AS "Allocation Agreement - Group UUID__update_date",
      "Allocation Agreement - Group UUID"."create_user" AS "Allocation Agreement - Group UUID__create_user",
      "Allocation Agreement - Group UUID"."update_user" AS "Allocation Agreement - Group UUID__update_user",
      "Allocation Agreement - Group UUID"."display_order" AS "Allocation Agreement - Group UUID__display_order",
      "Allocation Agreement - Group UUID"."group_uuid" AS "Allocation Agreement - Group UUID__group_uuid",
      "Allocation Agreement - Group UUID"."version" AS "Allocation Agreement - Group UUID__version",
      "Allocation Agreement - Group UUID"."action_type" AS "Allocation Agreement - Group UUID__action_type",
      "Allocation Agreement - Group UUID"."quantity_not_sold" AS "Allocation Agreement - Group UUID__quantity_not_sold",
      "Compliance Report Base - Compliance Report"."compliance_report_id" AS "Compliance Report Base - Compliance Report__complia_6afb9aaa",
      "Compliance Report Base - Compliance Report"."compliance_period_id" AS "Compliance Report Base - Compliance Report__complia_cda244b4",
      "Compliance Report Base - Compliance Report"."organization_id" AS "Compliance Report Base - Compliance Report__organization_id",
      "Compliance Report Base - Compliance Report"."current_status_id" AS "Compliance Report Base - Compliance Report__current_4315b3a2",
      "Compliance Report Base - Compliance Report"."transaction_id" AS "Compliance Report Base - Compliance Report__transaction_id",
      "Compliance Report Base - Compliance Report"."compliance_report_group_uuid" AS "Compliance Report Base - Compliance Report__complia_8e1217db",
      "Compliance Report Base - Compliance Report"."legacy_id" AS "Compliance Report Base - Compliance Report__legacy_id",
      "Compliance Report Base - Compliance Report"."version" AS "Compliance Report Base - Compliance Report__version",
      "Compliance Report Base - Compliance Report"."supplemental_initiator" AS "Compliance Report Base - Compliance Report__supplem_3e383c17",
      "Compliance Report Base - Compliance Report"."reporting_frequency" AS "Compliance Report Base - Compliance Report__reporti_c3204642",
      "Compliance Report Base - Compliance Report"."nickname" AS "Compliance Report Base - Compliance Report__nickname",
      "Compliance Report Base - Compliance Report"."supplemental_note" AS "Compliance Report Base - Compliance Report__supplem_76c93d97",
      "Compliance Report Base - Compliance Report"."create_date" AS "Compliance Report Base - Compliance Report__create_date",
      "Compliance Report Base - Compliance Report"."update_date" AS "Compliance Report Base - Compliance Report__update_date",
      "Compliance Report Base - Compliance Report"."create_user" AS "Compliance Report Base - Compliance Report__create_user",
      "Compliance Report Base - Compliance Report"."update_user" AS "Compliance Report Base - Compliance Report__update_user",
      "Compliance Report Base - Compliance Report"."assessment_statement" AS "Compliance Report Base - Compliance Report__assessm_7b8d860b",
      "Compliance Report Base - Compliance Report"."Renewable Requirements" AS "Compliance Report Base - Compliance Report__Renewab_f11c34b5",
      "Compliance Report Base - Compliance Report"."Low Carbon Requirements" AS "Compliance Report Base - Compliance Report__Low Car_035b150f",
      "Compliance Report Base - Compliance Report"."Compliance Period__compliance_period_id" AS "Compliance Report Base - Compliance Report__Complia_dd118a33",
      "Compliance Report Base - Compliance Report"."Compliance Period__description" AS "Compliance Report Base - Compliance Report__Complia_cb30ad19",
      "Compliance Report Base - Compliance Report"."Compliance Period__display_order" AS "Compliance Report Base - Compliance Report__Complia_721c9a5e",
      "Compliance Report Base - Compliance Report"."Compliance Period__create_date" AS "Compliance Report Base - Compliance Report__Complia_8deb472c",
      "Compliance Report Base - Compliance Report"."Compliance Period__update_date" AS "Compliance Report Base - Compliance Report__Complia_d8268dda",
      "Compliance Report Base - Compliance Report"."Compliance Period__effective_date" AS "Compliance Report Base - Compliance Report__Complia_6a450a4b",
      "Compliance Report Base - Compliance Report"."Compliance Period__effective_status" AS "Compliance Report Base - Compliance Report__Complia_e535ee64",
      "Compliance Report Base - Compliance Report"."Compliance Period__expiration_date" AS "Compliance Report Base - Compliance Report__Complia_27d99d4c",
      "Compliance Report Base - Compliance Report"."Compliance Report Status - Current Status__complian_8aca39b7" AS "Compliance Report Base - Compliance Report__Complia_35a08ff4",
      "Compliance Report Base - Compliance Report"."Compliance Report Status - Current Status__display_order" AS "Compliance Report Base - Compliance Report__Complia_617d3c08",
      "Compliance Report Base - Compliance Report"."Compliance Report Status - Current Status__status" AS "Compliance Report Base - Compliance Report__Complia_f6d97a34",
      "Compliance Report Base - Compliance Report"."Compliance Report Status - Current Status__create_date" AS "Compliance Report Base - Compliance Report__Complia_de8161a6",
      "Compliance Report Base - Compliance Report"."Compliance Report Status - Current Status__update_date" AS "Compliance Report Base - Compliance Report__Complia_8b4cab50",
      "Compliance Report Base - Compliance Report"."Compliance Report Status - Current Status__effective_date" AS "Compliance Report Base - Compliance Report__Complia_e85e9f2c",
      "Compliance Report Base - Compliance Report"."Compliance Report Status - Current Status__effective_status" AS "Compliance Report Base - Compliance Report__Complia_4fecf6d4",
      "Compliance Report Base - Compliance Report"."Compliance Report Status - Current Status__expiration_date" AS "Compliance Report Base - Compliance Report__Complia_f48d7222",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__summary_id" AS "Compliance Report Base - Compliance Report__Complia_fe5bffa9",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__comp_1db2e1e9" AS "Compliance Report Base - Compliance Report__Complia_ac5855d3",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__quarter" AS "Compliance Report Base - Compliance Report__Complia_716d2691",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__is_locked" AS "Compliance Report Base - Compliance Report__Complia_9880522d",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_2c0818fb" AS "Compliance Report Base - Compliance Report__Complia_e084f95e",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_2ff66c5b" AS "Compliance Report Base - Compliance Report__Complia_bbf3740d",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_1fcf7a18" AS "Compliance Report Base - Compliance Report__Complia_0948e373",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_d70f8aef" AS "Compliance Report Base - Compliance Report__Complia_1151727e",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_2773c83c" AS "Compliance Report Base - Compliance Report__Complia_8c046bfd",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_e4c8e80c" AS "Compliance Report Base - Compliance Report__Complia_0c86fc50",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_9cec896d" AS "Compliance Report Base - Compliance Report__Complia_817c5f4a",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_489bea32" AS "Compliance Report Base - Compliance Report__Complia_d930be19",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_af2beb8e" AS "Compliance Report Base - Compliance Report__Complia_c9668257",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_a26a000d" AS "Compliance Report Base - Compliance Report__Complia_eef8c8e5",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_0ef43e75" AS "Compliance Report Base - Compliance Report__Complia_469410d8",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_91ad62ee" AS "Compliance Report Base - Compliance Report__Complia_169c9f01",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_b1027537" AS "Compliance Report Base - Compliance Report__Complia_ba262a42",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_38be33f3" AS "Compliance Report Base - Compliance Report__Complia_3609a003",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_82c517d4" AS "Compliance Report Base - Compliance Report__Complia_3d0e6803",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_6927f733" AS "Compliance Report Base - Compliance Report__Complia_aad5cfd2",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_93d805cb" AS "Compliance Report Base - Compliance Report__Complia_c437462d",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_5ae095d0" AS "Compliance Report Base - Compliance Report__Complia_6bd2da0d",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_157d6973" AS "Compliance Report Base - Compliance Report__Complia_ed316fbb",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_31fd1f1b" AS "Compliance Report Base - Compliance Report__Complia_2c880057",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_26ba0b90" AS "Compliance Report Base - Compliance Report__Complia_84fd8648",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_27419684" AS "Compliance Report Base - Compliance Report__Complia_c8859563",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_ac263897" AS "Compliance Report Base - Compliance Report__Complia_45fe3e7a",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_1486f467" AS "Compliance Report Base - Compliance Report__Complia_256023d8",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_c12cb8c0" AS "Compliance Report Base - Compliance Report__Complia_eee3c998",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_05eb459f" AS "Compliance Report Base - Compliance Report__Complia_c90c8a63",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_f2ebda23" AS "Compliance Report Base - Compliance Report__Complia_c7afbbd2",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_1be763e7" AS "Compliance Report Base - Compliance Report__Complia_b7c1da7c",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_b72177b0" AS "Compliance Report Base - Compliance Report__Complia_eddee97b",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_28200104" AS "Compliance Report Base - Compliance Report__Complia_656afc20",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_53735f1d" AS "Compliance Report Base - Compliance Report__Complia_5698e212",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_64a07c80" AS "Compliance Report Base - Compliance Report__Complia_91c16e81",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_60b43dfe" AS "Compliance Report Base - Compliance Report__Complia_a38eca8f",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_da2710ad" AS "Compliance Report Base - Compliance Report__Complia_83fb46a6",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_b25fca1c" AS "Compliance Report Base - Compliance Report__Complia_677a2191",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_4b98033f" AS "Compliance Report Base - Compliance Report__Complia_d3db4f29",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_1d7d6a31" AS "Compliance Report Base - Compliance Report__Complia_805e5698",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_684112bb" AS "Compliance Report Base - Compliance Report__Complia_ba662a5c",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_b1d3ad5e" AS "Compliance Report Base - Compliance Report__Complia_407ecab4",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_e173956e" AS "Compliance Report Base - Compliance Report__Complia_884b89fd",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_9a885574" AS "Compliance Report Base - Compliance Report__Complia_6030ea9c",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_8e71546f" AS "Compliance Report Base - Compliance Report__Complia_392f751b",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_00d2728d" AS "Compliance Report Base - Compliance Report__Complia_889450ac",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_29d9cb9c" AS "Compliance Report Base - Compliance Report__Complia_875531b4",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_d8942234" AS "Compliance Report Base - Compliance Report__Complia_ea067573",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_125e31fc" AS "Compliance Report Base - Compliance Report__Complia_a93845e5",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_eb5340d7" AS "Compliance Report Base - Compliance Report__Complia_2ef7cee4",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_bff5157d" AS "Compliance Report Base - Compliance Report__Complia_87c65017",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__line_7c9c21b1" AS "Compliance Report Base - Compliance Report__Complia_4bc20903",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__tota_0e1e6fb3" AS "Compliance Report Base - Compliance Report__Complia_0dd060c1",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__cred_0f455db6" AS "Compliance Report Base - Compliance Report__Complia_e72f37f4",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__cred_964c0c0c" AS "Compliance Report Base - Compliance Report__Complia_cdfb8319",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__cred_e14b3c9a" AS "Compliance Report Base - Compliance Report__Complia_1acc0725",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__create_date" AS "Compliance Report Base - Compliance Report__Complia_e63c35ab",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__update_date" AS "Compliance Report Base - Compliance Report__Complia_b3f1ff5d",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__create_user" AS "Compliance Report Base - Compliance Report__Complia_c131d498",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__update_user" AS "Compliance Report Base - Compliance Report__Complia_94fc1e6e",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__earl_6d4994a4" AS "Compliance Report Base - Compliance Report__Complia_df1f10d1",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__earl_f440c51e" AS "Compliance Report Base - Compliance Report__Complia_a759d116",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__earl_8347f588" AS "Compliance Report Base - Compliance Report__Complia_63b4b44e",
      "Compliance Report Base - Compliance Report"."Compliance Report Summary - Compliance Report__earl_1d23602b" AS "Compliance Report Base - Compliance Report__Complia_05c7a0a8",
      "Compliance Report Base - Compliance Report"."Transaction__transaction_id" AS "Compliance Report Base - Compliance Report__Transac_cf3e7bc2",
      "Compliance Report Base - Compliance Report"."Transaction__compliance_units" AS "Compliance Report Base - Compliance Report__Transac_2787ccf9",
      "Compliance Report Base - Compliance Report"."Transaction__organization_id" AS "Compliance Report Base - Compliance Report__Transac_d7fde363",
      "Compliance Report Base - Compliance Report"."Transaction__transaction_action" AS "Compliance Report Base - Compliance Report__Transac_5afd1852",
      "Compliance Report Base - Compliance Report"."Transaction__create_date" AS "Compliance Report Base - Compliance Report__Transac_1a243093",
      "Compliance Report Base - Compliance Report"."Transaction__update_date" AS "Compliance Report Base - Compliance Report__Transac_4fe9fa65",
      "Compliance Report Base - Compliance Report"."Transaction__create_user" AS "Compliance Report Base - Compliance Report__Transac_3d29d1a0",
      "Compliance Report Base - Compliance Report"."Transaction__update_user" AS "Compliance Report Base - Compliance Report__Transac_68e41b56",
      "Compliance Report Base - Compliance Report"."Transaction__effective_date" AS "Compliance Report Base - Compliance Report__Transac_cfe283e1",
      "Compliance Report Base - Compliance Report"."Transaction__effective_status" AS "Compliance Report Base - Compliance Report__Transac_25b92424",
      "Compliance Report Base - Compliance Report"."Transaction__expiration_date" AS "Compliance Report Base - Compliance Report__Transac_117f7033",
      "Compliance Report Base - Compliance Report"."Organization__organization_id" AS "Compliance Report Base - Compliance Report__Organiz_ea2b8583",
      "Compliance Report Base - Compliance Report"."Organization__organization_code" AS "Compliance Report Base - Compliance Report__Organiz_93047002",
      "Compliance Report Base - Compliance Report"."Organization__name" AS "Compliance Report Base - Compliance Report__Organiz_825c76de",
      "Compliance Report Base - Compliance Report"."Organization__operating_name" AS "Compliance Report Base - Compliance Report__Organiz_1e26fe43",
      "Compliance Report Base - Compliance Report"."Organization__email" AS "Compliance Report Base - Compliance Report__Organiz_6f46599a",
      "Compliance Report Base - Compliance Report"."Organization__phone" AS "Compliance Report Base - Compliance Report__Organiz_cc9bb233",
      "Compliance Report Base - Compliance Report"."Organization__edrms_record" AS "Compliance Report Base - Compliance Report__Organiz_f96b3406",
      "Compliance Report Base - Compliance Report"."Organization__total_balance" AS "Compliance Report Base - Compliance Report__Organiz_5b0e3a8e",
      "Compliance Report Base - Compliance Report"."Organization__reserved_balance" AS "Compliance Report Base - Compliance Report__Organiz_002dae56",
      "Compliance Report Base - Compliance Report"."Organization__count_transfers_in_progress" AS "Compliance Report Base - Compliance Report__Organiz_ddd4cd6e",
      "Compliance Report Base - Compliance Report"."Organization__organization_status_id" AS "Compliance Report Base - Compliance Report__Organiz_4ca3989e",
      "Compliance Report Base - Compliance Report"."Organization__organization_type_id" AS "Compliance Report Base - Compliance Report__Organiz_af01dea6",
      "Compliance Report Base - Compliance Report"."Organization__organization_address_id" AS "Compliance Report Base - Compliance Report__Organiz_57f78a9f",
      "Compliance Report Base - Compliance Report"."Organization__organization_attorney_address_id" AS "Compliance Report Base - Compliance Report__Organiz_b438bcc2",
      "Compliance Report Base - Compliance Report"."Organization__create_date" AS "Compliance Report Base - Compliance Report__Organiz_48401463",
      "Compliance Report Base - Compliance Report"."Organization__update_date" AS "Compliance Report Base - Compliance Report__Organiz_1d8dde95",
      "Compliance Report Base - Compliance Report"."Organization__create_user" AS "Compliance Report Base - Compliance Report__Organiz_6f4df550",
      "Compliance Report Base - Compliance Report"."Organization__update_user" AS "Compliance Report Base - Compliance Report__Organiz_3a803fa6",
      "Compliance Report Base - Compliance Report"."Organization__effective_date" AS "Compliance Report Base - Compliance Report__Organiz_c111b484",
      "Compliance Report Base - Compliance Report"."Organization__effective_status" AS "Compliance Report Base - Compliance Report__Organiz_858e103a",
      "Compliance Report Base - Compliance Report"."Organization__expiration_date" AS "Compliance Report Base - Compliance Report__Organiz_2ca916d3",
      "Compliance Report Base - Compliance Report"."Organization__has_early_issuance" AS "Compliance Report Base - Compliance Report__Organiz_23acfb32",
      "Compliance Report Base - Compliance Report"."Organization__records_address" AS "Compliance Report Base - Compliance Report__Organiz_eb230b97",
      "Compliance Report Base - Compliance Report"."Compliance Reports Chained - Compliance Report Grou_1a77e4cb" AS "Compliance Report Base - Compliance Report__Complia_a81d65f5",
      "Compliance Report Base - Compliance Report"."Compliance Reports Chained - Compliance Report Grou_480bb7b1" AS "Compliance Report Base - Compliance Report__Complia_cfae0019"
    FROM
      (
        SELECT
          "allocation_agreement"."group_uuid" AS "group_uuid",
          MAX("allocation_agreement"."version") AS "max"
        FROM
          "allocation_agreement"
        GROUP BY
          "allocation_agreement"."group_uuid"
        ORDER BY
          "allocation_agreement"."group_uuid" ASC
      ) AS "source"
      LEFT JOIN "allocation_agreement" AS "Allocation Agreement - Group UUID" ON (
        "source"."group_uuid" = "Allocation Agreement - Group UUID"."group_uuid"
      )
      AND (
        "source"."max" = "Allocation Agreement - Group UUID"."version"
      )
      LEFT JOIN (
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
          "Compliance Report Summary - Compliance Report"."credits_offset_a" AS "Compliance Report Summary - Compliance Report__cred_0f455db6",
          "Compliance Report Summary - Compliance Report"."credits_offset_b" AS "Compliance Report Summary - Compliance Report__cred_964c0c0c",
          "Compliance Report Summary - Compliance Report"."credits_offset_c" AS "Compliance Report Summary - Compliance Report__cred_e14b3c9a",
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
          )
      ) AS "Compliance Report Base - Compliance Report" ON "Allocation Agreement - Group UUID"."compliance_report_id" = "Compliance Report Base - Compliance Report"."compliance_report_id";

GRANT SELECT ON vw_allocation_agreement_base TO basic_lcfs_reporting_role;

-- ==========================================
-- Fuel Export Analytics Base View
-- ==========================================
drop view if exists vw_fuel_export_analytics_base;
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

grant select on vw_fuel_export_analytics_base to basic_lcfs_reporting_role;
