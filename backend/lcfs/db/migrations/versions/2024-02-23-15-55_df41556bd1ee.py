"""consolidated transactions view

Revision ID: df41556bd1ee
Revises: 5d3a79582d21
Create Date: 2024-02-23 15:55:51.324164

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "df41556bd1ee"
down_revision = "5d3a79582d21"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
    CREATE OR REPLACE VIEW transaction_view AS
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


def downgrade() -> None:
    op.execute("""DROP VIEW IF EXISTS transaction_view;""")
    op.execute("""DROP VIEW IF EXISTS transaction_status_view;""")
    