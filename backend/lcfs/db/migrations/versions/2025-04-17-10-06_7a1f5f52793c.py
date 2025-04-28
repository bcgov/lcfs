"""credit ledger mv

Revision ID: 7a1f5f52793c
Revises: 4f18d1a47c91
Create Date: 2025-04-17 10:06:27.938689

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "7a1f5f52793c"
down_revision = "4f18d1a47c91"
branch_labels = None
depends_on = None

MV_NAME = "mv_credit_ledger"

CREATE_VIEW_SQL = f"""
CREATE MATERIALIZED VIEW {MV_NAME} AS
WITH base AS (
    SELECT
        t.transaction_id,
        t.transaction_type,
        t.compliance_period,
        t.from_organization_id                       AS organization_id,
        -ABS(t.quantity)                             AS compliance_units,
        t.create_date,
        t.update_date
    FROM   mv_transaction_aggregate t
    WHERE  t.transaction_type = 'Transfer'
    AND  t.status            = 'Recorded'

    UNION ALL

    SELECT
        t.transaction_id,
        t.transaction_type,
        t.compliance_period,
        t.to_organization_id,
        ABS(t.quantity),
        t.create_date,
        t.update_date
    FROM   mv_transaction_aggregate t
    WHERE  t.transaction_type = 'Transfer'
    AND  t.status            = 'Recorded'

    UNION ALL

    SELECT
        t.transaction_id,
        t.transaction_type,
        t.compliance_period,
        t.to_organization_id                       AS organization_id,
        t.quantity,
        t.create_date,
        t.update_date
    FROM   mv_transaction_aggregate t
    WHERE  t.transaction_type  = 'AdminAdjustment'
    AND  t.status            = 'Approved'

    UNION ALL

    SELECT
        t.transaction_id,
        t.transaction_type,
        t.compliance_period,
        t.to_organization_id                       AS organization_id,
        t.quantity,
        t.create_date,
        t.update_date
    FROM   mv_transaction_aggregate t
    WHERE  t.transaction_type  = 'InitiativeAgreement'
    AND  t.status            = 'Approved'

    UNION ALL

    SELECT
        t.transaction_id,
        t.transaction_type,
        t.compliance_period,
        t.to_organization_id                       AS organization_id,
        t.quantity,
        t.create_date,
        t.update_date
    FROM   mv_transaction_aggregate t
    WHERE  t.transaction_type  = 'ComplianceReport'
    AND  t.status            = 'Assessed'
)

