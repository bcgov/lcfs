"""big int for quantities

Revision ID: 1c0b3bed4671
Revises: ae2306fa8d72
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
down_revision = "ae2306fa8d72"
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


def upgrade() -> None:
    # Drop views and materialized views that depend on the columns being altered
    # Using CASCADE to drop dependent views automatically
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

    # Recreate views from metabase.sql
    create_role_if_not_exists()
    content = find_and_read_sql_file(sqlFile="metabase.sql")
    sections = parse_sql_sections(content)
    execute_sql_sections(sections, SECTIONS_TO_EXECUTE)

    # Recreate the materialized view
    op.execute(
        """
        CREATE MATERIALIZED VIEW mv_transaction_aggregate AS
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
                    WHEN ts.status = 'Recorded' THEN EXTRACT(YEAR FROM (
                        SELECT th.create_date
                        FROM transfer_history th
                        WHERE th.transfer_id = t.transfer_id
                        AND th.transfer_status_id = 6  -- Recorded
                        LIMIT 1
                    ))::text
                    ELSE 'N/A'
                END AS compliance_period,
                -- Get the FROM_ORG comment if it exists
                (
                    SELECT tc.comment
                    FROM transfer_comment tc
                    WHERE tc.transfer_id = t.transfer_id
                    AND tc.comment_source = 'FROM_ORG'
                    LIMIT 1
                ) AS comment,
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
                ia.gov_comment AS comment,
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
                aa.gov_comment AS comment,
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
                ON aa.current_status_id = aas.admin_adjustment_status_id;
    """
    )
    
    # Create unique index on the materialized view for concurrent refresh
    op.execute(
        """
        CREATE UNIQUE INDEX idx_mv_transaction_aggregate_unique 
        ON mv_transaction_aggregate (transaction_id, transaction_type);
        """
    )


def downgrade() -> None:
    # Drop views and materialized views before altering columns back
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

    # Recreate views from metabase.sql after reverting columns
    create_role_if_not_exists()
    content = find_and_read_sql_file(sqlFile="metabase.sql")
    sections = parse_sql_sections(content)
    execute_sql_sections(sections, SECTIONS_TO_EXECUTE)

    # Recreate the materialized view
    op.execute(
        """
        CREATE MATERIALIZED VIEW mv_transaction_aggregate AS
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
                    WHEN ts.status = 'Recorded' THEN EXTRACT(YEAR FROM (
                        SELECT th.create_date
                        FROM transfer_history th
                        WHERE th.transfer_id = t.transfer_id
                        AND th.transfer_status_id = 6  -- Recorded
                        LIMIT 1
                    ))::text
                    ELSE 'N/A'
                END AS compliance_period,
                -- Get the FROM_ORG comment if it exists
                (
                    SELECT tc.comment
                    FROM transfer_comment tc
                    WHERE tc.transfer_id = t.transfer_id
                    AND tc.comment_source = 'FROM_ORG'
                    LIMIT 1
                ) AS comment,
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
                ia.gov_comment AS comment,
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
                aa.gov_comment AS comment,
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
                ON aa.current_status_id = aas.admin_adjustment_status_id;
    """
    )
    
    # Create unique index on the materialized view for concurrent refresh
    op.execute(
        """
        CREATE UNIQUE INDEX idx_mv_transaction_aggregate_unique 
        ON mv_transaction_aggregate (transaction_id, transaction_type);
        """
    )