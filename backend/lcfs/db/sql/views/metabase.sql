-- ==========================================
-- Compliance Reports Analytics View
-- ==========================================
drop view if exists vw_compliance_report_base cascade;
CREATE OR REPLACE VIEW vw_compliance_report_base AS
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

GRANT SELECT ON vw_compliance_report_base, compliance_report_history TO basic_lcfs_reporting_role;

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
        vw_compliance_report_base cr
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
    JOIN vw_compliance_report_base cr ON cr.compliance_report_id = lh.compliance_report_id
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
    CASE WHEN transfer.transfer_id > 3066 THEN
        coalesce(transfer.effective_date, transfer_history.create_date)
    ELSE
        coalesce(transfer.effective_date, transfer.transaction_effective_date, transfer_history.create_date)
    END AS "Calculated Effective Date",
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
          vw_compliance_report_base vcrb
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
  JOIN vw_compliance_report_base vcrb ON vcrb.compliance_report_group_uuid = gr.compliance_report_group_uuid
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
      "source"."group_uuid" AS "group_uuid",
      "source"."version" AS "version",
      "source"."action_type" AS "action_type",
      "source"."create_date" AS "create_date",
      "source"."create_user" AS "create_user",
      "source"."create_user_full_name" AS "create_user_full_name",
      "source"."update_date" AS "update_date",
      "source"."update_user" AS "update_user",
      "source"."update_user_full_name" AS "update_user_full_name",
      "Fuel Code - fuel_code_id"."fuel_code_id" AS "FC - id__fuel_code_id",
      "Fuel Code - fuel_code_id"."fuel_status_id" AS "FC - id__fuel_status_id",
      "Fuel Code - fuel_code_id"."prefix_id" AS "FC - id__prefix_id",
      "Fuel Code - fuel_code_id"."fuel_suffix" AS "FC - id__fuel_suffix",
      "Fuel Code - fuel_code_id"."company" AS "FC - id__company",
      "Fuel Code - fuel_code_id"."contact_name" AS "FC - id__contact_name",
      "Fuel Code - fuel_code_id"."contact_email" AS "FC - id__contact_email",
      "Fuel Code - fuel_code_id"."carbon_intensity" AS "FC - id__carbon_intensity",
      "Fuel Code - fuel_code_id"."edrms" AS "FC - id__edrms",
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
      "Fuel Code - fuel_code_id"."facility_nameplate_capacity_unit" AS "FC - id__facility_nameplate_capacity_unit",
      "Fuel Code - fuel_code_id"."former_company" AS "FC - id__former_company",
      "Fuel Code - fuel_code_id"."notes" AS "FC - id__notes",
      "Fuel Code - fuel_code_id"."create_date" AS "FC - id__create_date",
      "Fuel Code - fuel_code_id"."update_date" AS "FC - id__update_date",
      "Fuel Code - fuel_code_id"."create_user" AS "FC - id__create_user",
      "Fuel Code - fuel_code_id"."update_user" AS "FC - id__update_user",
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
          fuel_supply.fuel_type_other,
          -------------------------------------------------
          -- Versioning columns
          -------------------------------------------------
          fuel_supply.group_uuid,
          fuel_supply.version,
          fuel_supply.action_type,
          -------------------------------------------------
          -- Timestamps & user references
          -------------------------------------------------
          fuel_supply.create_date,
          fuel_supply.create_user,
          up_create.first_name || ' ' || up_create.last_name AS create_user_full_name,
          fuel_supply.update_date,
          fuel_supply.update_user,
          up_update.first_name || ' ' || up_update.last_name AS update_user_full_name
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
          LEFT JOIN user_profile up_create ON fuel_supply.create_user = up_create.keycloak_username
          LEFT JOIN user_profile up_update ON fuel_supply.update_user = up_update.keycloak_username
       
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
      fuel_supply.fuel_type_other,
      fuel_supply.group_uuid,
      fuel_supply.version,
      fuel_supply.action_type,
      fuel_supply.create_date,
      fuel_supply.create_user,
      up_create.first_name || ' ' || up_create.last_name AS create_user_full_name,
      fuel_supply.update_date,
      fuel_supply.update_user,
      up_update.first_name || ' ' || up_update.last_name AS update_user_full_name
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
      LEFT JOIN user_profile up_create ON fuel_supply.create_user = up_create.keycloak_username
      LEFT JOIN user_profile up_update ON fuel_supply.update_user = up_update.keycloak_username
   
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
      "source"."create_date" AS "create_date",
      "source"."update_date" AS "update_date",
      "source"."create_user" AS "create_user",
      "source"."update_user" AS "update_user",
      "source"."group_uuid" AS "group_uuid",
      "source"."version" AS "version",
      "source"."action_type" AS "action_type",
      "source"."q1_quantity" AS "q1_quantity",
      "source"."q2_quantity" AS "q2_quantity",
      "source"."q3_quantity" AS "q3_quantity",
      "source"."q4_quantity" AS "q4_quantity",
      "source"."Latest Fuel Supply per Group - Version__group_uuid" AS "Latest Fuel Supply per Group - Version__group_uuid",
      "source"."Latest Fuel Supply per Group - Version__max" AS "Latest Fuel Supply per Group - Version__max",
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
          "fuel_supply"."create_date" AS "create_date",
          "fuel_supply"."update_date" AS "update_date",
          "fuel_supply"."create_user" AS "create_user",
          "fuel_supply"."update_user" AS "update_user",
          "fuel_supply"."group_uuid" AS "group_uuid",
          "fuel_supply"."version" AS "version",
          "fuel_supply"."action_type" AS "action_type",
          "fuel_supply"."q1_quantity" AS "q1_quantity",
          "fuel_supply"."q2_quantity" AS "q2_quantity",
          "fuel_supply"."q3_quantity" AS "q3_quantity",
          "fuel_supply"."q4_quantity" AS "q4_quantity",
          "Latest Fuel Supply per Group - Version"."group_uuid" AS "Latest Fuel Supply per Group - Version__group_uuid",
          "Latest Fuel Supply per Group - Version"."max" AS "Latest Fuel Supply per Group - Version__max"
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
      "Compliance Report Status - Current Status"."compliance_report_status_id" AS "CR Status - Current Status__compliance_report_status_id",
      "Compliance Report Status - Current Status"."display_order" AS "CR Status - Current Status__display_order",
      "Compliance Report Status - Current Status"."status" AS "CR Status - Current Status__status",
      "Compliance Report Status - Current Status"."create_date" AS "CR Status - Current Status__create_date",
      "Compliance Report Status - Current Status"."update_date" AS "CR Status - Current Status__update_date",
      "Compliance Report Status - Current Status"."effective_date" AS "CR Status - Current Status__effective_date",
      "Compliance Report Status - Current Status"."effective_status" AS "CR Status - Current Status__effective_status",
      "Compliance Report Status - Current Status"."expiration_date" AS "CR Status - Current Status__expiration_date",
      "Compliance Report Summary - Compliance Report"."summary_id" AS "CR Summary - summary_id",
      "Compliance Report Summary - Compliance Report"."compliance_report_id" AS "CR Summary - compliance_report_id",
      "Compliance Report Summary - Compliance Report"."quarter" AS "CR Summary - quarter",
      "Compliance Report Summary - Compliance Report"."is_locked" AS "CR Summary - is_locked",
      "Compliance Report Summary - Compliance Report"."line_1_fossil_derived_base_fuel_gasoline" AS "CR Summary - line_1_fossil_derived_base_fuel_gasoline",
      "Compliance Report Summary - Compliance Report"."line_1_fossil_derived_base_fuel_diesel" AS "CR Summary - line_1_fossil_derived_base_fuel_diesel",
      "Compliance Report Summary - Compliance Report"."line_1_fossil_derived_base_fuel_jet_fuel" AS "CR Summary - line_1_fossil_derived_base_fuel_jet_fuel",
      "Compliance Report Summary - Compliance Report"."line_2_eligible_renewable_fuel_supplied_gasoline" AS "CR Summary - line_2_eligible_renewable_fs_gasoline",
      "Compliance Report Summary - Compliance Report"."line_2_eligible_renewable_fuel_supplied_diesel" AS "CR Summary - line_2_eligible_renewable_fs_diesel",
      "Compliance Report Summary - Compliance Report"."line_2_eligible_renewable_fuel_supplied_jet_fuel" AS "CR Summary - line_2_eligible_renewable_fs_jet_fuel",
      "Compliance Report Summary - Compliance Report"."line_3_total_tracked_fuel_supplied_gasoline" AS "CR Summary - line_3_total_tracked_fs_gasoline",
      "Compliance Report Summary - Compliance Report"."line_3_total_tracked_fuel_supplied_diesel" AS "CR Summary - line_3_total_tracked_fs_diesel",
      "Compliance Report Summary - Compliance Report"."line_3_total_tracked_fuel_supplied_jet_fuel" AS "CR Summary - line_3_total_tracked_fs_jet_fuel",
      "Compliance Report Summary - Compliance Report"."line_4_eligible_renewable_fuel_required_gasoline" AS "CR Summary - line_4_eligible_renewable_fuel_req_gasoline",
      "Compliance Report Summary - Compliance Report"."line_4_eligible_renewable_fuel_required_diesel" AS "CR Summary - line_4_eligible_renewable_fuel_req_diesel",
      "Compliance Report Summary - Compliance Report"."line_4_eligible_renewable_fuel_required_jet_fuel" AS "CR Summary - line_4_eligible_renewable_fuel_req_jet_fuel",
      "Compliance Report Summary - Compliance Report"."line_5_net_notionally_transferred_gasoline" AS "CR Summary - line_5_net_notionally_transferred_gasoline",
      "Compliance Report Summary - Compliance Report"."line_5_net_notionally_transferred_diesel" AS "CR Summary - line_5_net_notionally_transferred_diesel",
      "Compliance Report Summary - Compliance Report"."line_5_net_notionally_transferred_jet_fuel" AS "CR Summary - line_5_net_notionally_transferred_jet_fuel",
      "Compliance Report Summary - Compliance Report"."line_6_renewable_fuel_retained_gasoline" AS "CR Summary - line_6_renewable_fuel_retained_gasoline",
      "Compliance Report Summary - Compliance Report"."line_6_renewable_fuel_retained_diesel" AS "CR Summary - line_6_renewable_fuel_retained_diesel",
      "Compliance Report Summary - Compliance Report"."line_6_renewable_fuel_retained_jet_fuel" AS "CR Summary - line_6_renewable_fuel_retained_jet_fuel",
      "Compliance Report Summary - Compliance Report"."line_7_previously_retained_gasoline" AS "CR Summary - line_7_previously_retained_gasoline",
      "Compliance Report Summary - Compliance Report"."line_7_previously_retained_diesel" AS "CR Summary - line_7_previously_retained_diesel",
      "Compliance Report Summary - Compliance Report"."line_7_previously_retained_jet_fuel" AS "CR Summary - line_7_previously_retained_jet_fuel",
      "Compliance Report Summary - Compliance Report"."line_8_obligation_deferred_gasoline" AS "CR Summary - line_8_obligation_deferred_gasoline",
      "Compliance Report Summary - Compliance Report"."line_8_obligation_deferred_diesel" AS "CR Summary - line_8_obligation_deferred_diesel",
      "Compliance Report Summary - Compliance Report"."line_8_obligation_deferred_jet_fuel" AS "CR Summary - line_8_obligation_deferred_jet_fuel",
      "Compliance Report Summary - Compliance Report"."line_9_obligation_added_gasoline" AS "CR Summary - line_9_obligation_added_gasoline",
      "Compliance Report Summary - Compliance Report"."line_9_obligation_added_diesel" AS "CR Summary - line_9_obligation_added_diesel",
      "Compliance Report Summary - Compliance Report"."line_9_obligation_added_jet_fuel" AS "CR Summary - line_9_obligation_added_jet_fuel",
      "Compliance Report Summary - Compliance Report"."line_10_net_renewable_fuel_supplied_gasoline" AS "CR Summary - line_10_net_renewable_fuel_supplied_gasoline",
      "Compliance Report Summary - Compliance Report"."line_10_net_renewable_fuel_supplied_diesel" AS "CR Summary - line_10_net_renewable_fuel_supplied_diesel",
      "Compliance Report Summary - Compliance Report"."line_10_net_renewable_fuel_supplied_jet_fuel" AS "CR Summary - line_10_net_renewable_fuel_supplied_jet_fuel",
      "Compliance Report Summary - Compliance Report"."line_11_non_compliance_penalty_gasoline" AS "CR Summary - line_11_non_compliance_penalty_gasoline",
      "Compliance Report Summary - Compliance Report"."line_11_non_compliance_penalty_diesel" AS "CR Summary - line_11_non_compliance_penalty_diesel",
      "Compliance Report Summary - Compliance Report"."line_11_non_compliance_penalty_jet_fuel" AS "CR Summary - line_11_non_compliance_penalty_jet_fuel",
      "Compliance Report Summary - Compliance Report"."line_12_low_carbon_fuel_required" AS "CR Summary - line_12_low_carbon_fuel_required",
      "Compliance Report Summary - Compliance Report"."line_13_low_carbon_fuel_supplied" AS "CR Summary - line_13_low_carbon_fuel_supplied",
      "Compliance Report Summary - Compliance Report"."line_14_low_carbon_fuel_surplus" AS "CR Summary - line_14_low_carbon_fuel_surplus",
      "Compliance Report Summary - Compliance Report"."line_15_banked_units_used" AS "CR Summary - line_15_banked_units_used",
      "Compliance Report Summary - Compliance Report"."line_16_banked_units_remaining" AS "CR Summary - line_16_banked_units_remaining",
      "Compliance Report Summary - Compliance Report"."line_17_non_banked_units_used" AS "CR Summary - line_17_non_banked_units_used",
      "Compliance Report Summary - Compliance Report"."line_18_units_to_be_banked" AS "CR Summary - line_18_units_to_be_banked",
      "Compliance Report Summary - Compliance Report"."line_19_units_to_be_exported" AS "CR Summary - line_19_units_to_be_exported",
      "Compliance Report Summary - Compliance Report"."line_20_surplus_deficit_units" AS "CR Summary - line_20_surplus_deficit_units",
      "Compliance Report Summary - Compliance Report"."line_21_surplus_deficit_ratio" AS "CR Summary - line_21_surplus_deficit_ratio",
      "Compliance Report Summary - Compliance Report"."line_22_compliance_units_issued" AS "CR Summary - line_22_compliance_units_issued",
      "Compliance Report Summary - Compliance Report"."line_11_fossil_derived_base_fuel_gasoline" AS "CR Summary - line_11_fossil_derived_base_fuel_gasoline",
      "Compliance Report Summary - Compliance Report"."line_11_fossil_derived_base_fuel_diesel" AS "CR Summary - line_11_fossil_derived_base_fuel_diesel",
      "Compliance Report Summary - Compliance Report"."line_11_fossil_derived_base_fuel_jet_fuel" AS "CR Summary - line_11_fossil_derived_base_fuel_jet_fuel",
      "Compliance Report Summary - Compliance Report"."line_11_fossil_derived_base_fuel_total" AS "CR Summary - line_11_fossil_derived_base_fuel_total",
      "Compliance Report Summary - Compliance Report"."line_21_non_compliance_penalty_payable" AS "CR Summary - line_21_non_compliance_penalty_payable",
      "Compliance Report Summary - Compliance Report"."total_non_compliance_penalty_payable" AS "CR Summary - total_non_compliance_penalty_payable",
      "Compliance Report Summary - Compliance Report"."credits_offset_a" AS "CR Summary - credits_offset_a",
      "Compliance Report Summary - Compliance Report"."credits_offset_b" AS "CR Summary - credits_offset_b",
      "Compliance Report Summary - Compliance Report"."credits_offset_c" AS "CR Summary - credits_offset_c",
      "Compliance Report Summary - Compliance Report"."create_date" AS "CR Summary - create_date",
      "Compliance Report Summary - Compliance Report"."update_date" AS "CR Summary - update_date",
      "Compliance Report Summary - Compliance Report"."create_user" AS "CR Summary - create_user",
      "Compliance Report Summary - Compliance Report"."update_user" AS "CR Summary - update_user",
      "Compliance Report Summary - Compliance Report"."early_issuance_credits_q1" AS "CR Summary - early_issuance_credits_q1",
      "Compliance Report Summary - Compliance Report"."early_issuance_credits_q2" AS "CR Summary - early_issuance_credits_q2",
      "Compliance Report Summary - Compliance Report"."early_issuance_credits_q3" AS "CR Summary - early_issuance_credits_q3",
      "Compliance Report Summary - Compliance Report"."early_issuance_credits_q4" AS "CR Summary - early_issuance_credits_q4",
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
      "Organization"."has_early_issuance" AS "Organization__has_early_issuance",
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
SELECT
      "source"."group_uuid" AS "group_uuid",
      "source"."max" AS "max",
      CASE
        WHEN "Allocation Agreement - Group UUID"."allocation_transaction_type_id" = 1 THEN 'Allocated From'
        WHEN "Allocation Agreement - Group UUID"."allocation_transaction_type_id" = 2 THEN 'Allocation To'
      END AS "Allocation transaction type",
      "Allocation Agreement - Group UUID"."allocation_agreement_id" AS "AA - Group UUID__allocation_agreement_id",
      "Allocation Agreement - Group UUID"."transaction_partner" AS "AA - Group UUID__transaction_partner",
      "Allocation Agreement - Group UUID"."postal_address" AS "AA - Group UUID__postal_address",
      "Allocation Agreement - Group UUID"."transaction_partner_email" AS "AA - Group UUID__transaction_partner_email",
      "Allocation Agreement - Group UUID"."transaction_partner_phone" AS "AA - Group UUID__transaction_partner_phone",
      "Allocation Agreement - Group UUID"."ci_of_fuel" AS "AA - Group UUID__ci_of_fuel",
      "Allocation Agreement - Group UUID"."quantity" AS "AA - Group UUID__quantity",
      "Allocation Agreement - Group UUID"."units" AS "AA - Group UUID__units",
      "Allocation Agreement - Group UUID"."fuel_type_other" AS "AA - Group UUID__fuel_type_other",
      "Allocation Agreement - Group UUID"."allocation_transaction_type_id" AS "AA - Group UUID__allocation_transaction_type_id",
      "Allocation Agreement - Group UUID"."fuel_type_id" AS "AA - Group UUID__fuel_type_id",
      "Allocation Agreement - Group UUID"."fuel_category_id" AS "AA - Group UUID__fuel_category_id",
      "Allocation Agreement - Group UUID"."provision_of_the_act_id" AS "AA - Group UUID__provision_of_the_act_id",
      "Allocation Agreement - Group UUID"."fuel_code_id" AS "AA - Group UUID__fuel_code_id",
      "Allocation Agreement - Group UUID"."compliance_report_id" AS "AA - Group UUID__compliance_report_id",
      "Allocation Agreement - Group UUID"."create_date" AS "AA - Group UUID__create_date",
      "Allocation Agreement - Group UUID"."update_date" AS "AA - Group UUID__update_date",
      "Allocation Agreement - Group UUID"."create_user" AS "AA - Group UUID__create_user",
      "Allocation Agreement - Group UUID"."update_user" AS "AA - Group UUID__update_user",
      "Allocation Agreement - Group UUID"."display_order" AS "AA - Group UUID__display_order",
      "Allocation Agreement - Group UUID"."group_uuid" AS "AA - Group UUID__group_uuid",
      "Allocation Agreement - Group UUID"."version" AS "AA - Group UUID__version",
      "Allocation Agreement - Group UUID"."action_type" AS "AA - Group UUID__action_type",
      "Allocation Agreement - Group UUID"."quantity_not_sold" AS "AA - Group UUID__quantity_not_sold",
      "Compliance Report Base - Compliance Report"."compliance_report_id" AS "CR Base - compliance_report_id",
      "Compliance Report Base - Compliance Report"."compliance_period_id" AS "CR Base - compliance_period_id",
      "Compliance Report Base - Compliance Report"."organization_id" AS "CR Base - organization_id",
      "Compliance Report Base - Compliance Report"."current_status_id" AS "CR Base - current_status_id",
      "Compliance Report Base - Compliance Report"."transaction_id" AS "CR Base - transaction_id",
      "Compliance Report Base - Compliance Report"."compliance_report_group_uuid" AS "CR Base - compliance_report_group_uuid",
      "Compliance Report Base - Compliance Report"."legacy_id" AS "CR Base - legacy_id",
      "Compliance Report Base - Compliance Report"."version" AS "CR Base - version",
      "Compliance Report Base - Compliance Report"."supplemental_initiator" AS "CR Base - supplemental_initiator",
      "Compliance Report Base - Compliance Report"."reporting_frequency" AS "CR Base - reporting_frequency",
      "Compliance Report Base - Compliance Report"."nickname" AS "CR Base - nickname",
      "Compliance Report Base - Compliance Report"."supplemental_note" AS "CR Base - supplemental_note",
      "Compliance Report Base - Compliance Report"."create_date" AS "CR Base - create_date",
      "Compliance Report Base - Compliance Report"."update_date" AS "CR Base - update_date",
      "Compliance Report Base - Compliance Report"."create_user" AS "CR Base - create_user",
      "Compliance Report Base - Compliance Report"."update_user" AS "CR Base - update_user",
      "Compliance Report Base - Compliance Report"."assessment_statement" AS "CR Base - assessment_statement",
      "Compliance Report Base - Compliance Report"."Renewable Requirements" AS "CR Base - Renewable_Requirements",
      "Compliance Report Base - Compliance Report"."Low Carbon Requirements" AS "CR Base - Low_Carbon_Requirements",
      "Compliance Report Base - Compliance Report"."Compliance Period__compliance_period_id" AS "CR Base - Compliance_Period__compliance_period_id",
      "Compliance Report Base - Compliance Report"."Compliance Period__description" AS "CR Base - Compliance_Period__description",
      "Compliance Report Base - Compliance Report"."Compliance Period__display_order" AS "CR Base - Compliance_Period__display_order",
      "Compliance Report Base - Compliance Report"."Compliance Period__create_date" AS "CR Base - Compliance_Period__create_date",
      "Compliance Report Base - Compliance Report"."Compliance Period__update_date" AS "CR Base - Compliance_Period__update_date",
      "Compliance Report Base - Compliance Report"."Compliance Period__effective_date" AS "CR Base - Compliance_Period__effective_date",
      "Compliance Report Base - Compliance Report"."Compliance Period__effective_status" AS "CR Base - Compliance_Period__effective_status",
      "Compliance Report Base - Compliance Report"."Compliance Period__expiration_date" AS "CR Base - Compliance_Period__expiration_date",
      "Compliance Report Base - Compliance Report"."CR Status - Current Status__cr_status_id" AS "CR Base - CR_Status_Current_Status__cr_status_id",
      "Compliance Report Base - Compliance Report"."CR Status - Current Status__display_order" AS "CR Base - CR_Status_Current_Status__display_order",
      "Compliance Report Base - Compliance Report"."CR Status - Current Status__status" AS "CR Base - CR_Status_Current_Status__status",
      "Compliance Report Base - Compliance Report"."CR Status - Current Status__create_date" AS "CR Base - CR_Status_Current_Status__create_date",
      "Compliance Report Base - Compliance Report"."CR Status - Current Status__update_date" AS "CR Base - CR_Status_Current_Status__update_date",
      "Compliance Report Base - Compliance Report"."CR Status - Current Status__effective_date" AS "CR Base - CR_Status_Current_Status__effective_date",
      "Compliance Report Base - Compliance Report"."CR Status - Current Status__effective_status" AS "CR Base - CR_Status_Current_Status__effective_status",
      "Compliance Report Base - Compliance Report"."CR Status - Current Status__expiration_date" AS "CR Base - CR_Status_Current_Status__expiration_date",
      "Compliance Report Base - Compliance Report"."CR Summary - CR__summary_id" AS "CR Base - Summary__summary_id",
      "Compliance Report Base - Compliance Report"."CR Summary - CR__compliance_report_id" AS "CR Base - Summary__compliance_report_id",
      "Compliance Report Base - Compliance Report"."CR Summary - CR__quarter" AS "CR Base - Summary__quarter",
      "Compliance Report Base - Compliance Report"."CR Summary - CR__is_locked" AS "CR Base - Summary__is_locked",
      "Compliance Report Base - Compliance Report"."CR Summary - line_1_fossil_derived_base_fuel_gasoline" AS "CR Base - Summary__line_1_fossil_derived_base_fuel_gasoline",
      "Compliance Report Base - Compliance Report"."CR Summary - line_1_fossil_derived_base_fuel_diesel" AS "CR Base - Summary__line_1_fossil_derived_base_fuel_diesel",
      "Compliance Report Base - Compliance Report"."CR Summary - line_1_fossil_derived_base_fuel_jet_fuel" AS "CR Base - Summary__line_1_fossil_derived_base_fuel_jet_fuel",
      "Compliance Report Base - Compliance Report"."CR Summary - line_2_eligible_renewable_fuel_supplied_gasoline" AS "CR Base - Summary__line_2_eligible_renewable_fs_gasoline",
      "Compliance Report Base - Compliance Report"."CR Summary - line_2_eligible_renewable_fuel_supplied_diesel" AS "CR Base - Summary__line_2_eligible_renewable_fs_diesel",
      "Compliance Report Base - Compliance Report"."CR Summary - line_2_eligible_renewable_fuel_supplied_jet_fuel" AS "CR Base - Summary__line_2_eligible_renewable_fs_jet_fuel",
      "Compliance Report Base - Compliance Report"."CR Summary - line_3_total_tracked_fuel_supplied_gasoline" AS "CR Base - Summary__line_3_total_tracked_fs_gasoline",
      "Compliance Report Base - Compliance Report"."CR Summary - line_3_total_tracked_fuel_supplied_diesel" AS "CR Base - Summary__line_3_total_tracked_fs_diesel",
      "Compliance Report Base - Compliance Report"."CR Summary - line_3_total_tracked_fuel_supplied_jet_fuel" AS "CR Base - Summary__line_3_total_tracked_fs_jet_fuel",
      "Compliance Report Base - Compliance Report"."CR Summary - line_4_eligible_renewable_fuel_required_gasoline" AS "CR Base - Summary__line_4_eligible_renewable_fuel_req_gasoline",
      "Compliance Report Base - Compliance Report"."CR Summary - line_4_eligible_renewable_fuel_required_diesel" AS "CR Base - Summary__line_4_eligible_renewable_fuel_req_diesel",
      "Compliance Report Base - Compliance Report"."CR Summary - line_4_eligible_renewable_fuel_required_jet_fuel" AS "CR Base - Summary__line_4_eligible_renewable_fuel_req_jet_fuel",
      "Compliance Report Base - Compliance Report"."CR Summary - line_5_net_notionally_transferred_gasoline" AS "CR Base - Summary__line_5_net_notionally_transferred_gasoline",
      "Compliance Report Base - Compliance Report"."CR Summary - line_5_net_notionally_transferred_diesel" AS "CR Base - Summary__line_5_net_notionally_transferred_diesel",
      "Compliance Report Base - Compliance Report"."CR Summary - line_5_net_notionally_transferred_jet_fuel" AS "CR Base - Summary__line_5_net_notionally_transferred_jet_fuel",
      "Compliance Report Base - Compliance Report"."CR Summary - line_6_renewable_fuel_retained_gasoline" AS "CR Base - Summary__line_6_renewable_fuel_retained_gasoline",
      "Compliance Report Base - Compliance Report"."CR Summary - line_6_renewable_fuel_retained_diesel" AS "CR Base - Summary__line_6_renewable_fuel_retained_diesel",
      "Compliance Report Base - Compliance Report"."CR Summary - line_6_renewable_fuel_retained_jet_fuel" AS "CR Base - Summary__line_6_renewable_fuel_retained_jet_fuel",
      "Compliance Report Base - Compliance Report"."CR Summary - line_7_previously_retained_gasoline" AS "CR Base - Summary__line_7_previously_retained_gasoline",
      "Compliance Report Base - Compliance Report"."CR Summary - line_7_previously_retained_diesel" AS "CR Base - Summary__line_7_previously_retained_diesel",
      "Compliance Report Base - Compliance Report"."CR Summary - line_7_previously_retained_jet_fuel" AS "CR Base - Summary__line_7_previously_retained_jet_fuel",
      "Compliance Report Base - Compliance Report"."CR Summary - line_8_obligation_deferred_gasoline" AS "CR Base - Summary__line_8_obligation_deferred_gasoline",
      "Compliance Report Base - Compliance Report"."CR Summary - line_8_obligation_deferred_diesel" AS "CR Base - Summary__line_8_obligation_deferred_diesel",
      "Compliance Report Base - Compliance Report"."CR Summary - line_8_obligation_deferred_jet_fuel" AS "CR Base - Summary__line_8_obligation_deferred_jet_fuel",
      "Compliance Report Base - Compliance Report"."CR Summary - line_9_obligation_added_gasoline" AS "CR Base - Summary__line_9_obligation_added_gasoline",
      "Compliance Report Base - Compliance Report"."CR Summary - line_9_obligation_added_diesel" AS "CR Base - Summary__line_9_obligation_added_diesel",
      "Compliance Report Base - Compliance Report"."CR Summary - line_9_obligation_added_jet_fuel" AS "CR Base - Summary__line_9_obligation_added_jet_fuel",
      "Compliance Report Base - Compliance Report"."CR Summary - line_10_net_renewable_fuel_supplied_gasoline" AS "CR Base - Summary__line_10_net_renewable_fuel_supplied_gasoline",
      "Compliance Report Base - Compliance Report"."CR Summary - line_10_net_renewable_fuel_supplied_diesel" AS "CR Base - Summary__line_10_net_renewable_fuel_supplied_diesel",
      "Compliance Report Base - Compliance Report"."CR Summary - line_10_net_renewable_fuel_supplied_jet_fuel" AS "CR Base - Summary__line_10_net_renewable_fuel_supplied_jet_fuel",
      "Compliance Report Base - Compliance Report"."CR Summary - line_11_non_compliance_penalty_gasoline" AS "CR Base - Summary__line_11_non_compliance_penalty_gasoline",
      "Compliance Report Base - Compliance Report"."CR Summary - line_11_non_compliance_penalty_diesel" AS "CR Base - Summary__line_11_non_compliance_penalty_diesel",
      "Compliance Report Base - Compliance Report"."CR Summary - line_11_non_compliance_penalty_jet_fuel" AS "CR Base - Summary__line_11_non_compliance_penalty_jet_fuel",
      "Compliance Report Base - Compliance Report"."CR Summary - line_12_low_carbon_fuel_required" AS "CR Base - Summary__line_12_low_carbon_fuel_required",
      "Compliance Report Base - Compliance Report"."CR Summary - line_13_low_carbon_fuel_supplied" AS "CR Base - Summary__line_13_low_carbon_fuel_supplied",
      "Compliance Report Base - Compliance Report"."CR Summary - line_14_low_carbon_fuel_surplus" AS "CR Base - Summary__line_14_low_carbon_fuel_surplus",
      "Compliance Report Base - Compliance Report"."CR Summary - line_15_banked_units_used" AS "CR Base - Summary__line_15_banked_units_used",
      "Compliance Report Base - Compliance Report"."CR Summary - line_16_banked_units_remaining" AS "CR Base - Summary__line_16_banked_units_remaining",
      "Compliance Report Base - Compliance Report"."CR Summary - line_17_non_banked_units_used" AS "CR Base - Summary__line_17_non_banked_units_used",
      "Compliance Report Base - Compliance Report"."CR Summary - line_18_units_to_be_banked" AS "CR Base - Summary__line_18_units_to_be_banked",
      "Compliance Report Base - Compliance Report"."CR Summary - line_19_units_to_be_exported" AS "CR Base - Summary__line_19_units_to_be_exported",
      "Compliance Report Base - Compliance Report"."CR Summary - line_20_surplus_deficit_units" AS "CR Base - Summary__line_20_surplus_deficit_units",
      "Compliance Report Base - Compliance Report"."CR Summary - line_21_surplus_deficit_ratio" AS "CR Base - Summary__line_21_surplus_deficit_ratio",
      "Compliance Report Base - Compliance Report"."CR Summary - line_22_compliance_units_issued" AS "CR Base - Summary__line_22_compliance_units_issued",
      "Compliance Report Base - Compliance Report"."CR Summary - line_11_fossil_derived_base_fuel_gasoline" AS "CR Base - line_11_fossil_derived_base_fuel_gasoline",
      "Compliance Report Base - Compliance Report"."CR Summary - line_11_fossil_derived_base_fuel_diesel" AS "CR Base - line_11_fossil_derived_base_fuel_diesel",
      "Compliance Report Base - Compliance Report"."CR Summary - line_11_fossil_derived_base_fuel_jet_fuel" AS "CR Base - line_11_fossil_derived_base_fuel_jet_fuel",
      "Compliance Report Base - Compliance Report"."CR Summary - line_11_fossil_derived_base_fuel_total" AS "CR Base - line_11_fossil_derived_base_fuel_total",
      "Compliance Report Base - Compliance Report"."CR Summary - line_21_non_compliance_penalty_payable" AS "CR Base - line_21_non_compliance_penalty_payable",
      "Compliance Report Base - Compliance Report"."CR Summary - CR__total_non_compliance_penalty_payable" AS "CR Base - total_non_compliance_penalty_payable",
      "Compliance Report Base - Compliance Report"."CR Summary - CR__credits_offset_a" AS "CR Base - credits_offset_a",
      "Compliance Report Base - Compliance Report"."CR Summary - CR__credits_offset_b" AS "CR Base - credits_offset_b",
      "Compliance Report Base - Compliance Report"."CR Summary - CR__credits_offset_c" AS "CR Base - credits_offset_c",
      "Compliance Report Base - Compliance Report"."CR Summary - CR__create_date" AS "CR Base - Summary__create_date",
      "Compliance Report Base - Compliance Report"."CR Summary - CR__update_date" AS "CR Base - Summary__update_date",
      "Compliance Report Base - Compliance Report"."CR Summary - CR__create_user" AS "CR Base - Summary__create_user",
      "Compliance Report Base - Compliance Report"."CR Summary - CR__update_user" AS "CR Base - Summary__update_user",
      "Compliance Report Base - Compliance Report"."CR Summary - CR__early_issuance_credits_q1" AS "CR Base - early_issuance_credits_q1",
      "Compliance Report Base - Compliance Report"."CR Summary - CR__early_issuance_credits_q2" AS "CR Base - early_issuance_credits_q2",
      "Compliance Report Base - Compliance Report"."CR Summary - CR__early_issuance_credits_q3" AS "CR Base - early_issuance_credits_q3",
      "Compliance Report Base - Compliance Report"."CR Summary - CR__early_issuance_credits_q4" AS "CR Base - early_issuance_credits_q4",
      "Compliance Report Base - Compliance Report"."Transaction__transaction_id" AS "CR Base - Transaction__transaction_id",
      "Compliance Report Base - Compliance Report"."Transaction__compliance_units" AS "CR Base - compliance_units",
      "Compliance Report Base - Compliance Report"."Transaction__organization_id" AS "CR Base - Transaction__organization_id",
      "Compliance Report Base - Compliance Report"."Transaction__transaction_action" AS "CR Base - Transaction__transaction_action",
      "Compliance Report Base - Compliance Report"."Transaction__create_date" AS "CR Base - Transaction__create_date",
      "Compliance Report Base - Compliance Report"."Transaction__update_date" AS "CR Base - Transaction__update_date",
      "Compliance Report Base - Compliance Report"."Transaction__create_user" AS "CR Base - Transaction__create_user",
      "Compliance Report Base - Compliance Report"."Transaction__update_user" AS "CR Base - Transaction__update_user",
      "Compliance Report Base - Compliance Report"."Transaction__effective_date" AS "CR Base - Transaction__effective_date",
      "Compliance Report Base - Compliance Report"."Transaction__effective_status" AS "CR Base - Transaction__effective_status",
      "Compliance Report Base - Compliance Report"."Transaction__expiration_date" AS "CR Base - Transaction__expiration_date",
      "Compliance Report Base - Compliance Report"."Organization__organization_id" AS "CR Base - Organization__organization_id",
      "Compliance Report Base - Compliance Report"."Organization__organization_code" AS "CR Base - Organization__organization_code",
      "Compliance Report Base - Compliance Report"."Organization__name" AS "CR Base - Organization__name",
      "Compliance Report Base - Compliance Report"."Organization__operating_name" AS "CR Base - Organization__operating_name",
      "Compliance Report Base - Compliance Report"."Organization__email" AS "CR Base - Organization__email",
      "Compliance Report Base - Compliance Report"."Organization__phone" AS "CR Base - Organization__phone",
      "Compliance Report Base - Compliance Report"."Organization__edrms_record" AS "CR Base - Organization__edrms_record",
      "Compliance Report Base - Compliance Report"."Organization__total_balance" AS "CR Base - Organization__total_balance",
      "Compliance Report Base - Compliance Report"."Organization__reserved_balance" AS "CR Base - Organization__reserved_balance",
      "Compliance Report Base - Compliance Report"."Organization__count_transfers_in_progress" AS "CR Base - Organization__count_transfers_in_progress",
      "Compliance Report Base - Compliance Report"."Organization__organization_status_id" AS "CR Base - Organization__organization_status_id",
      "Compliance Report Base - Compliance Report"."Organization__organization_type_id" AS "CR Base - Organization__organization_type_id",
      "Compliance Report Base - Compliance Report"."Organization__organization_address_id" AS "CR Base - Organization__organization_address_id",
      "Compliance Report Base - Compliance Report"."Organization__organization_attorney_address_id" AS "CR Base - Organization__organization_attorney_address_id",
      "Compliance Report Base - Compliance Report"."Organization__create_date" AS "CR Base - Organization__create_date",
      "Compliance Report Base - Compliance Report"."Organization__update_date" AS "CR Base - Organization__update_date",
      "Compliance Report Base - Compliance Report"."Organization__create_user" AS "CR Base - Organization__create_user",
      "Compliance Report Base - Compliance Report"."Organization__update_user" AS "CR Base - Organization__update_user",
      "Compliance Report Base - Compliance Report"."Organization__effective_date" AS "CR Base - Organization__effective_date",
      "Compliance Report Base - Compliance Report"."Organization__effective_status" AS "CR Base - Organization__effective_status",
      "Compliance Report Base - Compliance Report"."Organization__expiration_date" AS "CR Base - Organization__expiration_date",
      "Compliance Report Base - Compliance Report"."Organization__has_early_issuance" AS "CR Base - Organization__has_early_issuance",
      "Compliance Report Base - Compliance Report"."Organization__records_address" AS "CR Base - Organization__records_address",
      "Compliance Report Base - Compliance Report"."CR Chained - CR Group UUID__group_uuid" AS "CR Base - group_uuid",
      "Compliance Report Base - Compliance Report"."CR Chained - CR Group UUID__max_version" AS "CR Base - max_version"
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
          "Compliance Report Status - Current Status"."compliance_report_status_id" AS "CR Status - Current Status__cr_status_id",
          "Compliance Report Status - Current Status"."display_order" AS "CR Status - Current Status__display_order",
          "Compliance Report Status - Current Status"."status" AS "CR Status - Current Status__status",
          "Compliance Report Status - Current Status"."create_date" AS "CR Status - Current Status__create_date",
          "Compliance Report Status - Current Status"."update_date" AS "CR Status - Current Status__update_date",
          "Compliance Report Status - Current Status"."effective_date" AS "CR Status - Current Status__effective_date",
          "Compliance Report Status - Current Status"."effective_status" AS "CR Status - Current Status__effective_status",
          "Compliance Report Status - Current Status"."expiration_date" AS "CR Status - Current Status__expiration_date",
          "Compliance Report Summary - Compliance Report"."summary_id" AS "CR Summary - CR__summary_id",
          "Compliance Report Summary - Compliance Report"."compliance_report_id" AS "CR Summary - CR__compliance_report_id",
          "Compliance Report Summary - Compliance Report"."quarter" AS "CR Summary - CR__quarter",
          "Compliance Report Summary - Compliance Report"."is_locked" AS "CR Summary - CR__is_locked",
          "Compliance Report Summary - Compliance Report"."line_1_fossil_derived_base_fuel_gasoline" AS "CR Summary - line_1_fossil_derived_base_fuel_gasoline",
          "Compliance Report Summary - Compliance Report"."line_1_fossil_derived_base_fuel_diesel" AS "CR Summary - line_1_fossil_derived_base_fuel_diesel",
          "Compliance Report Summary - Compliance Report"."line_1_fossil_derived_base_fuel_jet_fuel" AS "CR Summary - line_1_fossil_derived_base_fuel_jet_fuel",
          "Compliance Report Summary - Compliance Report"."line_2_eligible_renewable_fuel_supplied_gasoline" AS "CR Summary - line_2_eligible_renewable_fuel_supplied_gasoline",
          "Compliance Report Summary - Compliance Report"."line_2_eligible_renewable_fuel_supplied_diesel" AS "CR Summary - line_2_eligible_renewable_fuel_supplied_diesel",
          "Compliance Report Summary - Compliance Report"."line_2_eligible_renewable_fuel_supplied_jet_fuel" AS "CR Summary - line_2_eligible_renewable_fuel_supplied_jet_fuel",
          "Compliance Report Summary - Compliance Report"."line_3_total_tracked_fuel_supplied_gasoline" AS "CR Summary - line_3_total_tracked_fuel_supplied_gasoline",
          "Compliance Report Summary - Compliance Report"."line_3_total_tracked_fuel_supplied_diesel" AS "CR Summary - line_3_total_tracked_fuel_supplied_diesel",
          "Compliance Report Summary - Compliance Report"."line_3_total_tracked_fuel_supplied_jet_fuel" AS "CR Summary - line_3_total_tracked_fuel_supplied_jet_fuel",
          "Compliance Report Summary - Compliance Report"."line_4_eligible_renewable_fuel_required_gasoline" AS "CR Summary - line_4_eligible_renewable_fuel_required_gasoline",
          "Compliance Report Summary - Compliance Report"."line_4_eligible_renewable_fuel_required_diesel" AS "CR Summary - line_4_eligible_renewable_fuel_required_diesel",
          "Compliance Report Summary - Compliance Report"."line_4_eligible_renewable_fuel_required_jet_fuel" AS "CR Summary - line_4_eligible_renewable_fuel_required_jet_fuel",
          "Compliance Report Summary - Compliance Report"."line_5_net_notionally_transferred_gasoline" AS "CR Summary - line_5_net_notionally_transferred_gasoline",
          "Compliance Report Summary - Compliance Report"."line_5_net_notionally_transferred_diesel" AS "CR Summary - line_5_net_notionally_transferred_diesel",
          "Compliance Report Summary - Compliance Report"."line_5_net_notionally_transferred_jet_fuel" AS "CR Summary - line_5_net_notionally_transferred_jet_fuel",
          "Compliance Report Summary - Compliance Report"."line_6_renewable_fuel_retained_gasoline" AS "CR Summary - line_6_renewable_fuel_retained_gasoline",
          "Compliance Report Summary - Compliance Report"."line_6_renewable_fuel_retained_diesel" AS "CR Summary - line_6_renewable_fuel_retained_diesel",
          "Compliance Report Summary - Compliance Report"."line_6_renewable_fuel_retained_jet_fuel" AS "CR Summary - line_6_renewable_fuel_retained_jet_fuel",
          "Compliance Report Summary - Compliance Report"."line_7_previously_retained_gasoline" AS "CR Summary - line_7_previously_retained_gasoline",
          "Compliance Report Summary - Compliance Report"."line_7_previously_retained_diesel" AS "CR Summary - line_7_previously_retained_diesel",
          "Compliance Report Summary - Compliance Report"."line_7_previously_retained_jet_fuel" AS "CR Summary - line_7_previously_retained_jet_fuel",
          "Compliance Report Summary - Compliance Report"."line_8_obligation_deferred_gasoline" AS "CR Summary - line_8_obligation_deferred_gasoline",
          "Compliance Report Summary - Compliance Report"."line_8_obligation_deferred_diesel" AS "CR Summary - line_8_obligation_deferred_diesel",
          "Compliance Report Summary - Compliance Report"."line_8_obligation_deferred_jet_fuel" AS "CR Summary - line_8_obligation_deferred_jet_fuel",
          "Compliance Report Summary - Compliance Report"."line_9_obligation_added_gasoline" AS "CR Summary - line_9_obligation_added_gasoline",
          "Compliance Report Summary - Compliance Report"."line_9_obligation_added_diesel" AS "CR Summary - line_9_obligation_added_diesel",
          "Compliance Report Summary - Compliance Report"."line_9_obligation_added_jet_fuel" AS "CR Summary - line_9_obligation_added_jet_fuel",
          "Compliance Report Summary - Compliance Report"."line_10_net_renewable_fuel_supplied_gasoline" AS "CR Summary - line_10_net_renewable_fuel_supplied_gasoline",
          "Compliance Report Summary - Compliance Report"."line_10_net_renewable_fuel_supplied_diesel" AS "CR Summary - line_10_net_renewable_fuel_supplied_diesel",
          "Compliance Report Summary - Compliance Report"."line_10_net_renewable_fuel_supplied_jet_fuel" AS "CR Summary - line_10_net_renewable_fuel_supplied_jet_fuel",
          "Compliance Report Summary - Compliance Report"."line_11_non_compliance_penalty_gasoline" AS "CR Summary - line_11_non_compliance_penalty_gasoline",
          "Compliance Report Summary - Compliance Report"."line_11_non_compliance_penalty_diesel" AS "CR Summary - line_11_non_compliance_penalty_diesel",
          "Compliance Report Summary - Compliance Report"."line_11_non_compliance_penalty_jet_fuel" AS "CR Summary - line_11_non_compliance_penalty_jet_fuel",
          "Compliance Report Summary - Compliance Report"."line_12_low_carbon_fuel_required" AS "CR Summary - line_12_low_carbon_fuel_required",
          "Compliance Report Summary - Compliance Report"."line_13_low_carbon_fuel_supplied" AS "CR Summary - line_13_low_carbon_fuel_supplied",
          "Compliance Report Summary - Compliance Report"."line_14_low_carbon_fuel_surplus" AS "CR Summary - line_14_low_carbon_fuel_surplus",
          "Compliance Report Summary - Compliance Report"."line_15_banked_units_used" AS "CR Summary - line_15_banked_units_used",
          "Compliance Report Summary - Compliance Report"."line_16_banked_units_remaining" AS "CR Summary - line_16_banked_units_remaining",
          "Compliance Report Summary - Compliance Report"."line_17_non_banked_units_used" AS "CR Summary - line_17_non_banked_units_used",
          "Compliance Report Summary - Compliance Report"."line_18_units_to_be_banked" AS "CR Summary - line_18_units_to_be_banked",
          "Compliance Report Summary - Compliance Report"."line_19_units_to_be_exported" AS "CR Summary - line_19_units_to_be_exported",
          "Compliance Report Summary - Compliance Report"."line_20_surplus_deficit_units" AS "CR Summary - line_20_surplus_deficit_units",
          "Compliance Report Summary - Compliance Report"."line_21_surplus_deficit_ratio" AS "CR Summary - line_21_surplus_deficit_ratio",
          "Compliance Report Summary - Compliance Report"."line_22_compliance_units_issued" AS "CR Summary - line_22_compliance_units_issued",
          "Compliance Report Summary - Compliance Report"."line_11_fossil_derived_base_fuel_gasoline" AS "CR Summary - line_11_fossil_derived_base_fuel_gasoline",
          "Compliance Report Summary - Compliance Report"."line_11_fossil_derived_base_fuel_diesel" AS "CR Summary - line_11_fossil_derived_base_fuel_diesel",
          "Compliance Report Summary - Compliance Report"."line_11_fossil_derived_base_fuel_jet_fuel" AS "CR Summary - line_11_fossil_derived_base_fuel_jet_fuel",
          "Compliance Report Summary - Compliance Report"."line_11_fossil_derived_base_fuel_total" AS "CR Summary - line_11_fossil_derived_base_fuel_total",
          "Compliance Report Summary - Compliance Report"."line_21_non_compliance_penalty_payable" AS "CR Summary - line_21_non_compliance_penalty_payable",
          "Compliance Report Summary - Compliance Report"."total_non_compliance_penalty_payable" AS "CR Summary - CR__total_non_compliance_penalty_payable",
          "Compliance Report Summary - Compliance Report"."credits_offset_a" AS "CR Summary - CR__credits_offset_a",
          "Compliance Report Summary - Compliance Report"."credits_offset_b" AS "CR Summary - CR__credits_offset_b",
          "Compliance Report Summary - Compliance Report"."credits_offset_c" AS "CR Summary - CR__credits_offset_c",
          "Compliance Report Summary - Compliance Report"."create_date" AS "CR Summary - CR__create_date",
          "Compliance Report Summary - Compliance Report"."update_date" AS "CR Summary - CR__update_date",
          "Compliance Report Summary - Compliance Report"."create_user" AS "CR Summary - CR__create_user",
          "Compliance Report Summary - Compliance Report"."update_user" AS "CR Summary - CR__update_user",
          "Compliance Report Summary - Compliance Report"."early_issuance_credits_q1" AS "CR Summary - CR__early_issuance_credits_q1",
          "Compliance Report Summary - Compliance Report"."early_issuance_credits_q2" AS "CR Summary - CR__early_issuance_credits_q2",
          "Compliance Report Summary - Compliance Report"."early_issuance_credits_q3" AS "CR Summary - CR__early_issuance_credits_q3",
          "Compliance Report Summary - Compliance Report"."early_issuance_credits_q4" AS "CR Summary - CR__early_issuance_credits_q4",
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
          "Organization"."has_early_issuance" AS "Organization__has_early_issuance",
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
    fuel_code.fuel_code_id AS "ID",
    fuel_code_prefix.prefix AS "Prefix",
    fuel_code.fuel_suffix AS "Suffix",
    fuel_code_status.status AS "Status",
    fuel_type.fuel_type AS "Fuel Type",
    fuel_code.company AS "Company",
    fuel_code.contact_name AS "Contact Name",
    fuel_code.contact_email AS "Contact Email",
    fuel_code.carbon_intensity AS "Carbon Intensity",
    fuel_code.edrms AS "EDRMS",
    fuel_code.last_updated AS "Last Updated",
    fuel_code.application_date AS "Application Date",
    fuel_code.approval_date AS "Approval Date",
    fuel_code.feedstock AS "Feedstock",
    fuel_code.feedstock_location AS "Feedstock Location",
    fuel_code.feedstock_misc AS "Feedstock Misc",
    fuel_code.fuel_production_facility_city AS "Facility City",
    fuel_code.fuel_production_facility_province_state AS "Facility State",
    fuel_code.fuel_production_facility_country AS "Facility Country",
    fuel_code.facility_nameplate_capacity AS "Facility Capacity",
    fuel_code.facility_nameplate_capacity_unit AS "Capacity Unit",
    fuel_code.former_company AS "Former Company",
    fuel_code.notes AS "Notes"
FROM
    fuel_code
    JOIN fuel_code_prefix ON fuel_code.prefix_id = fuel_code_prefix.fuel_code_prefix_id
    JOIN fuel_code_status ON fuel_code.fuel_status_id = fuel_code_status.fuel_code_status_id
    JOIN fuel_type ON fuel_code.fuel_type_id = fuel_type.fuel_type_id
WHERE
    fuel_code_status.status != 'Deleted';

-- Grant permissions
GRANT SELECT ON vw_fuel_code_base TO basic_lcfs_reporting_role;

GRANT SELECT ON 
    fuel_code, 
    fuel_code_prefix, 
    fuel_code_status, 
    fuel_type 
TO basic_lcfs_reporting_role;