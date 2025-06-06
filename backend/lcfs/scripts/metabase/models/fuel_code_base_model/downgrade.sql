-- Revoke SELECT privileges from the role
REVOKE SELECT ON 
    public.fuel_code, 
    public.fuel_code_prefix, 
    public.fuel_code_status, 
    public.fuel_type 
FROM basic_lcfs_reporting_role;

REVOKE SELECT ON public.vw_fuel_code_base FROM basic_lcfs_reporting_role;

-- Drop the view
DROP VIEW IF EXISTS public.vw_fuel_code_base;