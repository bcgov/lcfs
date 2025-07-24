"""Migration from TFRS Snapshot Format to LCFS Summary Schema

Revision ID: 10403d830018
Revises: 8e530edb155f
Create Date: 2025-07-24 02:30:32.832178

"""

import json
import zoneinfo
from datetime import datetime
from typing import Any, Dict
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from alembic import op

revision = "10403d830018"
down_revision = "8e530edb155f"
branch_labels = None
depends_on = None

MIGRATION_USER = "ALEMBIC_10403d830018"


def calculate_line_17_balance(conn, organization_id: int, compliance_period: int):
    """Calculate Line 17 available balance using raw SQL"""

    # Calculate compliance period end date
    vancouver_timezone = zoneinfo.ZoneInfo("America/Vancouver")
    compliance_period_end = datetime.strptime(
        f"{str(compliance_period + 1)}-03-31", "%Y-%m-%d"
    )
    compliance_period_end_local = compliance_period_end.replace(
        hour=23, minute=59, second=59, microsecond=999999, tzinfo=vancouver_timezone
    )

    line_17_query = sa.text(
        """
        WITH assessment_balance AS (
            SELECT COALESCE(SUM(t.compliance_units), 0) as balance
            FROM transaction t
            JOIN compliance_report cr ON t.transaction_id = cr.transaction_id
            JOIN compliance_report_status crs ON cr.current_status_id = crs.compliance_report_status_id
            WHERE t.organization_id = :organization_id
              AND crs.status IN ('Assessed')
              AND t.create_date <= :compliance_period_end_local
              AND t.transaction_action = 'Adjustment'
        ),
        transfer_purchases AS (
            SELECT COALESCE(SUM(quantity), 0) as balance
            FROM transfer
            WHERE to_organization_id = :organization_id
              AND current_status_id = 6
              AND transaction_effective_date <= :compliance_period_end_date
        ),
        transfer_sales AS (
            SELECT COALESCE(SUM(quantity), 0) as balance
            FROM transfer
            WHERE from_organization_id = :organization_id
              AND current_status_id = 6
              AND transaction_effective_date <= :compliance_period_end_date
        ),
        initiative_agreements AS (
            SELECT COALESCE(SUM(compliance_units), 0) as balance
            FROM initiative_agreement
            WHERE to_organization_id = :organization_id
              AND current_status_id = 3
              AND transaction_effective_date <= :compliance_period_end_date
        ),
        admin_adjustments AS (
            SELECT COALESCE(SUM(compliance_units), 0) as balance
            FROM admin_adjustment
            WHERE to_organization_id = :organization_id
              AND current_status_id = 3
              AND transaction_effective_date <= :compliance_period_end_date
        ),
        future_transfer_debits AS (
            SELECT COALESCE(SUM(quantity), 0) as balance
            FROM transfer
            WHERE from_organization_id = :organization_id
              AND current_status_id = 6
              AND transaction_effective_date > :compliance_period_end_date
        ),
        future_negative_transactions AS (
            SELECT COALESCE(SUM(ABS(compliance_units)), 0) as balance
            FROM transaction
            WHERE organization_id = :organization_id
              AND create_date > :compliance_period_end_local
              AND compliance_units < 0
              AND transaction_action != 'Released'
        )
        SELECT GREATEST(
            (SELECT balance FROM assessment_balance) +
            (SELECT balance FROM transfer_purchases) -
            (SELECT balance FROM transfer_sales) +
            (SELECT balance FROM initiative_agreements) +
            (SELECT balance FROM admin_adjustments) -
            (SELECT balance FROM future_transfer_debits) -
            (SELECT balance FROM future_negative_transactions),
            0
        ) AS available_balance
    """
    )

    result = conn.scalar(
        line_17_query,
        {
            "organization_id": organization_id,
            "compliance_period_end_local": compliance_period_end_local,
            "compliance_period_end_date": compliance_period_end_local.date(),
        },
    )

    return result or 0


