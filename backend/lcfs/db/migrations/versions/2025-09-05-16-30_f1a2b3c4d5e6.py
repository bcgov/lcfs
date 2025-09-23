"""fix credit ledger materialized view triggers

This migration restores the missing triggers that were dropped during the
2025-07-30-14-31_1c0b3bed4671 migration when materialized views were
recreated with CASCADE but triggers were not restored.

Without these triggers, the mv_credit_ledger materialized view is not
automatically refreshed when compliance reports are assessed and their
associated transactions are confirmed, causing the credit ledger to not
display transaction information in the line-by-line breakdown.

Revision ID: f1a2b3c4d5e6
Revises: c19276038926g
Create Date: 2025-09-05 16:30:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "f1a2b3c4d5e6"
down_revision = "c19276038926"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Restore missing triggers for materialized view refresh that were
    accidentally dropped during the 2025-07-30 migration.
    """

    # First ensure the refresh function exists
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

    # Create missing triggers only if they don't exist
    # Check for existence to avoid conflicts with existing triggers

    # Transfer triggers
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.triggers 
                WHERE trigger_name = 'refresh_transaction_view_after_transfer'
                AND event_object_table = 'transfer'
            ) THEN
                CREATE TRIGGER refresh_transaction_view_after_transfer
                AFTER INSERT OR UPDATE OR DELETE ON transfer
                FOR EACH STATEMENT
                EXECUTE FUNCTION refresh_transaction_aggregate();
            END IF;
        END $$;
        """
    )

    # Create all other triggers with existence checks
    triggers_to_create = [
        ("refresh_transaction_view_after_transfer_history", "transfer_history"),
        ("refresh_transaction_view_after_transfer_comment", "transfer_comment"),
        ("refresh_transaction_view_after_initiative_agreement", "initiative_agreement"),
        (
            "refresh_transaction_view_after_initiative_agreement_history",
            "initiative_agreement_history",
        ),
        ("refresh_transaction_view_after_admin_adjustment", "admin_adjustment"),
        (
            "refresh_transaction_view_after_admin_adjustment_history",
            "admin_adjustment_history",
        ),
        ("refresh_transaction_view_after_compliance_report", "compliance_report"),
        ("refresh_transaction_view_after_transaction", '"transaction"'),
    ]

    for trigger_name, table_name in triggers_to_create:
        # Handle the special case of "transaction" table name in quotes
        table_check = "transaction" if table_name == '"transaction"' else table_name

        op.execute(
            f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.triggers 
                    WHERE trigger_name = '{trigger_name}'
                    AND event_object_table = '{table_check}'
                ) THEN
                    CREATE TRIGGER {trigger_name}
                    AFTER INSERT OR UPDATE OR DELETE ON {table_name}
                    FOR EACH STATEMENT
                    EXECUTE FUNCTION refresh_transaction_aggregate();
                END IF;
            END $$;
            """
        )


def downgrade() -> None:
    """
    Remove all the triggers (but keep the function in case other code uses it).
    """

    # Drop all triggers
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer ON transfer;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer_history ON transfer_history;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer_comment ON transfer_comment;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_initiative_agreement ON initiative_agreement;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_initiative_agreement_history ON initiative_agreement_history;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_admin_adjustment ON admin_adjustment;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_admin_adjustment_history ON admin_adjustment_history;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_compliance_report ON compliance_report;"
    )
    op.execute(
        'DROP TRIGGER IF EXISTS refresh_transaction_view_after_transaction ON "transaction";'
    )
