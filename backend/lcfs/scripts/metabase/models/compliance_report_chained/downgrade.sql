-- Revoke SELECT privileges from the role
REVOKE SELECT ON compliance_report FROM basic_lcfs_reporting_role;
REVOKE SELECT ON vw_compliance_report_chained FROM basic_lcfs_reporting_role;

-- Drop the view
DROP VIEW IF EXISTS vw_compliance_report_chained;