def get_compliance_units_received(
    conn: sa.Connection,
    organization_id: int,
    compliance_period_start: str,
    compliance_period_end: str,
) -> float:
    query = """
        SELECT COALESCE(SUM(quantity), 0) AS total_transferred_out
        FROM transfer 
        WHERE agreement_date BETWEEN %s AND %s
        AND to_organization_id = %s 
        AND current_status_id = 6 -- Recorded
    """

    result = conn.scalar(
        query, (compliance_period_start, compliance_period_end, organization_id)
    )
    return result or 0.0


def get_transferred_out_compliance_units(
    conn: sa.Connection,
    organization_id: int,
    compliance_period_start: str,
    compliance_period_end: str,
) -> float:
    query = """
        SELECT COALESCE(SUM(quantity), 0) AS total_transferred_out
        FROM transfer 
        WHERE agreement_date BETWEEN %s AND %s
        AND from_organization_id = %s 
        AND current_status_id = 6 -- Recorded
    """

    result = conn.scalar(
        query, (compliance_period_start, compliance_period_end, organization_id)
    )
    return result or 0.0


def get_issued_compliance_units(
    conn: sa.Connection,
    organization_id: int,
    compliance_period_start: str,
    compliance_period_end: str,
) -> float:
    query = """
        SELECT COALESCE(SUM(compliance_units), 0) AS total_compliance_units
        FROM initiative_agreement 
        WHERE transaction_effective_date BETWEEN %s AND %s
        AND to_organization_id = %s 
        AND current_status_id = 3; -- Approved
    """

    result = conn.scalar(
        query, (compliance_period_start, compliance_period_end, organization_id)
    )
    return result or 0.0


