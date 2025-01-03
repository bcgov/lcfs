"""add update_count_transfers_in_progress db function and update existing counts

Revision ID: 9329e38396e1
Revises: d9cdd9fca0ce
Create Date: 2024-12-30 13:54:09.361644

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "9329e38396e1"
down_revision = "d9cdd9fca0ce"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create or replace the trigger function without considering Draft transfers
    op.execute(
        """
        CREATE OR REPLACE FUNCTION update_count_transfers_in_progress()
        RETURNS TRIGGER AS $$
        BEGIN
            -- Update count_transfers_in_progress for from_organization_id and to_organization_id
            UPDATE organization o
            SET count_transfers_in_progress = (
                SELECT COUNT(DISTINCT t.transfer_id)
                FROM transfer t
                WHERE 
                    t.current_status_id IN (3, 4)
                    AND (t.from_organization_id = o.organization_id OR t.to_organization_id = o.organization_id)
            )
            WHERE o.organization_id = COALESCE(NEW.from_organization_id, OLD.from_organization_id)
               OR o.organization_id = COALESCE(NEW.to_organization_id, OLD.to_organization_id);

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    # Create the trigger
    op.execute(
        """
        CREATE TRIGGER update_count_transfers_in_progress_trigger
        AFTER INSERT OR UPDATE OR DELETE ON transfer
        FOR EACH ROW
        EXECUTE FUNCTION update_count_transfers_in_progress();
        """
    )

    # Update existing counts for all organizations by aggregating both sent and received transfers without double-counting
    op.execute(
        """
        UPDATE organization o
        SET count_transfers_in_progress = COALESCE(sub.total_transfer_count, 0)
        FROM (
            SELECT
                org.organization_id,
                COUNT(DISTINCT t.transfer_id) AS total_transfer_count
            FROM
                organization org
                LEFT JOIN transfer t ON org.organization_id = t.from_organization_id
                                      OR org.organization_id = t.to_organization_id
            WHERE
                t.current_status_id IN (3, 4)
            GROUP BY
                org.organization_id
        ) sub
        WHERE
            o.organization_id = sub.organization_id;
        """
    )


def downgrade() -> None:
    # Drop the trigger
    op.execute(
        "DROP TRIGGER IF EXISTS update_count_transfers_in_progress_trigger ON transfer;"
    )
    # Drop the trigger function
    op.execute("DROP FUNCTION IF EXISTS update_count_transfers_in_progress();")
