"""Update 'price_per_unit' column from Integer to Numeric(10, 2).

Revision ID: bb5504e743a0
Revises: a731a32947dc
Create Date: 2024-10-18 19:48:34.877657

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "bb5504e743a0"
down_revision = "a731a32947dc"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 1: Drop materialized view and related triggers/functions temporarily
    drop_transaction_aggregate_dependencies()

    # Step 2: Alter the 'price_per_unit' column type
    op.alter_column(
        "transfer",
        "price_per_unit",
        existing_type=sa.Integer(),
        type_=sa.Numeric(10, 2),
        existing_nullable=True,
        comment="Price per unit with two decimal precision"
    )

    # Step 3: Recreate materialized view and triggers/functions
    create_transaction_aggregate_dependencies()

def downgrade() -> None:
    # Step 1: Drop triggers and materialized view
    drop_transaction_aggregate_dependencies()

    # Step 2: Revert the 'price_per_unit' column type back to Integer
    op.alter_column(
        "transfer",
        "price_per_unit",
        existing_type=sa.Numeric(10, 2),
        type_=sa.Integer(),
        existing_nullable=True,
        comment="Price per unit"
    )

    # Step 3: Recreate materialized view, triggers, and functions
    create_transaction_aggregate_dependencies()

def drop_transaction_aggregate_dependencies():
    # Drop existing triggers
    op.execute("""DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer ON transfer;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_transaction_view_after_initiative_agreement ON initiative_agreement;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_transaction_view_after_admin_adjustment ON admin_adjustment;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer_history ON transfer_history;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_transaction_view_after_initiative_agreement_history ON initiative_agreement_history;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_transaction_view_after_admin_adjustment_history ON admin_adjustment_history;""")

    # Drop existing functions
    op.execute("""DROP FUNCTION IF EXISTS refresh_transaction_aggregate();""")

    # Drop existing materialized views and views
    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_transaction_aggregate;""")

def create_transaction_aggregate_dependencies():
    # Create mv_transaction_aggregate materialized view
    op.execute("""
    CREATE MATERIALIZED VIEW mv_transaction_aggregate AS
    SELECT
        t.transfer_id AS transaction_id,
        'Transfer' AS transaction_type,
        org_from.organization_id AS from_organization_id,
        org_from.name AS from_organization,
        org_to.organization_id AS to_organization_id,
        org_to.name AS to_organization,
        t.quantity,
        t.price_per_unit,
        ts.status::text AS status,
        NULL AS compliance_period,
        t.from_org_comment AS comment,
        tc.category,
        (
            SELECT th.create_date 
            FROM transfer_history th 
            WHERE th.transfer_id = t.transfer_id AND th.transfer_status_id = 6
        ) AS recorded_date,
        NULL AS approved_date,
        t.transaction_effective_date,
        t.update_date,
        t.create_date
    FROM transfer t
    JOIN organization org_from ON t.from_organization_id = org_from.organization_id
    JOIN organization org_to ON t.to_organization_id = org_to.organization_id
    JOIN transfer_status ts ON t.current_status_id = ts.transfer_status_id
    LEFT JOIN transfer_category tc ON t.transfer_category_id = tc.transfer_category_id
    UNION ALL
    SELECT
        ia.initiative_agreement_id AS transaction_id,
        'InitiativeAgreement' AS transaction_type,
        NULL AS from_organization_id,
        NULL AS from_organization,
        org.organization_id AS to_organization_id,
        org.name AS to_organization,
        ia.compliance_units AS quantity,
        NULL AS price_per_unit,
        ias.status::text AS status,
        NULL AS compliance_period,
        ia.gov_comment AS comment,
        NULL AS category,
        NULL AS recorded_date,
        (
            SELECT iah.create_date 
            FROM initiative_agreement_history iah 
            WHERE iah.initiative_agreement_id = ia.initiative_agreement_id AND iah.initiative_agreement_status_id = 3
        ) AS approved_date,
        ia.transaction_effective_date,
        ia.update_date,
        ia.create_date
    FROM initiative_agreement ia
    JOIN organization org ON ia.to_organization_id = org.organization_id
    JOIN initiative_agreement_status ias ON ia.current_status_id = ias.initiative_agreement_status_id
    UNION ALL
    SELECT
        aa.admin_adjustment_id AS transaction_id,
        'AdminAdjustment' AS transaction_type,
        NULL AS from_organization_id,
        NULL AS from_organization,
        org.organization_id AS to_organization_id,
        org.name AS to_organization,
        aa.compliance_units AS quantity,
        NULL AS price_per_unit,
        aas.status::text AS status,
        NULL AS compliance_period,
        aa.gov_comment AS comment,
        NULL AS category,
        NULL AS recorded_date,
        (
            SELECT aah.create_date 
            FROM admin_adjustment_history aah 
            WHERE aah.admin_adjustment_id = aa.admin_adjustment_id AND aah.admin_adjustment_status_id = 3
        ) AS approved_date,
        aa.transaction_effective_date,
        aa.update_date,
        aa.create_date
    FROM admin_adjustment aa
    JOIN organization org ON aa.to_organization_id = org.organization_id
    JOIN admin_adjustment_status aas ON aa.current_status_id = aas.admin_adjustment_status_id;
    """)

    # Create unique index on mv_transaction_aggregate
    op.execute("""
    CREATE UNIQUE INDEX mv_transaction_aggregate_unique_idx ON mv_transaction_aggregate (transaction_id, transaction_type);
    """)

    # Create refresh_transaction_aggregate function
    op.execute("""
    CREATE OR REPLACE FUNCTION refresh_transaction_aggregate()
    RETURNS TRIGGER AS $$
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_aggregate;
        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
    """)

    # Create triggers to refresh mv_transaction_aggregate
    op.execute("""
    CREATE TRIGGER refresh_transaction_view_after_transfer
    AFTER INSERT OR UPDATE OR DELETE ON transfer
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
    """)
    op.execute("""
    CREATE TRIGGER refresh_transaction_view_after_initiative_agreement
    AFTER INSERT OR UPDATE OR DELETE ON initiative_agreement
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
    """)
    op.execute("""
    CREATE TRIGGER refresh_transaction_view_after_admin_adjustment
    AFTER INSERT OR UPDATE OR DELETE ON admin_adjustment
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
    """)
    op.execute("""
    CREATE TRIGGER refresh_transaction_view_after_transfer_history
    AFTER INSERT OR UPDATE OR DELETE ON transfer_history
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
    """)
    op.execute("""
    CREATE TRIGGER refresh_transaction_view_after_initiative_agreement_history
    AFTER INSERT OR UPDATE OR DELETE ON initiative_agreement_history
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
    """)
    op.execute("""
    CREATE TRIGGER refresh_transaction_view_after_admin_adjustment_history
    AFTER INSERT OR UPDATE OR DELETE ON admin_adjustment_history
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
    """)