def process_historical_snapshot(
    snapshot_data: str, compliance_report_id: int, conn: sa.Connection
) -> Dict[str, Any]:
    """
    Complex logic to process historical snapshot and return update data
    """
    try:
        # Parse the historical snapshot JSON
        snapshot = json.loads(snapshot_data) if snapshot_data else {}
        # Extract summary data from JSON
        organization_id = snapshot.get("organization", {}).get("id", 0)
        compliance_period_start = snapshot.get("compliance_period", {}).get(
            "effective_date", "9999-12-31"
        )
        compliance_period_end = snapshot.get("compliance_period", {}).get(
            "expiration_date", "9999-12-31"
        )
        summary = snapshot.get("summary", {})
        lines = summary.get("lines", {})
        line_17 = calculate_line_17_balance(
            conn, organization_id, compliance_period_start[:4]  # Extract year
        )

        # Map JSON data to table columns
        processed_data = {
            # Update audit fields
            "update_user": MIGRATION_USER,
            "update_date": sa.func.now(),
            # Map summary lines to appropriate columns
            # ------ Renewable fuel target summary columns for Gasoline and Diesel category ------
            # Volume of fossil-derived base fuel supplied
            "line_1_fossil_derived_base_fuel_gasoline": float(lines.get("1", 0)),
            "line_1_fossil_derived_base_fuel_diesel": float(lines.get("12", 0)),
            # Volume of eligible renewable fuel supplied
            "line_2_eligible_renewable_fuel_supplied_gasoline": float(
                lines.get("2", 0)
            ),
            "line_2_eligible_renewable_fuel_supplied_diesel": float(lines.get("13", 0)),
            # Total volume of tracked fuel supplied (Line 1 + Line 2)
            "line_3_total_tracked_fuel_supplied_gasoline": float(lines.get("3", 0)),
            "line_3_total_tracked_fuel_supplied_diesel": float(lines.get("14", 0)),
            # Volume of eligible renewable fuel required
            "line_4_eligible_renewable_fuel_required_gasoline": float(
                lines.get("4", 0)
            ),
            "line_4_eligible_renewable_fuel_required_diesel": float(lines.get("15", 0)),
            # Net volume of eligible renewable fuel notionally transferred
            "line_5_net_notionally_transferred_gasoline": float(lines.get("5", 0)),
            "line_5_net_notionally_transferred_diesel": float(lines.get("16", 0)),
            # Volume of eligible renewable fuel retained (up to 5% of Line 4)
            "line_6_renewable_fuel_retained_gasoline": float(lines.get("6", 0)),
            "line_6_renewable_fuel_retained_diesel": float(lines.get("17", 0)),
            # Volume of eligible renewable fuel previously retained (from Line 6 of previous compliance period)
            "line_7_previously_retained_gasoline": float(lines.get("7", 0)),
            "line_7_previously_retained_diesel": float(lines.get("18", 0)),
            # Volume of eligible renewable obligation deferred (up to 5% of Line 4)
            "line_8_obligation_deferred_gasoline": float(lines.get("8", 0)),
            "line_8_obligation_deferred_diesel": float(lines.get("19", 0)),
            # Volume of renewable obligation added (from Line 8 of previous compliance period)
            "line_9_obligation_added_gasoline": float(lines.get("9", 0)),
            "line_9_obligation_added_diesel": float(lines.get("20", 0)),
            # Net volume of eligible renewable fuel supplied (Total of Line 2 + Line 5 - Line 6 + Line 7 + Line 8 - Line 9)
            "line_10_net_renewable_fuel_supplied_gasoline": float(lines.get("10", 0)),
            "line_10_net_renewable_fuel_supplied_diesel": float(lines.get("21", 0)),
            # Non-compliance penalty payable [(Line 4 - Line 10) x prescribed penalty rate]
            "line_11_non_compliance_penalty_gasoline": float(lines.get("11", 0)),
            "line_11_non_compliance_penalty_diesel": float(lines.get("22", 0)),
            # ------ Low carbon fuel target summary columns ------
            # Compliance units transferred away
            "line_12_low_carbon_fuel_required": get_transferred_out_compliance_units(
                conn,
                organization_id,
                compliance_period_start,
                compliance_period_end,
            ),
            # Compliance units received through transfers
            "line_13_low_carbon_fuel_supplied": get_compliance_units_received(
                conn,
                organization_id,
                compliance_period_start,
                compliance_period_end,
            ),
            # Compliance units issued under initiative agreements
            "line_14_low_carbon_fuel_surplus": get_issued_compliance_units(
                conn,
                organization_id,
                compliance_period_start,
                compliance_period_end,
            ),
            # Compliance units previously issued for the supply of fuel in the compliance period
            "line_15_banked_units_used": float(summary.get("credits_offset", 0)),
            # Compliance units previously issued for the export of fuel for the compliance period
            # "line_16_banked_units_remaining" # As previously fuel exports were not tracked, this will be 0
            # Available compliance unit balance for the compliance period
            "line_17_non_banked_units_used": line_17,
            # Compliance units being issued for the supply of fuel in the compliance period
            "line_18_units_to_be_banked": float(lines.get("25", 0)),
            # Compliance units being issued for the export of fuel for the compliance period
            # "line_19_units_to_be_exported": float(lines.get("30", 0)), # As previously fuel exports were not tracked, this will be 0
            # Compliance unit balance change from assessment
            "line_20_surplus_deficit_units": float(lines.get("25", 0))
            - float(summary.get("credits_offset", 0)),
            # Non-compliance penalty payable
            "line_21_surplus_deficit_ratio": float(lines.get("28", 0)),
            # Available compliance unit balance at the end of the compliance date for the period
            "line_22_compliance_units_issued": line_17 + float(lines.get("25", 0)),
            # Non-compliance penalty summary columns
            "line_11_fossil_derived_base_fuel_gasoline": float(lines.get("11", 0)),
            "line_11_fossil_derived_base_fuel_diesel": float(lines.get("22", 0)),
            # Renewable fuel target non-compliance penalty total (Line 11, Gasoline + Diesel + Jet fuel)
            "line_11_fossil_derived_base_fuel_total": float(lines.get("11", 0))
            + float(lines.get("22", 0)),
            # Low carbon fuel target non-compliance penalty total (Line 21)
            "line_21_non_compliance_penalty_payable": float(lines.get("28", 0)),
            "total_non_compliance_penalty_payable": float(lines.get("11", 0))
            + float(lines.get("22", 0))
            + float(lines.get("28", 0)),
        }

        return processed_data

    except (json.JSONDecodeError, Exception) as e:
        print(
            f"Error processing snapshot for compliance_report_id {compliance_report_id}: {e}"
        )
        return {}


