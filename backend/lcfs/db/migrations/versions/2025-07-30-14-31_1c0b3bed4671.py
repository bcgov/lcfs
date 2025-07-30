"""big int for quantities

Revision ID: 1c0b3bed4671
Revises: b1c2d3e4f5g6
Create Date: 2025-07-25 14:31:49.034570

"""

import sqlalchemy as sa
from alembic import op
from lcfs.db.dependencies import (
    create_role_if_not_exists,
    execute_sql_sections,
    find_and_read_sql_file,
    parse_sql_sections,
)

# revision identifiers, used by Alembic.
revision = "1c0b3bed4671"
down_revision = "b1c2d3e4f5g6"
branch_labels = None
depends_on = None

# Sections to recreate after altering columns
SECTIONS_TO_EXECUTE = [
    "Allocation Agreement Base View",
    "Fuel Export Analytics Base View",
    "Fuel Supply Analytics Base View",
    "Fuel Supply Base View",
    "Compliance Report Fuel Supply Base View",
    "Fuel Supply Fuel Code Base View",
    "Transfer Base View",
]


def create_mv_transaction_aggregate():
    """Create the mv_transaction_aggregate materialized view with current schema."""
    op.execute(
        """
        CREATE MATERIALIZED VIEW mv_transaction_aggregate AS
            with all_transactions as (
                ------------------------------------------------------------------------
                -- Transfers
                ------------------------------------------------------------------------
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
                    CASE
                        WHEN ts.status = 'Recorded' THEN
                            EXTRACT(YEAR FROM COALESCE(t.transaction_effective_date, (
                                SELECT th.create_date
                                FROM transfer_history th
                                WHERE th.transfer_id = t.transfer_id
                                AND th.transfer_status_id = 6  -- Recorded
                                LIMIT 1
                            )))::text
                        ELSE 'N/A'
                    END AS compliance_period,
                    -- Get the FROM_ORG comment if it exists
                    (
                        SELECT tc.comment
                        FROM transfer_comment tc
                        WHERE tc.transfer_id = t.transfer_id
                        AND tc.comment_source = 'FROM_ORG'
                        LIMIT 1
                    ) AS from_org_comment,
                    -- Get the TO_ORG comment if it exists
                    (
                        SELECT tc.comment
                        FROM transfer_comment tc
                        WHERE tc.transfer_id = t.transfer_id
                        AND tc.comment_source = 'TO_ORG'
                        LIMIT 1
                    ) AS to_org_comment,
                    -- Get the GOVERNMENT comment if it exists
                    (
                        SELECT tc.comment
                        FROM transfer_comment tc
                        WHERE tc.transfer_id = t.transfer_id
                        AND tc.comment_source = 'GOVERNMENT'
                        LIMIT 1
                    ) AS government_comment,
                    tc.category,
                    (
                        SELECT th.create_date
                        FROM transfer_history th
                        WHERE th.transfer_id = t.transfer_id
                        AND th.transfer_status_id = 6  -- Recorded
                        LIMIT 1
                    ) AS recorded_date,
                    NULL AS approved_date,
                    t.transaction_effective_date,
                    t.update_date,
                    t.create_date
                FROM transfer t
                JOIN organization org_from
                    ON t.from_organization_id = org_from.organization_id
                JOIN organization org_to
                    ON t.to_organization_id = org_to.organization_id
                JOIN transfer_status ts
                    ON t.current_status_id = ts.transfer_status_id
                LEFT JOIN transfer_category tc
                    ON t.transfer_category_id = tc.transfer_category_id
                UNION ALL
                ------------------------------------------------------------------------
                -- Initiative Agreements
                ------------------------------------------------------------------------
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
                    EXTRACT(YEAR FROM ia.transaction_effective_date)::text AS compliance_period,
                    null as from_org_comment,
                    null as to_org_comment,
                    ia.gov_comment AS government_comment,
                    NULL AS category,
                    NULL AS recorded_date,
                    (
                        SELECT iah.create_date
                        FROM initiative_agreement_history iah
                        WHERE iah.initiative_agreement_id = ia.initiative_agreement_id
                        AND iah.initiative_agreement_status_id = 3 -- Approved
                        LIMIT 1
                    ) AS approved_date,
                    ia.transaction_effective_date,
                    ia.update_date,
                    ia.create_date
                FROM initiative_agreement ia
                JOIN organization org
                    ON ia.to_organization_id = org.organization_id
                JOIN initiative_agreement_status ias
                    ON ia.current_status_id = ias.initiative_agreement_status_id
                UNION ALL
                ------------------------------------------------------------------------
                -- Admin Adjustments
                ------------------------------------------------------------------------
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
                    EXTRACT(YEAR FROM aa.transaction_effective_date)::text AS compliance_period,
                    null as from_org_comment,
                    null as to_org_comment,
                    aa.gov_comment AS government_comment,
                    NULL AS category,
                    NULL AS recorded_date,
                    (
                        SELECT aah.create_date
                        FROM admin_adjustment_history aah
                        WHERE aah.admin_adjustment_id = aa.admin_adjustment_id
                        AND aah.admin_adjustment_status_id = 3 -- Approved
                        LIMIT 1
                    ) AS approved_date,
                    aa.transaction_effective_date,
                    aa.update_date,
                    aa.create_date
                FROM admin_adjustment aa
                JOIN organization org
                    ON aa.to_organization_id = org.organization_id
                JOIN admin_adjustment_status aas
                    ON aa.current_status_id = aas.admin_adjustment_status_id
                UNION ALL
                ------------------------------------------------------------------------
                -- Compliance Reports
                ------------------------------------------------------------------------
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
                    NULL as from_org_comment,
                    NULL as to_org_comment,
                    NULL AS government_comment,
                    NULL AS category,
                    NULL AS recorded_date,
                    NULL AS approved_date,
                    NULL AS transaction_effective_date,
                    cr.update_date,
                    cr.create_date
                FROM compliance_report cr
                JOIN organization org
                    ON cr.organization_id = org.organization_id
                JOIN compliance_report_status crs
                    ON cr.current_status_id = crs.compliance_report_status_id
                JOIN compliance_period cp
                    ON cr.compliance_period_id = cp.compliance_period_id
                JOIN "transaction" tr
                    ON cr.transaction_id = tr.transaction_id
                AND cr.transaction_id IS NOT NULL
                WHERE crs.status IN ('Assessed', 'Reassessed')
            )
            SELECT DISTINCT * FROM all_transactions;
    """
    )


