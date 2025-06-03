-- Create Transfer Summary View
CREATE OR REPLACE VIEW public.vw_transfer_base AS
SELECT
      transfer.transfer_id,
      transfer_status.status,
      CASE
        WHEN transfer.transfer_id > 3066 THEN coalesce(
          transfer.effective_date,
          transfer_history.create_date
        )
        ELSE coalesce(
          transfer.effective_date,
          transfer.transaction_effective_date,
          transfer_history.create_date
        )
      END AS "Calculated Effective Date",
      from_organization.name AS from_organization,
      to_organization.name AS to_organization,
      price_per_unit,
      quantity,
      price_per_unit * quantity :: float AS transfer_value,
      transfer_category.category :: text as "Transfer Category"
    FROM
      transfer
      INNER JOIN transfer_status ON transfer.current_status_id = transfer_status.transfer_status_id
     
LEFT JOIN organization from_organization ON transfer.from_organization_id = from_organization.organization_id
      LEFT JOIN organization to_organization ON transfer.to_organization_id = to_organization.organization_id
      LEFT JOIN transaction on transaction.transaction_id = transfer.from_transaction_id
      LEFT JOIN transaction t2 on t2.transaction_id = transfer.to_transaction_id
      LEFT JOIN transfer_history on transfer_history.transfer_id = transfer.transfer_id
     
   AND transfer_history.transfer_status_id = 6
      LEFT JOIN transfer_category on transfer.transfer_category_id = transfer_category.transfer_category_id
   
WHERE
      price_per_unit != 0
      AND status = 'Recorded';

-- Grant SELECT privileges to the reporting role
GRANT SELECT ON public.vw_transfer_base TO basic_lcfs_reporting_role;