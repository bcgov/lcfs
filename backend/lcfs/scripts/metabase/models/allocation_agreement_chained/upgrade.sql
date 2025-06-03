-- Create Transfer Summary View
CREATE OR REPLACE VIEW vw_allocation_agreement_chained AS
SELECT
      "allocation_agreement"."group_uuid" AS "group_uuid",
      MAX("allocation_agreement"."version") AS "max"
    FROM
      "allocation_agreement"
   
GROUP BY
      "allocation_agreement"."group_uuid"
   
ORDER BY
      "allocation_agreement"."group_uuid" ASC;

-- Grant SELECT privileges to the reporting role
GRANT SELECT ON vw_allocation_agreement_chained TO basic_lcfs_reporting_role;