def create_mv_transaction_aggregate_index():
    """Create unique index on the materialized view for concurrent refresh."""
    op.execute(
        """
        CREATE UNIQUE INDEX mv_transaction_aggregate_unique_idx
            ON mv_transaction_aggregate (
                transaction_id,
                transaction_type
            );
        """
    )


def create_mv_credit_ledger():
    """Create the mv_credit_ledger materialized view."""
    op.execute(
        """
        CREATE MATERIALIZED VIEW mv_credit_ledger AS
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
    )


def create_mv_credit_ledger_indexes():
    """Create indexes for mv_credit_ledger."""
    op.execute(
        "CREATE INDEX mv_credit_ledger_org_year_idx ON mv_credit_ledger (organization_id, compliance_period);"
    )
    op.execute(
        "CREATE INDEX mv_credit_ledger_org_date_idx ON mv_credit_ledger (organization_id, update_date DESC);"
    )
    op.execute(
        "CREATE UNIQUE INDEX mv_credit_ledger_tx_org_idx ON mv_credit_ledger (transaction_id, transaction_type, organization_id);"
    )


def recreate_materialized_views():
    """Recreate all materialized views and their indexes."""
    # Recreate views from metabase.sql
    create_role_if_not_exists()
    content = find_and_read_sql_file(sqlFile="metabase.sql")
    sections = parse_sql_sections(content)
    execute_sql_sections(sections, SECTIONS_TO_EXECUTE)

    # Recreate materialized views
    create_mv_transaction_aggregate()
    create_mv_transaction_aggregate_index()
    create_mv_credit_ledger()
    create_mv_credit_ledger_indexes()


def upgrade() -> None:
    # Drop views and materialized views that depend on the columns being altered
    # Using CASCADE to drop dependent views automatically
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_credit_ledger CASCADE;")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_transaction_aggregate CASCADE;")
    op.execute("DROP VIEW IF EXISTS vw_allocation_agreement_base CASCADE;")
    op.execute("DROP VIEW IF EXISTS vw_fuel_export_analytics_base CASCADE;")
    op.execute("DROP VIEW IF EXISTS vw_fuel_supply_analytics_base CASCADE;")
    op.execute("DROP VIEW IF EXISTS vw_fuel_supply_base CASCADE;")
    op.execute("DROP VIEW IF EXISTS vw_compliance_report_fuel_supply_base CASCADE;")
    op.execute("DROP VIEW IF EXISTS vw_fuel_supply_fuel_code_base CASCADE;")
    op.execute("DROP VIEW IF EXISTS vw_transfer_base CASCADE;")

    # Alter allocation_agreement columns
    op.alter_column(
        "allocation_agreement",
        "quantity",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_comment="Quantity of fuel involved in the transaction",
        existing_nullable=True,
    )
    op.alter_column(
        "allocation_agreement",
        "q1_quantity",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_comment="Quantity of fuel involved in Q1 (early issuance only)",
        existing_nullable=True,
    )
    op.alter_column(
        "allocation_agreement",
        "q2_quantity",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_comment="Quantity of fuel involved in Q2 (early issuance only)",
        existing_nullable=True,
    )
    op.alter_column(
        "allocation_agreement",
        "q3_quantity",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_comment="Quantity of fuel involved in Q3 (early issuance only)",
        existing_nullable=True,
    )
    op.alter_column(
        "allocation_agreement",
        "q4_quantity",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_comment="Quantity of fuel involved in Q4 (early issuance only)",
        existing_nullable=True,
    )
    op.alter_column(
        "allocation_agreement",
        "quantity_not_sold",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_comment="Quantity not sold or supplied within the compliance period",
        existing_nullable=True,
    )
    op.alter_column(
        "fuel_export",
        "quantity",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_comment="Quantity of fuel supplied",
        existing_nullable=False,
    )
    op.alter_column(
        "fuel_supply",
        "quantity",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_comment="Quantity of fuel supplied (no early issuance)",
        existing_nullable=True,
    )
    op.alter_column(
        "fuel_supply",
        "q1_quantity",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_comment="Quantity of fuel supplied in Q1 (early issuance only)",
        existing_nullable=True,
    )
    op.alter_column(
        "fuel_supply",
        "q2_quantity",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_comment="Quantity of fuel supplied in Q2 (early issuance only)",
        existing_nullable=True,
    )
    op.alter_column(
        "fuel_supply",
        "q3_quantity",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_comment="Quantity of fuel supplied in Q3 (early issuance only)",
        existing_nullable=True,
    )
    op.alter_column(
        "fuel_supply",
        "q4_quantity",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_comment="Quantity of fuel supplied in Q4 (early issuance only)",
        existing_nullable=True,
    )
    op.alter_column(
        "notional_transfer",
        "quantity",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_comment="Quantity of fuel being notionally transferred (no early issuance)",
        existing_nullable=True,
    )
    op.alter_column(
        "notional_transfer",
        "q1_quantity",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_comment="Quantity of fuel being notionally transferred in Q1 (early issuance only)",
        existing_nullable=True,
    )
    op.alter_column(
        "notional_transfer",
        "q2_quantity",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_comment="Quantity of fuel being notionally transferred in Q2 (early issuance only)",
        existing_nullable=True,
    )
    op.alter_column(
        "notional_transfer",
        "q3_quantity",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_comment="Quantity of fuel being notionally transferred in Q3 (early issuance only)",
        existing_nullable=True,
    )
    op.alter_column(
        "notional_transfer",
        "q4_quantity",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_comment="Quantity of fuel being notionally transferred in Q4 (early issuance only)",
        existing_nullable=True,
    )
    op.alter_column(
        "other_uses",
        "quantity_supplied",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_comment="Quantity of fuel used. Cannot be negative.",
        existing_nullable=False,
    )
    op.alter_column(
        "transfer",
        "quantity",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_comment="Quantity of units",
        existing_nullable=True,
    )

    # Recreate all views and materialized views
    recreate_materialized_views()


def downgrade() -> None:
    # Drop views and materialized views before altering columns back
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_credit_ledger CASCADE;")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_transaction_aggregate CASCADE;")
    op.execute("DROP VIEW IF EXISTS vw_allocation_agreement_base CASCADE;")
    op.execute("DROP VIEW IF EXISTS vw_fuel_export_analytics_base CASCADE;")
    op.execute("DROP VIEW IF EXISTS vw_fuel_supply_analytics_base CASCADE;")
    op.execute("DROP VIEW IF EXISTS vw_fuel_supply_base CASCADE;")
    op.execute("DROP VIEW IF EXISTS vw_compliance_report_fuel_supply_base CASCADE;")
    op.execute("DROP VIEW IF EXISTS vw_fuel_supply_fuel_code_base CASCADE;")
    op.execute("DROP VIEW IF EXISTS vw_transfer_base CASCADE;")

    # Alter columns back to INTEGER
    op.alter_column(
        "transfer",
        "quantity",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_comment="Quantity of units",
        existing_nullable=True,
    )
    op.alter_column(
        "other_uses",
        "quantity_supplied",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_comment="Quantity of fuel used. Cannot be negative.",
        existing_nullable=False,
    )
    op.alter_column(
        "notional_transfer",
        "q4_quantity",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_comment="Quantity of fuel being notionally transferred in Q4 (early issuance only)",
        existing_nullable=True,
    )
    op.alter_column(
        "notional_transfer",
        "q3_quantity",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_comment="Quantity of fuel being notionally transferred in Q3 (early issuance only)",
        existing_nullable=True,
    )
    op.alter_column(
        "notional_transfer",
        "q2_quantity",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_comment="Quantity of fuel being notionally transferred in Q2 (early issuance only)",
        existing_nullable=True,
    )
    op.alter_column(
        "notional_transfer",
        "q1_quantity",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_comment="Quantity of fuel being notionally transferred in Q1 (early issuance only)",
        existing_nullable=True,
    )
    op.alter_column(
        "notional_transfer",
        "quantity",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_comment="Quantity of fuel being notionally transferred (no early issuance)",
        existing_nullable=True,
    )
    op.alter_column(
        "fuel_supply",
        "q4_quantity",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_comment="Quantity of fuel supplied in Q4 (early issuance only)",
        existing_nullable=True,
    )
    op.alter_column(
        "fuel_supply",
        "q3_quantity",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_comment="Quantity of fuel supplied in Q3 (early issuance only)",
        existing_nullable=True,
    )
    op.alter_column(
        "fuel_supply",
        "q2_quantity",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_comment="Quantity of fuel supplied in Q2 (early issuance only)",
        existing_nullable=True,
    )
    op.alter_column(
        "fuel_supply",
        "q1_quantity",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_comment="Quantity of fuel supplied in Q1 (early issuance only)",
        existing_nullable=True,
    )
    op.alter_column(
        "fuel_supply",
        "quantity",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_comment="Quantity of fuel supplied (no early issuance)",
        existing_nullable=True,
    )
    op.alter_column(
        "fuel_export",
        "quantity",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_comment="Quantity of fuel supplied",
        existing_nullable=False,
    )
    op.alter_column(
        "allocation_agreement",
        "quantity_not_sold",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_comment="Quantity not sold or supplied within the compliance period",
        existing_nullable=True,
    )
    op.alter_column(
        "allocation_agreement",
        "q4_quantity",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_comment="Quantity of fuel involved in Q4 (early issuance only)",
        existing_nullable=True,
    )
    op.alter_column(
        "allocation_agreement",
        "q3_quantity",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_comment="Quantity of fuel involved in Q3 (early issuance only)",
        existing_nullable=True,
    )
    op.alter_column(
        "allocation_agreement",
        "q2_quantity",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_comment="Quantity of fuel involved in Q2 (early issuance only)",
        existing_nullable=True,
    )
    op.alter_column(
        "allocation_agreement",
        "q1_quantity",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_comment="Quantity of fuel involved in Q1 (early issuance only)",
        existing_nullable=True,
    )
    op.alter_column(
        "allocation_agreement",
        "quantity",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_comment="Quantity of fuel involved in the transaction",
        existing_nullable=True,
    )

    # Recreate all views and materialized views after reverting columns
    recreate_materialized_views()
