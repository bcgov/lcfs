"""fix refresh function to check view existence

Revision ID: fix_refresh_function
Revises: 1c0b3bed4671
Create Date: 2025-07-28 22:45:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "fix_refresh_function"
down_revision = "1c0b3bed4671"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Update the refresh function to check if materialized view exists
    op.execute(
        """
        CREATE OR REPLACE FUNCTION refresh_transaction_aggregate()
        RETURNS TRIGGER AS $$
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_aggregate;
            -- Check if mv_credit_ledger exists before refreshing
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'mv_credit_ledger' 
                AND table_type = 'VIEW'
            ) THEN
                REFRESH MATERIALIZED VIEW CONCURRENTLY mv_credit_ledger;
            END IF;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        """
    )


def downgrade() -> None:
    # Revert to the original function
    op.execute(
        """
        CREATE OR REPLACE FUNCTION refresh_transaction_aggregate()
        RETURNS TRIGGER AS $$
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_aggregate;
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_credit_ledger;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        """
    )