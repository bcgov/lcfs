#!/usr/bin/env python3
"""
Compliance Summary Update Script

Updates existing compliance report summary records with data from TFRS snapshots.
This script replicates the functionality of compliance_summary_update.groovy
"""

import os
import sys

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import logging
import sys
import zoneinfo
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from core.database import get_source_connection, get_destination_connection
from core.utils import setup_logging, safe_decimal, build_legacy_mapping

logger = logging.getLogger(__name__)

MIGRATION_USER = "ETL_COMPLIANCE_SUMMARY"


class ComplianceSummaryUpdater:
    def __init__(self):
        self.legacy_to_lcfs_mapping: Dict[int, int] = {}

        # Statistics for reporting
        self.stats = {
            "tfrs_snapshots_found": 0,
            "snapshots_processed": 0,
            "snapshots_skipped_no_mapping": 0,
            "snapshots_skipped_parse_error": 0,
            "updates_successful": 0,
            "updates_failed": 0,
            "line_17_calculations": 0,
            "batch_commits": 0,
        }

    def load_mappings(self, lcfs_cursor):
        logger.info("Loading legacy ID to LCFS compliance_report_id mappings")
        self.legacy_to_lcfs_mapping = build_legacy_mapping(lcfs_cursor)
        logger.info(f"Loaded {len(self.legacy_to_lcfs_mapping)} legacy mappings")

    def calculate_line_17_balance(
        self, lcfs_cursor, organization_id: int, compliance_period: int
    ) -> float:
        """Calculate Line 17 available balance using raw SQL"""
        try:
            # Calculate compliance period end date
            vancouver_timezone = zoneinfo.ZoneInfo("America/Vancouver")
            compliance_period_end = datetime.strptime(
                f"{str(compliance_period + 1)}-03-31", "%Y-%m-%d"
            )
            compliance_period_end_local = compliance_period_end.replace(
                hour=23,
                minute=59,
                second=59,
                microsecond=999999,
                tzinfo=vancouver_timezone,
            )

            line_17_query = """
                WITH assessment_balance AS (
                    SELECT COALESCE(SUM(t.compliance_units), 0) as balance
                    FROM transaction t
                    JOIN compliance_report cr ON t.transaction_id = cr.transaction_id
                    JOIN compliance_report_status crs ON cr.current_status_id = crs.compliance_report_status_id
                    WHERE t.organization_id = %s
                      AND crs.status IN ('Assessed')
                      AND t.create_date <= %s
                      AND t.transaction_action = 'Adjustment'
                ),
                transfer_purchases AS (
                    SELECT COALESCE(SUM(quantity), 0) as balance
                    FROM transfer
                    WHERE to_organization_id = %s
                      AND current_status_id = 6
                      AND transaction_effective_date <= %s
                ),
                transfer_sales AS (
                    SELECT COALESCE(SUM(quantity), 0) as balance
                    FROM transfer
                    WHERE from_organization_id = %s
                      AND current_status_id = 6
                      AND transaction_effective_date <= %s
                ),
                initiative_agreements AS (
                    SELECT COALESCE(SUM(compliance_units), 0) as balance
                    FROM initiative_agreement
                    WHERE to_organization_id = %s
                      AND current_status_id = 3
                      AND transaction_effective_date <= %s
                ),
                admin_adjustments AS (
                    SELECT COALESCE(SUM(compliance_units), 0) as balance
                    FROM admin_adjustment
                    WHERE to_organization_id = %s
                      AND current_status_id = 3
                      AND transaction_effective_date <= %s
                ),
                future_transfer_debits AS (
                    SELECT COALESCE(SUM(quantity), 0) as balance
                    FROM transfer
                    WHERE from_organization_id = %s
                      AND current_status_id = 6
                      AND transaction_effective_date > %s
                ),
                future_negative_transactions AS (
                    SELECT COALESCE(SUM(ABS(compliance_units)), 0) as balance
                    FROM transaction
                    WHERE organization_id = %s
                      AND create_date > %s
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

            params = [
                organization_id,  # assessment_balance
                compliance_period_end_local,
                organization_id,  # transfer_purchases
                compliance_period_end_local.date(),
                organization_id,  # transfer_sales
                compliance_period_end_local.date(),
                organization_id,  # initiative_agreements
                compliance_period_end_local.date(),
                organization_id,  # admin_adjustments
                compliance_period_end_local.date(),
                organization_id,  # future_transfer_debits
                compliance_period_end_local.date(),
                organization_id,  # future_negative_transactions
                compliance_period_end_local,
            ]

            lcfs_cursor.execute(line_17_query, params)
            result = lcfs_cursor.fetchone()

            self.stats["line_17_calculations"] += 1
            return float(result[0] if result and result[0] is not None else 0)

        except Exception as e:
            logger.error(
                f"Error calculating line 17 balance for org {organization_id}: {e}"
            )
            return 0.0

    def get_compliance_units_received(
        self,
        lcfs_cursor,
        organization_id: int,
        compliance_period_start: str,
        compliance_period_end: str,
    ) -> float:
        """Get compliance units received through transfers"""
        query = """
            SELECT COALESCE(SUM(quantity), 0) AS total_transferred_out
            FROM transfer 
            WHERE agreement_date BETWEEN %s AND %s
            AND to_organization_id = %s 
            AND current_status_id = 6 -- Recorded
        """

        lcfs_cursor.execute(
            query, (compliance_period_start, compliance_period_end, organization_id)
        )
        result = lcfs_cursor.fetchone()
        return float(result[0] if result and result[0] is not None else 0.0)

    def get_transferred_out_compliance_units(
        self,
        lcfs_cursor,
        organization_id: int,
        compliance_period_start: str,
        compliance_period_end: str,
    ) -> float:
        """Get compliance units transferred away"""
        query = """
            SELECT COALESCE(SUM(quantity), 0) AS total_transferred_out
            FROM transfer 
            WHERE agreement_date BETWEEN %s AND %s
            AND from_organization_id = %s 
            AND current_status_id = 6 -- Recorded
        """

        lcfs_cursor.execute(
            query, (compliance_period_start, compliance_period_end, organization_id)
        )
        result = lcfs_cursor.fetchone()
        return float(result[0] if result and result[0] is not None else 0.0)

    def get_issued_compliance_units(
        self,
        lcfs_cursor,
        organization_id: int,
        compliance_period_start: str,
        compliance_period_end: str,
    ) -> float:
        """Get compliance units issued under initiative agreements"""
        query = """
            SELECT COALESCE(SUM(compliance_units), 0) AS total_compliance_units
            FROM initiative_agreement 
            WHERE transaction_effective_date BETWEEN %s AND %s
            AND to_organization_id = %s 
            AND current_status_id = 3; -- Approved
        """

        lcfs_cursor.execute(
            query, (compliance_period_start, compliance_period_end, organization_id)
        )
        result = lcfs_cursor.fetchone()
        return float(result[0] if result and result[0] is not None else 0.0)

    def fetch_snapshot_data(self, tfrs_cursor) -> List[Dict]:
        """Fetch snapshot data from LCFS compliance reports, filtering for unprocessed records"""
        source_query = """
            SELECT compliance_report_id, snapshot
            FROM public.compliance_report_snapshot
            WHERE snapshot IS NOT NULL
        """

        logger.info("Fetching snapshot data from TFRS")
        tfrs_cursor.execute(source_query)
        records = []

        for row in tfrs_cursor.fetchall():
            try:
                # Check if data is already a dict (from psycopg2's JSON handling)
                if isinstance(row[1], dict):
                    snapshot_data = row[1]
                    snapshot_json = json.dumps(row[1])
                else:
                    # It's a string, parse it
                    snapshot_data = json.loads(row[1])
                    snapshot_json = row[1]
                    
                records.append(
                    {
                        "compliance_report_id": row[0],
                        "snapshot": snapshot_data,
                        "snapshot_json": snapshot_json,
                    }
                )
            except (json.JSONDecodeError, TypeError) as e:
                logger.warning(
                    f"Failed to parse JSON for compliance_report_id {row[0]}: {e}"
                )
                self.stats["snapshots_skipped_parse_error"] += 1
                continue

        self.stats["tfrs_snapshots_found"] = len(records)
        logger.info(f"Fetched {len(records)} snapshot records")
        return records

    def parse_summary_data(self, snapshot: Dict, lcfs_cursor) -> Optional[Dict]:
        """Enhanced parsing with Alembic migration logic"""
        try:
            # Extract organization and compliance period info
            organization_id = snapshot.get("organization", {}).get("id", 0)
            compliance_period_start = snapshot.get("compliance_period", {}).get(
                "effective_date", "9999-12-31"
            )
            compliance_period_end = snapshot.get("compliance_period", {}).get(
                "expiration_date", "9999-12-31"
            )

            # Extract year for line 17 calculation
            compliance_period_year = (
                int(compliance_period_start[:4])
                if compliance_period_start != "9999-12-31"
                else 2020
            )

            summary = snapshot.get("summary", {})
            summary_lines = summary.get("lines", {})

            # Calculate line 17 balance using enhanced logic
            line_17 = self.calculate_line_17_balance(
                lcfs_cursor, organization_id, compliance_period_year
            )

            # Get dynamic compliance unit calculations
            compliance_units_received = Decimal(str(self.get_compliance_units_received(
                lcfs_cursor,
                organization_id,
                compliance_period_start,
                compliance_period_end,
            )))
            transferred_out_units = Decimal(str(self.get_transferred_out_compliance_units(
                lcfs_cursor,
                organization_id,
                compliance_period_start,
                compliance_period_end,
            )))
            issued_compliance_units = Decimal(str(self.get_issued_compliance_units(
                lcfs_cursor,
                organization_id,
                compliance_period_start,
                compliance_period_end,
            )))

            # Extract gasoline class mappings (lines 1-11)
            line1_gas = safe_decimal(summary_lines.get("1", 0))
            line2_gas = safe_decimal(summary_lines.get("2", 0))
            line3_gas = safe_decimal(summary_lines.get("3", 0))
            line4_gas = safe_decimal(summary_lines.get("4", 0))
            line5_gas = safe_decimal(summary_lines.get("5", 0))
            line6_gas = safe_decimal(summary_lines.get("6", 0))
            line7_gas = safe_decimal(summary_lines.get("7", 0))
            line8_gas = safe_decimal(summary_lines.get("8", 0))
            line9_gas = safe_decimal(summary_lines.get("9", 0))
            line10_gas = safe_decimal(summary_lines.get("10", 0))
            line11_gas = safe_decimal(summary_lines.get("11", 0))

            # Extract diesel class mappings (lines 12-22)
            line1_diesel = safe_decimal(summary_lines.get("12", 0))
            line2_diesel = safe_decimal(summary_lines.get("13", 0))
            line3_diesel = safe_decimal(summary_lines.get("14", 0))
            line4_diesel = safe_decimal(summary_lines.get("15", 0))
            line5_diesel = safe_decimal(summary_lines.get("16", 0))
            line6_diesel = safe_decimal(summary_lines.get("17", 0))
            line7_diesel = safe_decimal(summary_lines.get("18", 0))
            line8_diesel = safe_decimal(summary_lines.get("19", 0))
            line9_diesel = safe_decimal(summary_lines.get("20", 0))
            line10_diesel = safe_decimal(summary_lines.get("21", 0))
            line11_diesel = safe_decimal(summary_lines.get("22", 0))

            # Extract other summary data with enhanced calculations
            compliance_units_issued = safe_decimal(summary_lines.get("25", 0))
            banked_used = safe_decimal(summary.get("credits_offset", 0))
            line28_non_compliance = safe_decimal(summary_lines.get("28", 0))

            # Calculate fossil fuel totals
            fossil_gas = line1_gas
            fossil_diesel = line1_diesel
            fossil_total = fossil_gas + fossil_diesel

            # Enhanced calculations from Alembic migration
            # Convert line_17 (float) to Decimal for calculations
            line_17_decimal = Decimal(str(line_17))
            balance_chg_from_assessment = compliance_units_issued - banked_used
            # Available compliance unit balance at the end of the compliance date for the period
            # This should be the available balance at period end, not credits issued
            available_balance_at_period_end = line_17_decimal  # This is the correct Line 22 value
            total_payable = line11_gas + line11_diesel + line28_non_compliance

            return {
                # Gasoline class data
                "line_1_fossil_derived_base_fuel_gasoline": line1_gas,
                "line_2_eligible_renewable_fuel_supplied_gasoline": line2_gas,
                "line_3_total_tracked_fuel_supplied_gasoline": line3_gas,
                "line_4_eligible_renewable_fuel_required_gasoline": line4_gas,
                "line_5_net_notionally_transferred_gasoline": line5_gas,
                "line_6_renewable_fuel_retained_gasoline": line6_gas,
                "line_7_previously_retained_gasoline": line7_gas,
                "line_8_obligation_deferred_gasoline": line8_gas,
                "line_9_obligation_added_gasoline": line9_gas,
                "line_10_net_renewable_fuel_supplied_gasoline": line10_gas,
                "line_11_non_compliance_penalty_gasoline": line11_gas,
                # Diesel class data
                "line_1_fossil_derived_base_fuel_diesel": line1_diesel,
                "line_2_eligible_renewable_fuel_supplied_diesel": line2_diesel,
                "line_3_total_tracked_fuel_supplied_diesel": line3_diesel,
                "line_4_eligible_renewable_fuel_required_diesel": line4_diesel,
                "line_5_net_notionally_transferred_diesel": line5_diesel,
                "line_6_renewable_fuel_retained_diesel": line6_diesel,
                "line_7_previously_retained_diesel": line7_diesel,
                "line_8_obligation_deferred_diesel": line8_diesel,
                "line_9_obligation_added_diesel": line9_diesel,
                "line_10_net_renewable_fuel_supplied_diesel": line10_diesel,
                "line_11_non_compliance_penalty_diesel": line11_diesel,
                # Jet fuel (all zeros since no TFRS data)
                "line_1_fossil_derived_base_fuel_jet_fuel": Decimal("0.0"),
                "line_2_eligible_renewable_fuel_supplied_jet_fuel": Decimal("0.0"),
                "line_3_total_tracked_fuel_supplied_jet_fuel": Decimal("0.0"),
                "line_4_eligible_renewable_fuel_required_jet_fuel": Decimal("0.0"),
                "line_5_net_notionally_transferred_jet_fuel": Decimal("0.0"),
                "line_6_renewable_fuel_retained_jet_fuel": Decimal("0.0"),
                "line_7_previously_retained_jet_fuel": Decimal("0.0"),
                "line_8_obligation_deferred_jet_fuel": Decimal("0.0"),
                "line_9_obligation_added_jet_fuel": Decimal("0.0"),
                "line_10_net_renewable_fuel_supplied_jet_fuel": Decimal("0.0"),
                "line_11_non_compliance_penalty_jet_fuel": Decimal("0.0"),
                # Low carbon fuel requirement summary - Enhanced with dynamic calculations
                # Compliance units transferred away
                "line_12_low_carbon_fuel_required": transferred_out_units,
                # Compliance units received through transfers
                "line_13_low_carbon_fuel_supplied": compliance_units_received,
                # Compliance units issued under initiative agreements
                "line_14_low_carbon_fuel_surplus": issued_compliance_units,
                "line_15_banked_units_used": banked_used,
                "line_16_banked_units_remaining": Decimal("0.0"),  # Not tracked in TFRS
                "line_17_non_banked_units_used": line_17_decimal,
                "line_18_units_to_be_banked": issued_compliance_units,
                "line_19_units_to_be_exported": Decimal("0.0"),  # Not tracked in TFRS
                "line_20_surplus_deficit_units": balance_chg_from_assessment,
                "line_21_surplus_deficit_ratio": line28_non_compliance,
                "line_22_compliance_units_issued": available_balance_at_period_end,
                # Fossil derived base fuel (aggregate)
                "line_11_fossil_derived_base_fuel_gasoline": fossil_gas,
                "line_11_fossil_derived_base_fuel_diesel": fossil_diesel,
                "line_11_fossil_derived_base_fuel_jet_fuel": Decimal("0.0"),
                "line_11_fossil_derived_base_fuel_total": fossil_total,
                # Non-compliance penalty fields
                "line_21_non_compliance_penalty_payable": line28_non_compliance,
                "total_non_compliance_penalty_payable": total_payable,
            }

        except Exception as e:
            logger.error(f"Failed to parse summary data from snapshot: {e}")
            return None

    def update_summary_record(
        self,
        lcfs_cursor,
        lcfs_compliance_report_id: int,
        summary_data: Dict,
        snapshot_json: str,
    ) -> bool:
        """Update summary record with enhanced field mapping"""
        update_sql = """
            UPDATE public.compliance_report_summary
            SET
                update_user = %s,
                line_1_fossil_derived_base_fuel_gasoline = %s,
                line_2_eligible_renewable_fuel_supplied_gasoline = %s,
                line_3_total_tracked_fuel_supplied_gasoline = %s,
                line_4_eligible_renewable_fuel_required_gasoline = %s,
                line_5_net_notionally_transferred_gasoline = %s,
                line_6_renewable_fuel_retained_gasoline = %s,
                line_7_previously_retained_gasoline = %s,
                line_8_obligation_deferred_gasoline = %s,
                line_9_obligation_added_gasoline = %s,
                line_10_net_renewable_fuel_supplied_gasoline = %s,
                line_11_non_compliance_penalty_gasoline = %s,
                line_1_fossil_derived_base_fuel_diesel = %s,
                line_2_eligible_renewable_fuel_supplied_diesel = %s,
                line_3_total_tracked_fuel_supplied_diesel = %s,
                line_4_eligible_renewable_fuel_required_diesel = %s,
                line_5_net_notionally_transferred_diesel = %s,
                line_6_renewable_fuel_retained_diesel = %s,
                line_7_previously_retained_diesel = %s,
                line_8_obligation_deferred_diesel = %s,
                line_9_obligation_added_diesel = %s,
                line_10_net_renewable_fuel_supplied_diesel = %s,
                line_11_non_compliance_penalty_diesel = %s,
                line_1_fossil_derived_base_fuel_jet_fuel = %s,
                line_2_eligible_renewable_fuel_supplied_jet_fuel = %s,
                line_3_total_tracked_fuel_supplied_jet_fuel = %s,
                line_4_eligible_renewable_fuel_required_jet_fuel = %s,
                line_5_net_notionally_transferred_jet_fuel = %s,
                line_6_renewable_fuel_retained_jet_fuel = %s,
                line_7_previously_retained_jet_fuel = %s,
                line_8_obligation_deferred_jet_fuel = %s,
                line_9_obligation_added_jet_fuel = %s,
                line_10_net_renewable_fuel_supplied_jet_fuel = %s,
                line_11_non_compliance_penalty_jet_fuel = %s,
                line_12_low_carbon_fuel_required = %s,
                line_13_low_carbon_fuel_supplied = %s,
                line_14_low_carbon_fuel_surplus = %s,
                line_15_banked_units_used = %s,
                line_16_banked_units_remaining = %s,
                line_17_non_banked_units_used = %s,
                line_18_units_to_be_banked = %s,
                line_19_units_to_be_exported = %s,
                line_20_surplus_deficit_units = %s,
                line_21_surplus_deficit_ratio = %s,
                line_22_compliance_units_issued = %s,
                line_11_fossil_derived_base_fuel_gasoline = %s,
                line_11_fossil_derived_base_fuel_diesel = %s,
                line_11_fossil_derived_base_fuel_jet_fuel = %s,
                line_11_fossil_derived_base_fuel_total = %s,
                line_21_non_compliance_penalty_payable = %s,
                total_non_compliance_penalty_payable = %s,
                historical_snapshot = %s::jsonb
            WHERE compliance_report_id = %s
        """

        try:
            params = [
                MIGRATION_USER,  # update_user
                # Gasoline class
                float(summary_data["line_1_fossil_derived_base_fuel_gasoline"]),
                float(summary_data["line_2_eligible_renewable_fuel_supplied_gasoline"]),
                float(summary_data["line_3_total_tracked_fuel_supplied_gasoline"]),
                float(summary_data["line_4_eligible_renewable_fuel_required_gasoline"]),
                float(summary_data["line_5_net_notionally_transferred_gasoline"]),
                float(summary_data["line_6_renewable_fuel_retained_gasoline"]),
                float(summary_data["line_7_previously_retained_gasoline"]),
                float(summary_data["line_8_obligation_deferred_gasoline"]),
                float(summary_data["line_9_obligation_added_gasoline"]),
                float(summary_data["line_10_net_renewable_fuel_supplied_gasoline"]),
                float(summary_data["line_11_non_compliance_penalty_gasoline"]),
                # Diesel class
                float(summary_data["line_1_fossil_derived_base_fuel_diesel"]),
                float(summary_data["line_2_eligible_renewable_fuel_supplied_diesel"]),
                float(summary_data["line_3_total_tracked_fuel_supplied_diesel"]),
                float(summary_data["line_4_eligible_renewable_fuel_required_diesel"]),
                float(summary_data["line_5_net_notionally_transferred_diesel"]),
                float(summary_data["line_6_renewable_fuel_retained_diesel"]),
                float(summary_data["line_7_previously_retained_diesel"]),
                float(summary_data["line_8_obligation_deferred_diesel"]),
                float(summary_data["line_9_obligation_added_diesel"]),
                float(summary_data["line_10_net_renewable_fuel_supplied_diesel"]),
                float(summary_data["line_11_non_compliance_penalty_diesel"]),
                # Jet fuel (all zeros)
                float(summary_data["line_1_fossil_derived_base_fuel_jet_fuel"]),
                float(summary_data["line_2_eligible_renewable_fuel_supplied_jet_fuel"]),
                float(summary_data["line_3_total_tracked_fuel_supplied_jet_fuel"]),
                float(summary_data["line_4_eligible_renewable_fuel_required_jet_fuel"]),
                float(summary_data["line_5_net_notionally_transferred_jet_fuel"]),
                float(summary_data["line_6_renewable_fuel_retained_jet_fuel"]),
                float(summary_data["line_7_previously_retained_jet_fuel"]),
                float(summary_data["line_8_obligation_deferred_jet_fuel"]),
                float(summary_data["line_9_obligation_added_jet_fuel"]),
                float(summary_data["line_10_net_renewable_fuel_supplied_jet_fuel"]),
                float(summary_data["line_11_non_compliance_penalty_jet_fuel"]),
                # Low carbon fuel requirement summary
                float(summary_data["line_12_low_carbon_fuel_required"]),
                float(summary_data["line_13_low_carbon_fuel_supplied"]),
                float(summary_data["line_14_low_carbon_fuel_surplus"]),
                float(summary_data["line_15_banked_units_used"]),
                float(summary_data["line_16_banked_units_remaining"]),
                float(summary_data["line_17_non_banked_units_used"]),
                float(summary_data["line_18_units_to_be_banked"]),
                float(summary_data["line_19_units_to_be_exported"]),
                float(summary_data["line_20_surplus_deficit_units"]),
                float(summary_data["line_21_surplus_deficit_ratio"]),
                float(summary_data["line_22_compliance_units_issued"]),
                # Fossil derived base fuel (aggregate)
                float(summary_data["line_11_fossil_derived_base_fuel_gasoline"]),
                float(summary_data["line_11_fossil_derived_base_fuel_diesel"]),
                float(summary_data["line_11_fossil_derived_base_fuel_jet_fuel"]),
                float(summary_data["line_11_fossil_derived_base_fuel_total"]),
                # Non-compliance penalty fields
                float(summary_data["line_21_non_compliance_penalty_payable"]),
                float(summary_data["total_non_compliance_penalty_payable"]),
                # Historical snapshot
                snapshot_json,
                # WHERE clause
                lcfs_compliance_report_id,
            ]

            lcfs_cursor.execute(update_sql, params)
            return lcfs_cursor.rowcount > 0

        except Exception as e:
            logger.error(
                f"Failed to update summary for compliance_report_id {lcfs_compliance_report_id}: {e}"
            )
            return False

    def update_summaries(self) -> Tuple[int, int]:
        """Main update logic with enhanced batch processing"""
        update_count = 0
        skip_count = 0
        BATCH_SIZE = 10  # Commit every 10 records

        try:
            with get_source_connection() as tfrs_conn:
                with get_destination_connection() as lcfs_conn:
                    tfrs_cursor = tfrs_conn.cursor()
                    lcfs_cursor = lcfs_conn.cursor()

                    # Load mappings
                    self.load_mappings(lcfs_cursor)

                    # Fetch snapshot data
                    snapshot_records = self.fetch_snapshot_data(tfrs_cursor)

                    logger.info("Starting summary update process")
                    for record in snapshot_records:
                        legacy_compliance_report_id = record["compliance_report_id"]
                        lcfs_compliance_report_id = self.legacy_to_lcfs_mapping.get(
                            legacy_compliance_report_id
                        )

                        if lcfs_compliance_report_id is None:
                            logger.warning(
                                f"No LCFS compliance report found for legacy id {legacy_compliance_report_id}"
                            )
                            skip_count += 1
                            continue

                        logger.info(
                            f"Processing legacy id {legacy_compliance_report_id} (LCFS ID: {lcfs_compliance_report_id})"
                        )

                        # Parse summary data with enhanced logic
                        summary_data = self.parse_summary_data(
                            record["snapshot"], lcfs_cursor
                        )
                        if summary_data is None:
                            logger.error(
                                f"Failed to parse summary data for legacy id {legacy_compliance_report_id}"
                            )
                            self.stats["snapshots_skipped_parse_error"] += 1
                            skip_count += 1
                            continue

                        # Update the record
                        if self.update_summary_record(
                            lcfs_cursor,
                            lcfs_compliance_report_id,
                            summary_data,
                            record["snapshot_json"],
                        ):
                            update_count += 1
                            self.stats["updates_successful"] += 1
                            logger.info(
                                f"Successfully updated legacy id {legacy_compliance_report_id} (LCFS ID: {lcfs_compliance_report_id})"
                            )
                            # Commit every batch_size records
                            if update_count % BATCH_SIZE == 0:
                                lcfs_conn.commit()
                                self.stats["batch_commits"] += 1
                                logger.info(
                                    f"Committed batch. Total processed: {update_count}"
                                )
                        else:
                            self.stats["updates_failed"] += 1
                            skip_count += 1

                    # Commit all changes
                    lcfs_conn.commit()
                    logger.info(f"Successfully committed {update_count} updates")

                    tfrs_cursor.close()
                    lcfs_cursor.close()

        except Exception as e:
            logger.error(f"Update process failed: {e}")
            raise

        return update_count, skip_count

    def print_statistics(self):
        """Print comprehensive migration statistics"""
        logger.info("=" * 60)
        logger.info("COMPLIANCE SUMMARY UPDATE STATISTICS")
        logger.info("=" * 60)

        logger.info(f"📊 Source Data:")
        logger.info(f"  • Snapshot records found: {self.stats['tfrs_snapshots_found']}")
        logger.info(f"  • Snapshots processed: {self.stats['snapshots_processed']}")

        logger.info(f"🔄 Processing Results:")
        logger.info(f"  • Successful updates: {self.stats['updates_successful']}")
        logger.info(f"  • Failed updates: {self.stats['updates_failed']}")
        logger.info(f"  • Parse errors: {self.stats['snapshots_skipped_parse_error']}")
        logger.info(f"  • Line 17 calculations: {self.stats['line_17_calculations']}")
        logger.info(f"  • Batch commits: {self.stats['batch_commits']}")

        total_processed = (
            self.stats["updates_successful"] + self.stats["updates_failed"]
        )
        success_rate = (
            (self.stats["updates_successful"] / total_processed * 100)
            if total_processed > 0
            else 0
        )
        logger.info(f"  • Success rate: {success_rate:.1f}%")

        logger.info("=" * 60)


def main():
    setup_logging()
    logger.info("Starting Compliance Summary Update")

    updater = ComplianceSummaryUpdater()

    try:
        updated, skipped = updater.update_summaries()
        # Print statistics
        updater.print_statistics()
        logger.info(
            f"Update completed successfully. Updated: {updated}, Skipped: {skipped}"
        )
    except Exception as e:
        logger.error(f"Update failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
