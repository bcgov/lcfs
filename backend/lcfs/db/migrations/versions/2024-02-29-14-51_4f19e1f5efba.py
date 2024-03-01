"""Update to transactions view to include organization id

Revision ID: 4f19e1f5efba
Revises: 3c9a518adbea
Create Date: 2024-02-29 14:51:47.401604

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "4f19e1f5efba"
down_revision = "3c9a518adbea"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drops the triggers created to refresh the materialized view upon changes in related tables.
    op.execute("""DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer ON transfer;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_transaction_view_after_initiative_agreement ON initiative_agreement;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_transaction_view_after_admin_adjustment ON admin_adjustment;""")

    # Drops the function designed to refresh the materialized view 'mv_transaction_aggregate'.
    op.execute("""DROP FUNCTION IF EXISTS refresh_transaction_aggregate();""")

    # Drops the materialized view 'mv_transaction_aggregate'.
    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_transaction_aggregate;""")

    # Drops the view 'transaction_status_view'.
    op.execute("""DROP VIEW IF EXISTS transaction_status_view;""")
    # Creates or replaces a materialized view named 'mv_transaction_aggregate'.
    # This view aggregates data from three different sources: transfers, initiative agreements, and admin adjustments.
    # Each source contributes records with a unified structure to facilitate transaction aggregation.
    # Fields include transaction ID, type, participating organizations, quantity, unit price, status, and timestamps.
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
        t.update_date,
        t.create_date
    FROM transfer t
    JOIN organization org_from ON t.from_organization_id = org_from.organization_id
    JOIN organization org_to ON t.to_organization_id = org_to.organization_id
    JOIN transfer_status ts ON t.current_status_id = ts.transfer_status_id
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
        aa.update_date,
        aa.create_date
    FROM admin_adjustment aa
    JOIN organization org ON aa.to_organization_id = org.organization_id
    JOIN admin_adjustment_status aas ON aa.current_status_id = aas.admin_adjustment_status_id;
    """)

    # Creates a unique composite key for our mv_transaction_aggregate view so it 
    # can be updated concurrently
    op.execute("""
    CREATE UNIQUE INDEX mv_transaction_aggregate_unique_idx ON mv_transaction_aggregate (transaction_id, transaction_type);
    """)

    # Creates or replaces a view named 'transaction_status_view'.
    # This view consolidates status information from three tables: initiative_agreement_status, 
    # admin_adjustment_status, and transfer_status, providing a unified view of statuses across transaction types.
    # Includes status text, creation date, and last update date for each status record.
    op.execute("""
    CREATE OR REPLACE VIEW transaction_status_view AS
    SELECT 
        status::text, 
        create_date,
        update_date
    FROM initiative_agreement_status
    UNION
    SELECT         
        status::text, 
        create_date,
        update_date 
    FROM admin_adjustment_status
    UNION
    SELECT 
        status::text, 
        create_date,
        update_date  
    FROM transfer_status;
    """)

    # Creates or replaces a function named 'refresh_transaction_aggregate'.
    # This function is designed to refresh the materialized view 'mv_transaction_aggregate'.
    # It is triggered to run after certain operations (INSERT, UPDATE, DELETE) on specific tables.
    op.execute("""
    CREATE OR REPLACE FUNCTION refresh_transaction_aggregate()
    RETURNS TRIGGER AS $$
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_aggregate;
        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
    """)

    # Creates a trigger named 'refresh_transaction_view_after_transfer'.
    # This trigger activates after any INSERT, UPDATE, or DELETE operation on the 'transfer' table.
    # It calls the 'refresh_transaction_aggregate' function to refresh the materialized view.
    op.execute("""
    CREATE TRIGGER refresh_transaction_view_after_transfer
    AFTER INSERT OR UPDATE OR DELETE ON transfer
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
    """)

    # Creates a trigger named 'refresh_transaction_view_after_initiative_agreement'.
    # This trigger activates after any INSERT, UPDATE, or DELETE operation on the 'initiative_agreement' table.
    # It ensures the materialized view is refreshed to include the latest data by calling the same refresh function.
    op.execute("""
    CREATE TRIGGER refresh_transaction_view_after_initiative_agreement
    AFTER INSERT OR UPDATE OR DELETE ON initiative_agreement
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
    """)

    # Creates a trigger named 'refresh_transaction_view_after_admin_adjustment'.
    # Activates after any INSERT, UPDATE, or DELETE operation on the 'admin_adjustment' table.
    # Calls 'refresh_transaction_aggregate' to ensure the materialized view remains up-to-date.
    op.execute("""
    CREATE TRIGGER refresh_transaction_view_after_admin_adjustment
    AFTER INSERT OR UPDATE OR DELETE ON admin_adjustment
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
    """)

def downgrade() -> None:
    # Drops the triggers created to refresh the materialized view upon changes in related tables.
    op.execute("""DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer ON transfer;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_transaction_view_after_initiative_agreement ON initiative_agreement;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_transaction_view_after_admin_adjustment ON admin_adjustment;""")

    # Drops the function designed to refresh the materialized view 'mv_transaction_aggregate'.
    op.execute("""DROP FUNCTION IF EXISTS refresh_transaction_aggregate();""")

    # Drops the materialized view 'mv_transaction_aggregate'.
    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_transaction_aggregate;""")

    # Drops the view 'transaction_status_view'.
    op.execute("""DROP VIEW IF EXISTS transaction_status_view;""")

    # Creates or replaces a materialized view named 'mv_transaction_aggregate'.
    # This view aggregates data from three different sources: transfers, initiative agreements, and admin adjustments.
    # Each source contributes records with a unified structure to facilitate transaction aggregation.
    # Fields include transaction ID, type, participating organizations, quantity, unit price, status, and timestamps.
    op.execute("""
    CREATE MATERIALIZED VIEW mv_transaction_aggregate AS
    SELECT
        t.transfer_id AS transaction_id,
        'Transfer' AS transaction_type,
        org_from.name AS from_organization,
        org_to.name AS to_organization,
        t.quantity,
        t.price_per_unit,
        ts.status::text AS status,
        t.update_date,
        t.create_date
    FROM transfer t
    JOIN organization org_from ON t.from_organization_id = org_from.organization_id
    JOIN organization org_to ON t.to_organization_id = org_to.organization_id
    JOIN transfer_status ts ON t.current_status_id = ts.transfer_status_id
    UNION ALL
    SELECT
        ia.initiative_agreement_id AS transaction_id,
        'InitiativeAgreement' AS transaction_type,
        NULL AS from_organization,
        org.name AS to_organization,
        ia.compliance_units AS quantity,
        NULL AS price_per_unit,
        ias.status::text AS status,
        ia.update_date,
        ia.create_date
    FROM initiative_agreement ia
    JOIN organization org ON ia.to_organization_id = org.organization_id
    JOIN initiative_agreement_status ias ON ia.current_status_id = ias.initiative_agreement_status_id
    UNION ALL
    SELECT
        aa.admin_adjustment_id AS transaction_id,
        'AdminAdjustment' AS transaction_type,
        NULL AS from_organization,
        org.name AS to_organization,
        aa.compliance_units AS quantity,
        NULL AS price_per_unit,
        aas.status::text AS status,
        aa.update_date,
        aa.create_date
    FROM admin_adjustment aa
    JOIN organization org ON aa.to_organization_id = org.organization_id
    JOIN admin_adjustment_status aas ON aa.current_status_id = aas.admin_adjustment_status_id;
    """)

    # Creates a unique composite key for our mv_transaction_aggregate view so it 
    # can be updated concurrently
    op.execute("""
    CREATE UNIQUE INDEX mv_transaction_aggregate_unique_idx ON mv_transaction_aggregate (transaction_id, transaction_type);
    """)

    # Creates or replaces a view named 'transaction_status_view'.
    # This view consolidates status information from three tables: initiative_agreement_status, 
    # admin_adjustment_status, and transfer_status, providing a unified view of statuses across transaction types.
    # Includes status text, creation date, and last update date for each status record.
    op.execute("""
    CREATE OR REPLACE VIEW transaction_status_view AS
    SELECT 
        status::text, 
        create_date,
        update_date
    FROM initiative_agreement_status
    UNION
    SELECT         
        status::text, 
        create_date,
        update_date 
    FROM admin_adjustment_status
    UNION
    SELECT 
        status::text, 
        create_date,
        update_date  
    FROM transfer_status;
    """)

    # Creates or replaces a function named 'refresh_transaction_aggregate'.
    # This function is designed to refresh the materialized view 'mv_transaction_aggregate'.
    # It is triggered to run after certain operations (INSERT, UPDATE, DELETE) on specific tables.
    op.execute("""
    CREATE OR REPLACE FUNCTION refresh_transaction_aggregate()
    RETURNS TRIGGER AS $$
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_aggregate;
        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
    """)

    # Creates a trigger named 'refresh_transaction_view_after_transfer'.
    # This trigger activates after any INSERT, UPDATE, or DELETE operation on the 'transfer' table.
    # It calls the 'refresh_transaction_aggregate' function to refresh the materialized view.
    op.execute("""
    CREATE TRIGGER refresh_transaction_view_after_transfer
    AFTER INSERT OR UPDATE OR DELETE ON transfer
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
    """)

    # Creates a trigger named 'refresh_transaction_view_after_initiative_agreement'.
    # This trigger activates after any INSERT, UPDATE, or DELETE operation on the 'initiative_agreement' table.
    # It ensures the materialized view is refreshed to include the latest data by calling the same refresh function.
    op.execute("""
    CREATE TRIGGER refresh_transaction_view_after_initiative_agreement
    AFTER INSERT OR UPDATE OR DELETE ON initiative_agreement
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
    """)

    # Creates a trigger named 'refresh_transaction_view_after_admin_adjustment'.
    # Activates after any INSERT, UPDATE, or DELETE operation on the 'admin_adjustment' table.
    # Calls 'refresh_transaction_aggregate' to ensure the materialized view remains up-to-date.
    op.execute("""
    CREATE TRIGGER refresh_transaction_view_after_admin_adjustment
    AFTER INSERT OR UPDATE OR DELETE ON admin_adjustment
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
    """)
