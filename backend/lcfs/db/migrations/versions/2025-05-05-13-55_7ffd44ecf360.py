"""Add Recommended transfers (status id 5) to 'in-progress' count

Revision ID: 7ffd44ecf360
Revises: 7a1f5f52793c
Create Date: 2025-05-05 13:55:13.572704

"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "7ffd44ecf360"
down_revision = "7a1f5f52793c"
branch_labels = None
depends_on = None


def upgrade():

    # Update the function to include Recommended transfers (status id 5)
    op.execute(
        """
        CREATE OR REPLACE FUNCTION update_count_transfers_in_progress()
        RETURNS TRIGGER AS $$
        BEGIN
            UPDATE organization o
            SET count_transfers_in_progress = (
                SELECT COUNT(DISTINCT t.transfer_id)
                FROM transfer t
                WHERE 
                    t.current_status_id IN (3, 4, 5) -- Sent, Submitted, Recommended
                    AND (
                        t.from_organization_id = o.organization_id
                        OR t.to_organization_id = o.organization_id
                    )
            )
            WHERE o.organization_id = COALESCE(NEW.from_organization_id,
                                              OLD.from_organization_id)
               OR o.organization_id = COALESCE(NEW.to_organization_id,
                                              OLD.to_organization_id);

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    # Back-fill counts so dashboards are correct right away
    op.execute(
        """
        UPDATE organization o
        SET count_transfers_in_progress = sub.cnt
        FROM (
            SELECT
                org.organization_id,
                COUNT(DISTINCT t.transfer_id) AS cnt
            FROM organization org
            LEFT JOIN transfer t
                ON org.organization_id IN (t.from_organization_id,
                                           t.to_organization_id)
            WHERE t.current_status_id IN (3, 4, 5) -- Sent, Submitted, Recommended
            GROUP BY org.organization_id
        ) sub
        WHERE o.organization_id = sub.organization_id;
        """
    )


def downgrade():
    op.execute(
        """
        CREATE OR REPLACE FUNCTION update_count_transfers_in_progress()
        RETURNS TRIGGER AS $$
        BEGIN
            UPDATE organization o
            SET count_transfers_in_progress = (
                SELECT COUNT(DISTINCT t.transfer_id)
                FROM transfer t
                WHERE 
                    t.current_status_id IN (3, 4) -- Sent, Submitted
                    AND (
                        t.from_organization_id = o.organization_id
                        OR t.to_organization_id = o.organization_id
                    )
            )
            WHERE o.organization_id = COALESCE(NEW.from_organization_id,
                                              OLD.from_organization_id)
               OR o.organization_id = COALESCE(NEW.to_organization_id,
                                              OLD.to_organization_id);

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
