-- Create Transfer Summary View
CREATE OR REPLACE VIEW public.vw_allocation_agreement_chained AS
SELECT
      "public"."allocation_agreement"."group_uuid" AS "group_uuid",
      MAX("public"."allocation_agreement"."version") AS "max"
    FROM
      "public"."allocation_agreement"
   
GROUP BY
      "public"."allocation_agreement"."group_uuid"
   
ORDER BY
      "public"."allocation_agreement"."group_uuid" ASC;

-- Grant SELECT privileges to the reporting role
GRANT SELECT ON public.vw_allocation_agreement_chained TO basic_lcfs_reporting_role;