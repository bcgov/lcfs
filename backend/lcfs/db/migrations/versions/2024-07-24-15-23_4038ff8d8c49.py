"""add mv_transaction_count to calculate the number of transactions in progress for IDIR users 

Revision ID: 4038ff8d8c49
Revises: 123456789abc
Create Date: 2024-07-24 15:23:16.053654

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "4038ff8d8c49"
down_revision = "123456789abc"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
    CREATE MATERIALIZED VIEW mv_transaction_count AS
    SELECT
        'transfers' AS transaction_type,
        COUNT(*) FILTER (
            WHERE
                t.current_status_id IN (4, 5)  -- Submitted, Recommended
        ) AS count_in_progress
    FROM transfer t
    UNION ALL
    SELECT
        'initiative_agreements' AS transaction_type,
        COUNT(*) FILTER (
            WHERE
                ia.current_status_id IN (1, 2)  -- Draft, Recommended
        ) AS count_in_progress
    FROM initiative_agreement ia
    UNION ALL
    SELECT
        'admin_adjustments' AS transaction_type,
        COUNT(*) FILTER (
            WHERE
                aa.current_status_id IN (1, 2)  -- Draft, Recommended
        ) AS count_in_progress
    FROM admin_adjustment aa;
    """
    )

    op.execute(
        """CREATE UNIQUE INDEX mv_transaction_count_unique_idx ON mv_transaction_count (transaction_type);"""
    )

    op.execute(
        """
    CREATE OR REPLACE FUNCTION refresh_mv_transaction_count()
    RETURNS TRIGGER AS $$
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_count;
        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
    """
    )

    # Create triggers on transfer, initiative_agreement, and admin_adjustment tables
    op.execute(
        """
    CREATE TRIGGER refresh_mv_transaction_count_after_transfer
    AFTER INSERT OR UPDATE OR DELETE ON transfer
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_transaction_count();
    """
    )

    op.execute(
        """
    CREATE TRIGGER refresh_mv_transaction_count_after_initiative_agreement
    AFTER INSERT OR UPDATE OR DELETE ON initiative_agreement
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_transaction_count();
    """
    )

    op.execute(
        """
    CREATE TRIGGER refresh_mv_transaction_count_after_admin_adjustment
    AFTER INSERT OR UPDATE OR DELETE ON admin_adjustment
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_transaction_count();
    """
    )


def downgrade() -> None:
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_mv_transaction_count_after_transfer ON transfer;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_mv_transaction_count_after_initiative_agreement ON initiative_agreement;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_mv_transaction_count_after_admin_adjustment ON admin_adjustment;"""
    )

    op.execute("""DROP FUNCTION IF EXISTS refresh_mv_transaction_count();""")

    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_transaction_count;""")