def upgrade() -> None:
    conn = op.get_bind()
    snapshot_query = sa.text(
        """
        SELECT cr.compliance_report_id, crs.summary_id, crs.historical_snapshot
        FROM compliance_report cr
        JOIN compliance_report_summary crs ON cr.compliance_report_id = crs.compliance_report_id
        WHERE cr.legacy_id IS NOT NULL AND crs.historical_snapshot IS NOT NULL AND crs.update_user <> :migration_user
        ORDER BY crs.summary_id
        """
    )

    BATCH_SIZE = 1000
    processed_count = 0

    # Use fetchmany() to process in chunks without loading everything into memory
    result = conn.execution_options(stream_results=True).execute(
        snapshot_query, {"migration_user": MIGRATION_USER}
    )

    try:
        while True:
            batch = result.fetchmany(BATCH_SIZE)
            if not batch:
                break

            for row in batch:
                summary_id = row.summary_id
                historical_snapshot = row.historical_snapshot
                # Process the historical snapshot
                processed_data = process_historical_snapshot(
                    historical_snapshot, row.compliance_report_id, conn
                )

                if processed_data:
                    update_stmt = sa.text(
                        """
                            UPDATE compliance_report_summary 
                            SET 
                                update_user = :update_user,
                                update_date = :update_date,
                                line_1_fossil_derived_base_fuel_gasoline = :line_1_fossil_derived_base_fuel_gasoline,
                                line_1_fossil_derived_base_fuel_diesel = :line_1_fossil_derived_base_fuel_diesel,
                                line_2_eligible_renewable_fuel_supplied_gasoline = :line_2_eligible_renewable_fuel_supplied_gasoline,
                                line_2_eligible_renewable_fuel_supplied_diesel = :line_2_eligible_renewable_fuel_supplied_diesel,
                                line_3_total_tracked_fuel_supplied_gasoline = :line_3_total_tracked_fuel_supplied_gasoline,
                                line_3_total_tracked_fuel_supplied_diesel = :line_3_total_tracked_fuel_supplied_diesel,
                                line_4_eligible_renewable_fuel_required_gasoline = :line_4_eligible_renewable_fuel_required_gasoline,
                                line_4_eligible_renewable_fuel_required_diesel = :line_4_eligible_renewable_fuel_required_diesel,
                                line_5_net_notionally_transferred_gasoline = :line_5_net_notionally_transferred_gasoline,
                                line_5_net_notionally_transferred_diesel = :line_5_net_notionally_transferred_diesel,
                                line_6_renewable_fuel_retained_gasoline = :line_6_renewable_fuel_retained_gasoline,
                                line_6_renewable_fuel_retained_diesel = :line_6_renewable_fuel_retained_diesel,
                                line_7_previously_retained_gasoline = :line_7_previously_retained_gasoline,
                                line_7_previously_retained_diesel = :line_7_previously_retained_diesel,
                                line_8_obligation_deferred_gasoline = :line_8_obligation_deferred_gasoline,
                                line_8_obligation_deferred_diesel = :line_8_obligation_deferred_diesel,
                                line_9_obligation_added_gasoline = :line_9_obligation_added_gasoline,
                                line_9_obligation_added_diesel = :line_9_obligation_added_diesel,
                                line_10_net_renewable_fuel_supplied_gasoline = :line_10_net_renewable_fuel_supplied_gasoline,
                                line_10_net_renewable_fuel_supplied_diesel = :line_10_net_renewable_fuel_supplied_diesel,
                                line_11_non_compliance_penalty_gasoline = :line_11_non_compliance_penalty_gasoline,
                                line_11_non_compliance_penalty_diesel = :line_11_non_compliance_penalty_diesel,
                                line_12_low_carbon_fuel_required = :line_12_low_carbon_fuel_required,
                                line_13_low_carbon_fuel_supplied = :line_13_low_carbon_fuel_supplied,
                                line_14_low_carbon_fuel_surplus = :line_14_low_carbon_fuel_surplus,
                                line_15_banked_units_used = :line_15_banked_units_used,
                                line_17_non_banked_units_used = :line_17_non_banked_units_used,
                                line_18_units_to_be_banked = :line_18_units_to_be_banked,
                                line_20_surplus_deficit_units = :line_20_surplus_deficit_units,
                                line_21_surplus_deficit_ratio = :line_21_surplus_deficit_ratio,
                                line_22_compliance_units_issued = :line_22_compliance_units_issued,
                                line_11_fossil_derived_base_fuel_gasoline = :line_11_fossil_derived_base_fuel_gasoline,
                                line_11_fossil_derived_base_fuel_diesel = :line_11_fossil_derived_base_fuel_diesel,
                                line_11_fossil_derived_base_fuel_total = :line_11_fossil_derived_base_fuel_total,
                                line_21_non_compliance_penalty_payable = :line_21_non_compliance_penalty_payable,
                                total_non_compliance_penalty_payable = :total_non_compliance_penalty_payable
                            WHERE summary_id = :summary_id
                        """
                    )

                    processed_data["summary_id"] = summary_id

                    try:
                        conn.execute(update_stmt, processed_data)
                        processed_count += 1

                        # Commit every 10 records to prevent memory buildup
                        if processed_count % 10 == 0:
                            conn.commit()
                            print(
                                f"Processed and committed {processed_count} records..."
                            )

                    except Exception as e:
                        print(f"Error updating summary_id {summary_id}: {e}")
                        conn.rollback()
                        continue

            # Commit any remaining records in the batch
            conn.commit()
            print(f"Batch completed. Total processed: {processed_count} records...")
    except Exception as e:
        print(f"Critical error during migration: {e}")
        conn.rollback()
        raise
    finally:
        result.close()

    print(
        f"Migration completed successfully. Total records processed: {processed_count}"
    )


