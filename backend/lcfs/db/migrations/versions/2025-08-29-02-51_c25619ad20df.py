"""Revert transfer update_date and update_user

Revision ID: c25619ad20df
Revises: b7c0cbcad7d8
Create Date: 2025-08-29 02:51:00.286711

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "c25619ad20df"
down_revision = "b7c0cbcad7d8"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    session = sa.orm.Session(bind=bind)

    # Find transfers that were updated by the backfill process
    # (those with update_user = 'backfill' and a recent update_date)
    backfilled_transfers = session.execute(
        sa.text(
            """
            SELECT transfer_id, current_status_id, update_date
            FROM transfer 
            WHERE update_user = 'backfill'
            AND to_transaction_id IS NOT NULL
            """
        )
    ).fetchall()

    print(f"Found {len(backfilled_transfers)} transfers that were backfilled.")

    reverted_count = 0
    not_found_count = 0

    for transfer_id, current_status_id, current_update_date in backfilled_transfers:
        # Find the most recent update_date from transfer_history for this transfer
        # before the backfill operation
        previous_update_info = session.execute(
            sa.text(
                """
                SELECT th.update_date, th.update_user
                FROM transfer_history th
                WHERE th.transfer_id = :transfer_id
                AND th.transfer_status_id = :current_status_id
                AND th.update_date < :current_update_date
                ORDER BY th.update_date DESC, th.transfer_history_id DESC
                LIMIT 1
                """
            ),
            {
                "transfer_id": transfer_id,
                "current_status_id": current_status_id,
                "current_update_date": current_update_date,
            },
        ).fetchone()

        if previous_update_info:
            previous_update_date, previous_update_user = previous_update_info

            # Revert the update_date and update_user to the previous values
            session.execute(
                sa.text(
                    """
                    UPDATE transfer 
                    SET update_date = :prev_update_date,
                        update_user = :prev_update_user
                    WHERE transfer_id = :transfer_id
                      AND current_status_id = :current_status_id
                    """
                ),
                {
                    "prev_update_date": previous_update_date,
                    "prev_update_user": previous_update_user,
                    "transfer_id": transfer_id,
                    "current_status_id": current_status_id,
                },
            )
            reverted_count += 1

        else:
            # If no history found
            not_found_count += 1
            print(
                f"WARNING: Could not find previous update info for transfer {transfer_id}"
            )

    print(f"\n=== REVERT SUMMARY ===")
    print(f"Total backfilled transfers processed: {len(backfilled_transfers)}")
    print(f"Successfully reverted update_date: {reverted_count}")
    print(f"Could not revert (no history found): {not_found_count}")

    session.commit()
    session.close()


def downgrade() -> None:
    pass