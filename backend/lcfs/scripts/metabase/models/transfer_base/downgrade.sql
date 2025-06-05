-- Revoke SELECT privileges from the role
REVOKE
SELECT ON transfer,
    transfer_status,
    transfer_history,
    transfer_category,
    organization,
    transaction
FROM basic_lcfs_reporting_role;
REVOKE
SELECT ON vw_transfer_base
FROM basic_lcfs_reporting_role;
-- Drop the view
DROP VIEW IF EXISTS vw_transfer_base;