-- ==========================================
-- Compliance Reports Analytics View
-- ==========================================
CREATE or replace VIEW vw_compliance_report_base AS
SELECT *
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
) ranked_reports
WHERE rn = 1;
grant select on vw_compliance_report_base, compliance_report_history to basic_lcfs_reporting_role;
-- ==========================================
-- Compliance Reports Waiting review
-- ==========================================
create or replace view vw_reports_waiting_review as 
WITH latest_history AS (
      SELECT
        crh.compliance_report_id,
        crh.create_date,
        cr.compliance_report_group_uuid,
        ROW_NUMBER() OVER (
          PARTITION BY cr.compliance_report_group_uuid
         
ORDER BY
            crh.create_date DESC
        ) AS rn
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
     
   AND crs.status NOT IN (
        'Assessed' :: compliancereportstatusenum,
        'Rejected' :: compliancereportstatusenum,
        'Not_recommended_by_analyst' :: compliancereportstatusenum,
        'Not_recommended_by_manager' :: compliancereportstatusenum
      )
    ORDER BY
      days_in_status DESC NULLS last;
grant select on vw_reports_waiting_review to basic_lcfs_reporting_role;
-- ==========================================
-- Compliance reports time per status
-- ==========================================
create or replace view vw_compliance_reports_time_per_status as
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
grant select on vw_compliance_reports_time_per_status to basic_lcfs_reporting_role;
-- ==========================================
-- Transfer base Analytics View
-- ==========================================
create or replace view vw_transfer_base as
    select
	transfer.transfer_id,
	transfer_status.status,
	case
		when transfer.transfer_id > 3066 then coalesce(
          transfer.effective_date,
		transfer_history.create_date
        )
		else coalesce(
          transfer.effective_date,
		transfer.transaction_effective_date,
		transfer_history.create_date
        )
	end as "Calculated Effective Date",
	from_organization.name as from_organization,
	to_organization.name as to_organization,
	price_per_unit,
	quantity,
	price_per_unit * quantity::float as transfer_value,
	transfer_category.category::text as "transfer_category"
from
	transfer
inner join transfer_status on
	transfer.current_status_id = transfer_status.transfer_status_id
left join organization from_organization on
	transfer.from_organization_id = from_organization.organization_id
left join organization to_organization on
	transfer.to_organization_id = to_organization.organization_id
left join transaction on
	transaction.transaction_id = transfer.from_transaction_id
left join transaction t2 on
	t2.transaction_id = transfer.to_transaction_id
left join transfer_history on
	transfer_history.transfer_id = transfer.transfer_id
	and transfer_history.transfer_status_id = 6
left join transfer_category on
	transfer.transfer_category_id = transfer_category.transfer_category_id
where
	price_per_unit != 0
	and status = 'Recorded';
grant select on vw_transfer_base to basic_lcfs_reporting_role;
grant select on organization, transfer_status, transfer_category, compliance_period, compliance_report_status to basic_lcfs_reporting_role;