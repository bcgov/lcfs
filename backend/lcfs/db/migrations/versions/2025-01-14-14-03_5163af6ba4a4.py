"""revert org display balance


Revision ID: 5163af6ba4a4
Revises: d25e7c47659e
Create Date: 2025-01-14 14:03:50.975682

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "5163af6ba4a4"
down_revision = "d25e7c47659e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Reapply the original logic for balances:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION update_organization_balance()
        RETURNS TRIGGER AS $$
        DECLARE
            new_total_balance BIGINT;
            new_reserved_balance BIGINT;
            org_id INT := COALESCE(NEW.organization_id, OLD.organization_id);
        BEGIN
            SELECT COALESCE(SUM(compliance_units), 0)
            INTO new_total_balance
            FROM "transaction"
            WHERE organization_id = org_id
              AND transaction_action = 'Adjustment';

            SELECT COALESCE(SUM(compliance_units), 0)
            INTO new_reserved_balance
            FROM "transaction"
            WHERE organization_id = org_id
              AND transaction_action = 'Reserved'
              AND compliance_units < 0;

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
        """
    )
    op.execute(
        """
        CREATE TRIGGER update_organization_balance_trigger
        AFTER INSERT OR UPDATE OR DELETE ON "transaction"
        FOR EACH ROW EXECUTE FUNCTION update_organization_balance();
        """
    )


def downgrade() -> None:
    pass
