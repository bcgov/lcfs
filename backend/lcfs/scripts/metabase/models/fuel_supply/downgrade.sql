-- Revoke SELECT privileges from the role
REVOKE SELECT ON 
    fuel_supply,
    fuel_type,
    fuel_category,
    provision_of_the_act,
    end_use_type,
    compliance_report,
    compliance_report_status,
    compliance_period,
    organization,
    user_profile
FROM basic_lcfs_reporting_role;

REVOKE SELECT ON vw_fuel_supply FROM basic_lcfs_reporting_role;

-- Drop the view
DROP VIEW IF EXISTS vw_fuel_supply;