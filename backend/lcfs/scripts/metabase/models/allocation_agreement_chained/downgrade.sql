-- Revoke SELECT privileges from the role
REVOKE SELECT ON public.allocation_agreement FROM basic_lcfs_reporting_role;
REVOKE SELECT ON public.vw_allocation_agreement_chained FROM basic_lcfs_reporting_role;

-- Drop the view
DROP VIEW IF EXISTS public.vw_allocation_agreement_chained;