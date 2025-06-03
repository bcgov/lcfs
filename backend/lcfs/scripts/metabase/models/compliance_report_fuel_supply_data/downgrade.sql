-- Revoke SELECT privileges from the role
REVOKE
SELECT ON public.fuel_supply,
    public.v_compliance_report,
    public.compliance_report
FROM basic_lcfs_reporting_role;
REVOKE
SELECT ON public.vw_compliance_report_fuel_supply_data
FROM basic_lcfs_reporting_role;
-- Drop the view
DROP VIEW IF EXISTS public.vw_compliance_report_fuel_supply_data;