-- Revoke SELECT privileges from the role
REVOKE SELECT ON transaction FROM basic_lcfs_reporting_role;
REVOKE SELECT ON vw_transaction_base FROM basic_lcfs_reporting_role;

-- Drop the view
DROP VIEW IF EXISTS vw_transaction_base;