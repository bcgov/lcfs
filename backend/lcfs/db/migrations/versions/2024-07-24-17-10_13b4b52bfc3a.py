"""Add count_transfers_in_progress to the organization table with a trigger to update on transfer changes.

Revision ID: 13b4b52bfc3a
Revises: 4038ff8d8c49
Create Date: 2024-07-24 17:10:36.046910

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "13b4b52bfc3a"
down_revision = "4038ff8d8c49"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "organization",
        sa.Column(
            "count_transfers_in_progress",
            sa.Integer(),
            server_default=sa.text("0"),
            autoincrement=False,
            nullable=False,
            comment="The count of transfers in progress for the specified organization.",
        ),
    )

    op.execute("""
        CREATE OR REPLACE FUNCTION update_count_transfers_in_progress()
        RETURNS TRIGGER AS $$
        DECLARE
            transfer_count_from INTEGER;
            transfer_count_to INTEGER;
            draft_status_id INTEGER := 1;  -- Draft
            sent_status_id INTEGER := 3;  -- Sent
            submitted_status_id INTEGER := 4;  -- Submitted
        BEGIN
            -- Count transfers in progress for the organization sending the transfer
            SELECT COALESCE(COUNT(*), 0) INTO transfer_count_from
            FROM transfer
            WHERE
              (
                  (current_status_id = draft_status_id AND from_organization_id = COALESCE(NEW.from_organization_id, OLD.from_organization_id))
                  OR (
                      current_status_id IN (sent_status_id, submitted_status_id)
                      AND (from_organization_id = COALESCE(NEW.from_organization_id, OLD.from_organization_id))
                  )
              );

            -- Update the organization sending the transfer with the new transfer count
            UPDATE organization
            SET count_transfers_in_progress = transfer_count_from
            WHERE organization_id = COALESCE(NEW.from_organization_id, OLD.from_organization_id);

            -- Count transfers in progress for the organization receiving the transfer
            SELECT COALESCE(COUNT(*), 0) INTO transfer_count_to
            FROM transfer
            WHERE
              (
                  current_status_id IN (sent_status_id, submitted_status_id)
                  AND (to_organization_id = COALESCE(NEW.to_organization_id, OLD.to_organization_id))
              );

            -- Update the organization receiving the transfer with the new transfer count
            UPDATE organization
            SET count_transfers_in_progress = transfer_count_to
            WHERE organization_id = COALESCE(NEW.to_organization_id, OLD.to_organization_id);

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER update_count_transfers_in_progress_trigger
        AFTER INSERT OR UPDATE OR DELETE ON transfer
        FOR EACH ROW
        EXECUTE FUNCTION update_count_transfers_in_progress();
    """)

def downgrade() -> None:
    op.drop_column("organization", "count_transfers_in_progress")
    op.execute("DROP TRIGGER IF EXISTS update_count_transfers_in_progress_trigger ON transfer;")
    op.execute("DROP FUNCTION IF EXISTS update_count_transfers_in_progress();")
