-- Revoke SELECT privileges from the role
REVOKE SELECT ON public.transaction FROM basic_lcfs_reporting_role;
REVOKE SELECT ON public.vw_transaction_base FROM basic_lcfs_reporting_role;

-- Drop the view
DROP VIEW IF EXISTS public.vw_transaction_base;