def downgrade() -> None:
    """
    Downgrade function to revert the changes, resetting processed fields to NULL or default values.
    """
    conn = op.get_bind()

    # Reset the processed fields back to NULL or default values
    downgrade_stmt = sa.text(
        """
        UPDATE compliance_report_summary 
        SET 
            line_1_fossil_derived_base_fuel_gasoline = NULL,
            line_1_fossil_derived_base_fuel_diesel = NULL,
            line_2_eligible_renewable_fuel_supplied_gasoline = NULL,
            line_2_eligible_renewable_fuel_supplied_diesel = NULL,
            line_3_total_tracked_fuel_supplied_gasoline = NULL,
            line_3_total_tracked_fuel_supplied_diesel = NULL,
            line_4_eligible_renewable_fuel_required_gasoline = NULL,
            line_4_eligible_renewable_fuel_required_diesel = NULL,
            line_5_net_notionally_transferred_gasoline = NULL,
            line_5_net_notionally_transferred_diesel = NULL,
            line_6_renewable_fuel_retained_gasoline = NULL,
            line_6_renewable_fuel_retained_diesel = NULL,
            line_7_previously_retained_gasoline = NULL,
            line_7_previously_retained_diesel = NULL,
            line_8_obligation_deferred_gasoline = NULL,
            line_8_obligation_deferred_diesel = NULL,
            line_9_obligation_added_gasoline = NULL,
            line_9_obligation_added_diesel = NULL,
            line_10_net_renewable_fuel_supplied_gasoline = NULL,
            line_10_net_renewable_fuel_supplied_diesel = NULL,
            line_11_non_compliance_penalty_gasoline = NULL,
            line_11_non_compliance_penalty_diesel = NULL,
            line_12_low_carbon_fuel_required = NULL,
            line_13_low_carbon_fuel_supplied = NULL,
            line_14_low_carbon_fuel_surplus = NULL,
            line_15_banked_units_used = NULL,
            line_17_non_banked_units_used = NULL,
            line_18_units_to_be_banked = NULL,
            line_20_surplus_deficit_units = NULL,
            line_21_surplus_deficit_ratio = NULL,
            line_22_compliance_units_issued = NULL,
            line_11_fossil_derived_base_fuel_gasoline = NULL,
            line_11_fossil_derived_base_fuel_diesel = NULL,
            line_11_fossil_derived_base_fuel_total = NULL,
            line_21_non_compliance_penalty_payable = NULL,
            total_non_compliance_penalty_payable = NULL,
            update_user = 'DOWNGRADE_' || :migration_user,
            update_date = NOW()
        WHERE update_user = :migration_user
    """
    )

    conn.execute(downgrade_stmt, {"migration_user": MIGRATION_USER})
    conn.commit()
    print("Downgrade completed successfully.")
