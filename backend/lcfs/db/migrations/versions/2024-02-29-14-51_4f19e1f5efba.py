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


def downgrade() -> None:
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

