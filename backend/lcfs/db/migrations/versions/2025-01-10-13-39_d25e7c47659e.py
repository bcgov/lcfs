"""mv update on org balances

Revision ID: d25e7c47659e
Revises: fa98709e7952
Create Date: 2025-01-10 13:39:31.688471
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "d25e7c47659e"
down_revision = "fa98709e7952"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create or replace the function with updated reserved balance logic
    op.execute(
        """
        CREATE OR REPLACE FUNCTION update_organization_balance()
        RETURNS TRIGGER AS $$
        DECLARE
            new_total_balance BIGINT;
            new_reserved_balance BIGINT;
            org_id INT := COALESCE(NEW.organization_id, OLD.organization_id);
        BEGIN
            -- Calculate new total balance for specific organization_id
            SELECT COALESCE(SUM(compliance_units), 0) INTO new_total_balance
            FROM "transaction"
            WHERE organization_id = org_id
            AND transaction_action = 'Adjustment';

            -- Calculate new reserved balance ONLY from negative compliance_units
            SELECT COALESCE(SUM(compliance_units), 0) INTO new_reserved_balance
            FROM "transaction"
            WHERE organization_id = org_id
            AND transaction_action = 'Reserved'
            AND compliance_units < 0;

            -- Update the organization with the new balances
            UPDATE organization
            SET total_balance = new_total_balance,
                reserved_balance = new_reserved_balance
            WHERE organization_id = org_id;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    # Drop existing trigger if it exists, then recreate to ensure it uses the new function
    op.execute(
        """
        DROP TRIGGER IF EXISTS update_organization_balance_trigger ON "transaction";
        CREATE TRIGGER update_organization_balance_trigger
        AFTER INSERT OR UPDATE OR DELETE ON "transaction"
        FOR EACH ROW EXECUTE FUNCTION update_organization_balance();
        """
    )


def downgrade() -> None:
    # Revert to the original calculation, which included both negative and positive values
    op.execute(
        """
        CREATE OR REPLACE FUNCTION update_organization_balance()
        RETURNS TRIGGER AS $$
        DECLARE
            new_total_balance BIGINT;
            new_reserved_balance BIGINT;
            org_id INT := COALESCE(NEW.organization_id, OLD.organization_id);
        BEGIN
            -- Calculate new total balance for specific organization_id
            SELECT COALESCE(SUM(compliance_units), 0) INTO new_total_balance
            FROM "transaction"
            WHERE organization_id = org_id
            AND transaction_action = 'Adjustment';

            -- Revert to calculating reserved balance from all compliance_units (no < 0 restriction)
            SELECT COALESCE(SUM(compliance_units), 0) INTO new_reserved_balance
            FROM "transaction"
            WHERE organization_id = org_id
            AND transaction_action = 'Reserved';

            UPDATE organization
            SET total_balance = new_total_balance,
                reserved_balance = new_reserved_balance
            WHERE organization_id = org_id;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    op.execute(
        """
        DROP TRIGGER IF EXISTS update_organization_balance_trigger ON "transaction";
        CREATE TRIGGER update_organization_balance_trigger
        AFTER INSERT OR UPDATE OR DELETE ON "transaction"
        FOR EACH ROW EXECUTE FUNCTION update_organization_balance();
        """
    )
