-- Revoke SELECT privileges from the role
REVOKE
SELECT ON public.transfer,
    public.transfer_status,
    public.transfer_history,
    public.transfer_category,
    public.organization,
    public.transaction
FROM basic_lcfs_reporting_role;
REVOKE
SELECT ON public.vw_transfer_base
FROM basic_lcfs_reporting_role;
-- Drop the view
DROP VIEW IF EXISTS public.vw_transfer_base;