-- Create Transfer Summary View
CREATE OR REPLACE VIEW public.vw_transaction_base AS
select
      *
    from
      transaction
    where
      transaction_action != 'Released';

-- Grant SELECT privileges to the reporting role
GRANT SELECT ON public.vw_transaction_base TO basic_lcfs_reporting_role;