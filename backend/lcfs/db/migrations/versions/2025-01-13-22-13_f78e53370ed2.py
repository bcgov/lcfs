"""Add CR to Transaction Aggregate

Revision ID: f78e53370ed2
Revises: d25e7c47659e
Create Date: 2025-01-13 22:13:48.610890

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "f78e53370ed2"
down_revision = "d25e7c47659e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW mv_transaction_aggregate;")
    op.execute(
        """
        CREATE MATERIALIZED VIEW mv_transaction_aggregate AS
        SELECT
            t.transfer_id AS transaction_id,
            'Transfer' AS transaction_type,
            NULL AS description,
            org_from.organization_id AS from_organization_id,
            org_from.name AS from_organization,
            org_to.organization_id AS to_organization_id,
            org_to.name AS to_organization,
            t.quantity,
            t.price_per_unit,
            ts.status::text AS status,
            NULL AS compliance_period,
            t.from_org_comment AS COMMENT,
            tc.category,
            (
                SELECT
                    th.create_date
                FROM
                    transfer_history th
                WHERE
                    th.transfer_id = t.transfer_id
                    AND th.transfer_status_id = 6) AS recorded_date, NULL AS approved_date, t.transaction_effective_date, t.update_date, t.create_date
            FROM
                transfer t
                JOIN organization org_from ON t.from_organization_id = org_from.organization_id
                JOIN organization org_to ON t.to_organization_id = org_to.organization_id
                JOIN transfer_status ts ON t.current_status_id = ts.transfer_status_id
                LEFT JOIN transfer_category tc ON t.transfer_category_id = tc.transfer_category_id
        UNION ALL
        SELECT
            ia.initiative_agreement_id AS transaction_id,
            'InitiativeAgreement' AS transaction_type,
            NULL AS description,
            NULL AS from_organization_id,
            NULL AS from_organization,
            org.organization_id AS to_organization_id,
            org.name AS to_organization,
            ia.compliance_units AS quantity,
            NULL AS price_per_unit,
            ias.status::text AS status,
            NULL AS compliance_period,
            ia.gov_comment AS COMMENT,
            NULL AS category,
            NULL AS recorded_date,
            (
                SELECT
                    iah.create_date
                FROM
                    initiative_agreement_history iah
                WHERE
                    iah.initiative_agreement_id = ia.initiative_agreement_id
                    AND iah.initiative_agreement_status_id = 3) AS approved_date, ia.transaction_effective_date, ia.update_date, ia.create_date
            FROM
                initiative_agreement ia
                JOIN organization org ON ia.to_organization_id = org.organization_id
                JOIN initiative_agreement_status ias ON ia.current_status_id = ias.initiative_agreement_status_id
        UNION ALL
        SELECT
            aa.admin_adjustment_id AS transaction_id,
            'AdminAdjustment' AS transaction_type,
            NULL AS description,
            NULL AS from_organization_id,
            NULL AS from_organization,
            org.organization_id AS to_organization_id,
            org.name AS to_organization,
            aa.compliance_units AS quantity,
            NULL AS price_per_unit,
            aas.status::text AS status,
            NULL AS compliance_period,
            aa.gov_comment AS COMMENT,
            NULL AS category,
            NULL AS recorded_date,
            (
                SELECT
                    aah.create_date
                FROM
                    admin_adjustment_history aah
                WHERE
                    aah.admin_adjustment_id = aa.admin_adjustment_id
                    AND aah.admin_adjustment_status_id = 3) AS approved_date, aa.transaction_effective_date, aa.update_date, aa.create_date
            FROM
                admin_adjustment aa
                JOIN organization org ON aa.to_organization_id = org.organization_id
                JOIN admin_adjustment_status aas ON aa.current_status_id = aas.admin_adjustment_status_id
        UNION ALL
        SELECT
            cr.compliance_report_id AS transaction_id,
            'ComplianceReport' AS transaction_type,
            cr.nickname AS description,
            NULL AS from_organization_id,
            NULL AS from_organization,
            org.organization_id AS to_organization_id,
            org.name AS to_organization,
            tr.compliance_units AS quantity,
            NULL AS price_per_unit,
            crs.status::text AS status,
            cp.description AS compliance_period,
            NULL AS COMMENT,
            NULL AS category,
            NULL AS recorded_date,
            NULL AS approved_date,
            NULL AS transaction_effective_date,
            cr.update_date,
            cr.create_date
        FROM
            compliance_report cr
            JOIN organization org ON cr.organization_id = org.organization_id
            JOIN compliance_report_status crs ON cr.current_status_id = crs.compliance_report_status_id
            JOIN compliance_period cp ON cr.compliance_period_id = cp.compliance_period_id
            JOIN TRANSACTION tr ON cr.transaction_id = tr.transaction_id
                AND cr.transaction_id IS NOT NULL;
        """
    )

    # Create unique index on mv_transaction_aggregate
    op.execute(
        """
    CREATE UNIQUE INDEX mv_transaction_aggregate_unique_idx ON mv_transaction_aggregate (transaction_id, description, transaction_type);
    """
    )


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW mv_transaction_aggregate;")
    op.execute(
        """
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
        """
    )

    # Create unique index on mv_transaction_aggregate
    op.execute(
        """
    CREATE UNIQUE INDEX mv_transaction_aggregate_unique_idx ON mv_transaction_aggregate (transaction_id, transaction_type);
    """
    )
