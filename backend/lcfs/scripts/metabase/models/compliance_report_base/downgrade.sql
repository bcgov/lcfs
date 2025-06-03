-- Revoke SELECT privileges from the role
REVOKE SELECT ON 
    public.compliance_report,
    public.compliance_period,
    public.compliance_report_status,
    public.compliance_report_summary,
    public.transaction,
    public.organization
FROM basic_lcfs_reporting_role;

REVOKE SELECT ON public.vw_compliance_report_base FROM basic_lcfs_reporting_role;

-- Drop the view
DROP VIEW IF EXISTS public.vw_compliance_report_base;