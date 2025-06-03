-- Revoke SELECT privileges from the role
REVOKE SELECT ON allocation_agreement FROM basic_lcfs_reporting_role;
REVOKE SELECT ON vw_allocation_agreement_chained FROM basic_lcfs_reporting_role;

-- Drop the view
DROP VIEW IF EXISTS vw_allocation_agreement_chained;