-- Revoke SELECT privileges from the role
REVOKE
SELECT ON fuel_supply,
    v_compliance_report,
    compliance_report
FROM basic_lcfs_reporting_role;
REVOKE
SELECT ON vw_compliance_report_fuel_supply_data
FROM basic_lcfs_reporting_role;
-- Drop the view
DROP VIEW IF EXISTS vw_compliance_report_fuel_supply_data;