"""Add total_balance and reserved_balance to the organization table with a trigger to update on transaction changes.

Revision ID: d781da2e8de1
Revises: abcdef123456
Create Date: 2024-04-15 20:52:43.019634

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "d781da2e8de1"
down_revision = "9ff0501fa7c6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "organization",
        sa.Column(
            "total_balance",
            sa.BIGINT(),
            server_default=sa.text("0"),
            autoincrement=False,
            nullable=False,
            comment="The total balance of compliance units for the specified organization.",
        ),
    )
    op.add_column(
        "organization",
        sa.Column(
            "reserved_balance",
            sa.BIGINT(),
            server_default=sa.text("0"),
            autoincrement=False,
            nullable=False,
            comment="The reserved balance of compliance units for the specified organization.",
        ),
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION update_organization_balance()
        RETURNS TRIGGER AS $$
        DECLARE
            new_total_balance BIGINT;
            new_reserved_balance BIGINT;
        BEGIN
            -- Calculate new total balance for specific organization_id
            SELECT COALESCE(SUM(compliance_units), 0) INTO new_total_balance
            FROM "transaction"
            WHERE organization_id = COALESCE(NEW.organization_id, OLD.organization_id)
            AND transaction_action = 'Adjustment';

            -- Calculate new reserved balance for specific organization_id
            SELECT COALESCE(SUM(compliance_units), 0) INTO new_reserved_balance
            FROM "transaction"
            WHERE organization_id = COALESCE(NEW.organization_id, OLD.organization_id)
            AND transaction_action = 'Reserved';

            -- Update the organization with the new balances
            UPDATE organization
            SET total_balance = new_total_balance,
                reserved_balance = new_reserved_balance
            WHERE organization_id = COALESCE(NEW.organization_id, OLD.organization_id);

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """
    )

    op.execute(
        """
        CREATE TRIGGER update_organization_balance_trigger
        AFTER INSERT OR UPDATE OR DELETE ON "transaction"
        FOR EACH ROW
        EXECUTE FUNCTION update_organization_balance();
    """
    )


def downgrade() -> None:
    op.drop_column("organization", "total_balance")
    op.drop_column("organization", "reserved_balance")
    op.execute(
        "DROP TRIGGER IF EXISTS update_organization_balance_trigger ON transaction;"
    )
    op.execute("DROP FUNCTION IF EXISTS update_organization_balance();")
