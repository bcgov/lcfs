-- Revoke SELECT privileges from the role
REVOKE SELECT ON 
    compliance_report,
    compliance_period,
    compliance_report_status,
    compliance_report_summary,
    transaction,
    organization
FROM basic_lcfs_reporting_role;

REVOKE SELECT ON vw_compliance_report_base FROM basic_lcfs_reporting_role;

-- Drop the view
DROP VIEW IF EXISTS vw_compliance_report_base;