SELECT
    transaction_id,
    transaction_type,
    compliance_period,
    organization_id,
    compliance_units,
    SUM(compliance_units) OVER (
        PARTITION BY organization_id
        ORDER BY update_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS available_balance,
    create_date,
    update_date
FROM base;
"""


# optional indexes
IDX_ORG_YEAR = f"{MV_NAME}_org_year_idx"
IDX_ORG_DATE = f"{MV_NAME}_org_date_idx"

CREATE_IDX_ORG_YEAR = (
    f"CREATE INDEX {IDX_ORG_YEAR} "
    f"ON {MV_NAME} (organization_id, compliance_period);"
)
CREATE_IDX_ORG_DATE = (
    f"CREATE INDEX {IDX_ORG_DATE} " f"ON {MV_NAME} (organization_id, update_date DESC);"
)


def upgrade() -> None:
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer ON transfer;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_initiative_agreement ON initiative_agreement;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_admin_adjustment ON admin_adjustment;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer_history ON transfer_history;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_initiative_agreement_history ON initiative_agreement_history;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_admin_adjustment_history ON admin_adjustment_history;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_compliance_report ON compliance_report;"
    )

    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer_comment ON transfer_comment;"
    )

    op.execute("DROP FUNCTION IF EXISTS refresh_transaction_aggregate();")

    op.execute(CREATE_VIEW_SQL)
    op.execute(CREATE_IDX_ORG_YEAR)
    op.execute(CREATE_IDX_ORG_DATE)

    op.execute(
        f"CREATE UNIQUE INDEX IF NOT EXISTS {MV_NAME}_tx_org_idx "
        f"ON {MV_NAME} (transaction_id, transaction_type, organization_id);"
    )

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

    op.execute(
        """
        CREATE TRIGGER refresh_transaction_view_after_transfer
        AFTER INSERT OR UPDATE OR DELETE ON transfer
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_transaction_aggregate();
        """
    )
    op.execute(
        """
        CREATE TRIGGER refresh_transaction_view_after_initiative_agreement
        AFTER INSERT OR UPDATE OR DELETE ON initiative_agreement
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_transaction_aggregate();
        """
    )
    op.execute(
        """
        CREATE TRIGGER refresh_transaction_view_after_admin_adjustment
        AFTER INSERT OR UPDATE OR DELETE ON admin_adjustment
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_transaction_aggregate();
        """
    )
    op.execute(
        """
        CREATE TRIGGER refresh_transaction_view_after_transfer_history
        AFTER INSERT OR UPDATE OR DELETE ON transfer_history
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_transaction_aggregate();
        """
    )
    op.execute(
        """
        CREATE TRIGGER refresh_transaction_view_after_initiative_agreement_history
        AFTER INSERT OR UPDATE OR DELETE ON initiative_agreement_history
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_transaction_aggregate();
        """
    )
    op.execute(
        """
        CREATE TRIGGER refresh_transaction_view_after_admin_adjustment_history
        AFTER INSERT OR UPDATE OR DELETE ON admin_adjustment_history
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_transaction_aggregate();
        """
    )
    op.execute(
        """
        CREATE TRIGGER refresh_transaction_view_after_compliance_report
        AFTER INSERT OR UPDATE OR DELETE ON compliance_report
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_transaction_aggregate();
        """
    )
    op.execute(
        """
        CREATE TRIGGER refresh_transaction_view_after_transfer_comment
        AFTER INSERT OR UPDATE OR DELETE ON transfer_comment
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_transaction_aggregate();
        """
    )


def downgrade() -> None:
    op.execute(f"DROP MATERIALIZED VIEW IF EXISTS {MV_NAME} CASCADE;")

    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer ON transfer;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_initiative_agreement ON initiative_agreement;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_admin_adjustment ON admin_adjustment;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer_history ON transfer_history;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_initiative_agreement_history ON initiative_agreement_history;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_admin_adjustment_history ON admin_adjustment_history;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_compliance_report ON compliance_report;"
    )

    op.execute(
        "DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer_comment ON transfer_comment;"
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION refresh_transaction_aggregate()
        RETURNS TRIGGER AS $$
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_aggregate;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    op.execute(
        """
        CREATE TRIGGER refresh_transaction_view_after_transfer
        AFTER INSERT OR UPDATE OR DELETE ON transfer
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_transaction_aggregate();
        """
    )
    op.execute(
        """
        CREATE TRIGGER refresh_transaction_view_after_initiative_agreement
        AFTER INSERT OR UPDATE OR DELETE ON initiative_agreement
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_transaction_aggregate();
        """
    )
    op.execute(
        """
        CREATE TRIGGER refresh_transaction_view_after_admin_adjustment
        AFTER INSERT OR UPDATE OR DELETE ON admin_adjustment
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_transaction_aggregate();
        """
    )
    op.execute(
        """
        CREATE TRIGGER refresh_transaction_view_after_transfer_history
        AFTER INSERT OR UPDATE OR DELETE ON transfer_history
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_transaction_aggregate();
        """
    )
    op.execute(
        """
        CREATE TRIGGER refresh_transaction_view_after_initiative_agreement_history
        AFTER INSERT OR UPDATE OR DELETE ON initiative_agreement_history
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_transaction_aggregate();
        """
    )
    op.execute(
        """
        CREATE TRIGGER refresh_transaction_view_after_admin_adjustment_history
        AFTER INSERT OR UPDATE OR DELETE ON admin_adjustment_history
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_transaction_aggregate();
        """
    )
    op.execute(
        """
        CREATE TRIGGER refresh_transaction_view_after_compliance_report
        AFTER INSERT OR UPDATE OR DELETE ON compliance_report
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_transaction_aggregate();
        """
    )
    op.execute(
        """
        CREATE TRIGGER refresh_transaction_view_after_transfer_comment
        AFTER INSERT OR UPDATE OR DELETE ON transfer_comment
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_transaction_aggregate();
        """
    )
