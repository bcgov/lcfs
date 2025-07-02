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
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional

from core.database import get_source_connection, get_destination_connection
from core.utils import setup_logging, safe_decimal, build_legacy_mapping

logger = logging.getLogger(__name__)


class ComplianceSummaryUpdater:
    def __init__(self):
        self.legacy_to_lcfs_mapping: Dict[int, int] = {}

    def load_mappings(self, lcfs_cursor):
        logger.info("Loading legacy ID to LCFS compliance_report_id mappings")
        self.legacy_to_lcfs_mapping = build_legacy_mapping(lcfs_cursor)
        logger.info(f"Loaded {len(self.legacy_to_lcfs_mapping)} legacy mappings")

    def fetch_snapshot_data(self, tfrs_cursor) -> List[Dict]:
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
                snapshot_data = json.loads(row[1])
                records.append(
                    {
                        "compliance_report_id": row[0],
                        "snapshot": snapshot_data,
                        "snapshot_json": row[1],
                    }
                )
            except json.JSONDecodeError as e:
                logger.warning(
                    f"Failed to parse JSON for compliance_report_id {row[0]}: {e}"
                )
                continue

        logger.info(f"Fetched {len(records)} snapshot records")
        return records

    def parse_summary_data(self, snapshot: Dict) -> Optional[Dict]:
        try:
            summary_lines = snapshot.get("summary", {}).get("lines", {})

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

            # Extract other summary data
            compliance_units_issued = safe_decimal(summary_lines.get("25", 0))
            banked_used = safe_decimal(summary_lines.get("26", 0))

            # Extract non-compliance penalty data
            line28_non_compliance = safe_decimal(summary_lines.get("28", 0))
            total_payable = safe_decimal(
                snapshot.get("summary", {}).get("total_payable", 0)
            )

            # Calculate fossil fuel totals
            fossil_gas = line1_gas
            fossil_diesel = line1_diesel
            fossil_total = fossil_gas + fossil_diesel

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
                # Low carbon fuel requirement summary
                "line_12_low_carbon_fuel_required": Decimal("0.0"),
                "line_13_low_carbon_fuel_supplied": Decimal("0.0"),
                "line_14_low_carbon_fuel_surplus": Decimal("0.0"),
                "line_15_banked_units_used": banked_used,
                "line_16_banked_units_remaining": Decimal("0.0"),
                "line_17_non_banked_units_used": Decimal("0.0"),
                "line_18_units_to_be_banked": Decimal("0.0"),
                "line_19_units_to_be_exported": Decimal("0.0"),
                "line_20_surplus_deficit_units": Decimal("0.0"),
                "line_21_surplus_deficit_ratio": Decimal("0.0"),
                "line_22_compliance_units_issued": compliance_units_issued,
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
        update_sql = """
            UPDATE public.compliance_report_summary
            SET 
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

    def update_summaries(self) -> tuple[int, int]:
        update_count = 0
        skip_count = 0

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

                        summary_data = self.parse_summary_data(record["snapshot"])
                        if summary_data is None:
                            logger.error(
                                f"Failed to parse summary data for legacy id {legacy_compliance_report_id}"
                            )
                            skip_count += 1
                            continue

                        if self.update_summary_record(
                            lcfs_cursor,
                            lcfs_compliance_report_id,
                            summary_data,
                            record["snapshot_json"],
                        ):
                            update_count += 1
                            logger.info(
                                f"Successfully updated legacy id {legacy_compliance_report_id} (LCFS ID: {lcfs_compliance_report_id})"
                            )
                        else:
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


def main():
    setup_logging()
    logger.info("Starting Compliance Summary Update")

    updater = ComplianceSummaryUpdater()

    try:
        updated, skipped = updater.update_summaries()
        logger.info(
            f"Update completed successfully. Updated: {updated}, Skipped: {skipped}"
        )
    except Exception as e:
        logger.error(f"Update failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
