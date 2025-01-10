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
    # Create or replace the function with updated logic:
    # 1) total_balance now sums:
    #    - All compliance_units from 'Adjustment'
    #    - Negative compliance_units from 'Reserved'
    # 2) reserved_balance sums only negative compliance_units from 'Reserved'
    op.execute(
        """
        CREATE OR REPLACE FUNCTION update_organization_balance()
        RETURNS TRIGGER AS $$
        DECLARE
            new_total_balance BIGINT;
            new_reserved_balance BIGINT;
            org_id INT := COALESCE(NEW.organization_id, OLD.organization_id);
        BEGIN
            -- Calculate new total balance:
            --   adjustments + negative reserved units
            SELECT COALESCE(
                SUM(
                    CASE 
                        WHEN transaction_action = 'Adjustment' THEN compliance_units
                        WHEN transaction_action = 'Reserved' AND compliance_units < 0 THEN compliance_units
                        ELSE 0
                    END
                ), 
                0
            )
            INTO new_total_balance
            FROM "transaction"
            WHERE organization_id = org_id;

            -- Calculate new reserved balance from negative compliance_units
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
        CREATE TRIGGER update_organization_balance_trigger
        AFTER INSERT OR UPDATE OR DELETE ON "transaction"
        FOR EACH ROW EXECUTE FUNCTION update_organization_balance();
        """
    )


def downgrade() -> None:
    # Revert to the original logic:
    # 1) total_balance sums only 'Adjustment'
    # 2) reserved_balance sums all (positive and negative) 'Reserved'
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
