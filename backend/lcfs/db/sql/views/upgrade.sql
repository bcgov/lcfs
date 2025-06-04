-- ==========================================
-- Compliance Reports Analytics View
-- ==========================================
CREATE OR REPLACE VIEW vw_compliance_report_base AS
SELECT
    *
FROM (
    SELECT
        vcr.*,
        ROW_NUMBER() OVER (PARTITION BY vcr.compliance_period, vcr.compliance_report_group_uuid, vcr.organization_id ORDER BY vcr.version DESC) AS rn
    FROM
        v_compliance_report vcr
        JOIN compliance_report_status crs ON crs.compliance_report_status_id = vcr.report_status_id
            AND crs.status NOT IN ('Draft'::compliancereportstatusenum, 'Analyst_adjustment'::compliancereportstatusenum)) ranked_reports
WHERE
    rn = 1;

GRANT SELECT ON vw_compliance_report_base, compliance_report_history TO basic_lcfs_reporting_role;

-- ==========================================
-- Compliance Reports Waiting review
-- ==========================================
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
    public.user_login_history;

GRANT SELECT ON vw_user_login_analytics_base TO basic_lcfs_reporting_role;

-- ==========================================
-- BCeID Daily Login Summary View
-- ==========================================
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

