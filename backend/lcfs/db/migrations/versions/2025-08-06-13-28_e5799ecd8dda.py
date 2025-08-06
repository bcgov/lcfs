"""backfill to_transaction_id in transfers table

Revision ID: e5799ecd8dda
Revises: 8cb65fb3418e
Create Date: 2025-08-06 13:28:05.038494

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "e5799ecd8dda"
down_revision = "8cb65fb3418e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    session = sa.orm.Session(bind=bind)

    # Find the transfer_status_id for 'Recorded'
    recorded_status_id_result = session.execute(
        sa.text(
            "SELECT transfer_status_id FROM transfer_status WHERE status = 'Recorded'"
        )
    ).fetchone()
    recorded_status_id = recorded_status_id_result[0]

    # Find transfers that are 'Recorded' and have a NULL to_transaction_id
    transfers_to_fix = session.execute(
        sa.text(
            """
            SELECT t.transfer_id, t.from_organization_id, t.to_organization_id, 
                   t.from_transaction_id, t.to_transaction_id, t.quantity,
                   t.create_date,
                   ft.create_date as from_tx_create_date
            FROM transfer t
            LEFT JOIN transaction ft ON ft.transaction_id = t.from_transaction_id
            WHERE t.current_status_id = :status_id 
            AND t.to_transaction_id IS NULL 
            AND t.from_transaction_id IS NOT NULL;
            """
        ),
        {"status_id": recorded_status_id},
    ).fetchall()

    print(f"Found {len(transfers_to_fix)} transfers to backfill.")

    unmatched_transfers = []

    for (
        transfer_id,
        from_org_id,
        to_org_id,
        from_transaction_id,
        to_transaction_id,
        quantity,
        transfer_create_date,
        from_tx_create_date,
    ) in transfers_to_fix:

        # Use from_transaction create_date if available, otherwise use transfer create_date
        reference_date = (
            from_tx_create_date if from_tx_create_date else transfer_create_date
        )

        # Find the corresponding transaction for the receiving organization.
        # Select the one with the closest timestamp to the reference date
        to_transaction_result = session.execute(
            sa.text(
                """
                SELECT tx.transaction_id, tx.create_date,
                       ABS(EXTRACT(EPOCH FROM (tx.create_date - :ref_date))) as time_diff_seconds
                FROM transaction tx
                WHERE tx.organization_id = :org_id
                  AND tx.transaction_action = 'Adjustment'
                  AND tx.compliance_units = :quantity
                  AND tx.compliance_units > 0
                  AND NOT EXISTS (
                      -- Ensure this transaction isn't already linked to another transfer/compliance report/initiative agreement/admin adjustment
                      SELECT 1 FROM transfer t2 
                      WHERE t2.to_transaction_id = tx.transaction_id
                        AND t2.transfer_id != :t_id
                      UNION
                      SELECT 1 FROM compliance_report cr
                      WHERE cr.transaction_id = tx.transaction_id
                      UNION
                      SELECT 1 FROM initiative_agreement ia
                      WHERE ia.transaction_id = tx.transaction_id
                      UNION
                      SELECT 1 FROM admin_adjustment aa
                      WHERE aa.transaction_id = tx.transaction_id
                  )
                ORDER BY time_diff_seconds ASC
                LIMIT 1;
                """
            ),
            {
                "t_id": transfer_id,
                "org_id": to_org_id,
                "quantity": quantity,
                "ref_date": reference_date,
            },
        ).fetchone()

        if to_transaction_result:
            to_transaction_id, tx_create_date, time_diff = to_transaction_result

            # Update the transfer record with the correct to_transaction_id
            session.execute(
                sa.text(
                    """
                    UPDATE transfer SET to_transaction_id = :to_tx_id, update_user = 'backfill', update_date = NOW()
                    WHERE transfer_id = :t_id
                    """
                ),
                {"to_tx_id": to_transaction_id, "t_id": transfer_id},
            )
        else:
            print(
                f"WARNING: No matching 'to_transaction' found for transfer {transfer_id}."
            )
            unmatched_transfers.append(
                {
                    "transfer_id": transfer_id,
                    "from_org_id": from_org_id,
                    "to_org_id": to_org_id,
                    "quantity": quantity,
                    "from_transaction_id": from_transaction_id,
                    "transfer_create_date": transfer_create_date,
                }
            )

    # Log summary
    print(f"\n=== BACKFILL SUMMARY ===")
    print(f"Total transfers processed: {len(transfers_to_fix)}")
    print(f"Successfully matched: {len(transfers_to_fix) - len(unmatched_transfers)}")
    print(f"Unmatched transfers: {len(unmatched_transfers)}")

    if unmatched_transfers:
        print("\n=== UNMATCHED TRANSFERS FOR MANUAL REVIEW ===")
        for transfer in unmatched_transfers:
            print(
                f"Transfer ID: {transfer['transfer_id']}, "
                f"To Org: {transfer['to_org_id']}, "
                f"Quantity: {transfer['quantity']}, "
                f"From Tx ID: {transfer['from_transaction_id']}"
            )

    session.commit()
    session.close()


def downgrade() -> None:
    pass
