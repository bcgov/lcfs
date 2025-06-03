-- Revoke SELECT privileges from the role
REVOKE SELECT ON 
    public.fuel_supply,
    public.fuel_type,
    public.fuel_category,
    public.provision_of_the_act,
    public.end_use_type,
    public.compliance_report,
    public.compliance_report_status,
    public.compliance_period,
    public.organization,
    public.user_profile
FROM basic_lcfs_reporting_role;

REVOKE SELECT ON public.vw_fuel_supply FROM basic_lcfs_reporting_role;

-- Drop the view
DROP VIEW IF EXISTS public.vw_fuel_supply;