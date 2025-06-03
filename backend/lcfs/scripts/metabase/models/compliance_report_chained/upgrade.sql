-- Create Transfer Summary View
CREATE OR REPLACE VIEW public.vw_compliance_report_chained AS
SELECT
      compliance_report_group_uuid AS group_uuid,
      max(VERSION) AS max_version
    FROM
      COMPLIANCE_REPORT
   
GROUP BY
      COMPLIANCE_REPORT.compliance_report_group_uuid;

-- Grant SELECT privileges to the reporting role
GRANT SELECT ON public.vw_compliance_report_chained TO basic_lcfs_reporting_role;