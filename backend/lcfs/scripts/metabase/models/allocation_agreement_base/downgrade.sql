-- Revoke SELECT privileges from the role
REVOKE SELECT ON 
    allocation_agreement,
    compliance_report,
    compliance_period,
    compliance_report_status,
    compliance_report_summary,
    transaction,
    organization
FROM basic_lcfs_reporting_role;

REVOKE SELECT ON vw_allocation_agreement_base FROM basic_lcfs_reporting_role;

-- Drop the view
DROP VIEW IF EXISTS vw_allocation_agreement_base;