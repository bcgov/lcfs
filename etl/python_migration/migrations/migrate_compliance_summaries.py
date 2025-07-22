#!/usr/bin/env python3
"""
Compliance Summary Migration Script

Migrates compliance report summary data from TFRS to LCFS database.
This script replicates the functionality of compliance_summary.groovy
"""

import os
import sys

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
import sys
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from core.database import get_source_connection, get_destination_connection
from core.utils import (
    setup_logging,
    safe_decimal,
    safe_int,
    safe_str,
    build_legacy_mapping,
)

logger = logging.getLogger(__name__)


class ComplianceSummaryMigrator:
    def __init__(self):
        self.legacy_to_lcfs_mapping: Dict[int, int] = {}
        self.existing_summary_ids: set = set()
        self.existing_compliance_report_ids: set = set()

    def load_mappings(self, lcfs_cursor):
        logger.info("Loading legacy ID to LCFS compliance_report_id mappings")
        self.legacy_to_lcfs_mapping = build_legacy_mapping(lcfs_cursor)
        logger.info(f"Loaded {len(self.legacy_to_lcfs_mapping)} legacy mappings")

        logger.info("Loading existing compliance_report_summary records")
        lcfs_cursor.execute(
            "SELECT summary_id, compliance_report_id FROM compliance_report_summary"
        )
        for row in lcfs_cursor.fetchall():
            summary_id, compliance_report_id = row
            self.existing_summary_ids.add(summary_id)
            self.existing_compliance_report_ids.add(compliance_report_id)

        logger.info(
            f"Found {len(self.existing_compliance_report_ids)} existing summary records"
        )

    def fetch_source_data(self, tfrs_cursor) -> List[Dict]:
        source_query = """
            SELECT
                cr.summary_id,
                cr.id AS compliance_report_id,
                crs.gasoline_class_retained,
                crs.gasoline_class_deferred,
                crs.diesel_class_retained,
                crs.diesel_class_deferred,
                crs.credits_offset,
                crs.diesel_class_obligation,
                crs.diesel_class_previously_retained,
                crs.gasoline_class_obligation,
                crs.gasoline_class_previously_retained
            FROM
                public.compliance_report cr
            JOIN
                public.compliance_report_summary crs
                ON cr.summary_id = crs.id 
            WHERE 
                cr.summary_id IS NOT NULL
            ORDER BY
                cr.id;
        """

        logger.info("Fetching source data from TFRS")
        tfrs_cursor.execute(source_query)
        records = []

        for row in tfrs_cursor.fetchall():
            records.append(
                {
                    "summary_id": row[0],
                    "compliance_report_id": row[1],
                    "gasoline_class_retained": row[2],
                    "gasoline_class_deferred": row[3],
                    "diesel_class_retained": row[4],
                    "diesel_class_deferred": row[5],
                    "credits_offset": row[6],
                    "diesel_class_obligation": row[7],
                    "diesel_class_previously_retained": row[8],
                    "gasoline_class_obligation": row[9],
                    "gasoline_class_previously_retained": row[10],
                }
            )

        logger.info(f"Fetched {len(records)} source records")
        return records

    def build_summary_record(self, source_record: Dict) -> Dict:
        source_compliance_report_legacy_id = source_record["compliance_report_id"]
        lcfs_compliance_report_id = self.legacy_to_lcfs_mapping.get(
            source_compliance_report_legacy_id
        )

        if lcfs_compliance_report_id is None:
            return None

        if lcfs_compliance_report_id in self.existing_compliance_report_ids:
            logger.warning(
                f"Summary already exists for LCFS compliance_report_id {lcfs_compliance_report_id}"
            )
            return None

        current_timestamp = datetime.now()

        return {
            "compliance_report_id": lcfs_compliance_report_id,
            "quarter": None,
            "is_locked": True,
            "line_1_fossil_derived_base_fuel_gasoline": None,
            "line_1_fossil_derived_base_fuel_diesel": None,
            "line_1_fossil_derived_base_fuel_jet_fuel": None,
            "line_2_eligible_renewable_fuel_supplied_gasoline": None,
            "line_2_eligible_renewable_fuel_supplied_diesel": None,
            "line_2_eligible_renewable_fuel_supplied_jet_fuel": None,
            "line_3_total_tracked_fuel_supplied_gasoline": None,
            "line_3_total_tracked_fuel_supplied_diesel": None,
            "line_3_total_tracked_fuel_supplied_jet_fuel": None,
            "line_4_eligible_renewable_fuel_required_gasoline": None,
            "line_4_eligible_renewable_fuel_required_diesel": None,
            "line_4_eligible_renewable_fuel_required_jet_fuel": None,
            "line_5_net_notionally_transferred_gasoline": None,
            "line_5_net_notionally_transferred_diesel": None,
            "line_5_net_notionally_transferred_jet_fuel": None,
            "line_6_renewable_fuel_retained_gasoline": safe_decimal(
                source_record["gasoline_class_retained"]
            ),
            "line_6_renewable_fuel_retained_diesel": safe_decimal(
                source_record["diesel_class_retained"]
            ),
            "line_6_renewable_fuel_retained_jet_fuel": None,
            "line_7_previously_retained_gasoline": safe_decimal(
                source_record["gasoline_class_previously_retained"]
            ),
            "line_7_previously_retained_diesel": safe_decimal(
                source_record["diesel_class_previously_retained"]
            ),
            "line_7_previously_retained_jet_fuel": None,
            "line_8_obligation_deferred_gasoline": safe_decimal(
                source_record["gasoline_class_deferred"]
            ),
            "line_8_obligation_deferred_diesel": safe_decimal(
                source_record["diesel_class_deferred"]
            ),
            "line_8_obligation_deferred_jet_fuel": None,
            "line_9_obligation_added_gasoline": safe_decimal(
                source_record["gasoline_class_obligation"]
            ),
            "line_9_obligation_added_diesel": safe_decimal(
                source_record["diesel_class_obligation"]
            ),
            "line_9_obligation_added_jet_fuel": None,
            "line_10_net_renewable_fuel_supplied_gasoline": None,
            "line_10_net_renewable_fuel_supplied_diesel": None,
            "line_10_net_renewable_fuel_supplied_jet_fuel": None,
            "line_11_non_compliance_penalty_gasoline": None,
            "line_11_non_compliance_penalty_diesel": None,
            "line_11_non_compliance_penalty_jet_fuel": None,
            "line_12_low_carbon_fuel_required": None,
            "line_13_low_carbon_fuel_supplied": None,
            "line_14_low_carbon_fuel_surplus": None,
            "line_15_banked_units_used": None,
            "line_16_banked_units_remaining": None,
            "line_17_non_banked_units_used": None,
            "line_18_units_to_be_banked": None,
            "line_19_units_to_be_exported": None,
            "line_20_surplus_deficit_units": None,
            "line_21_surplus_deficit_ratio": None,
            "line_22_compliance_units_issued": safe_int(
                source_record["credits_offset"]
            ),
            "line_11_fossil_derived_base_fuel_gasoline": None,
            "line_11_fossil_derived_base_fuel_diesel": None,
            "line_11_fossil_derived_base_fuel_jet_fuel": None,
            "line_11_fossil_derived_base_fuel_total": None,
            "line_21_non_compliance_penalty_payable": None,
            "total_non_compliance_penalty_payable": None,
            "create_date": current_timestamp,
            "update_date": current_timestamp,
            "create_user": "etl_user",
            "update_user": "etl_user",
        }

    def insert_summary_record(self, lcfs_cursor, record: Dict) -> bool:
        insert_sql = """
            INSERT INTO compliance_report_summary (
                compliance_report_id,
                quarter,
                is_locked,
                line_1_fossil_derived_base_fuel_gasoline,
                line_1_fossil_derived_base_fuel_diesel,
                line_1_fossil_derived_base_fuel_jet_fuel,
                line_2_eligible_renewable_fuel_supplied_gasoline,
                line_2_eligible_renewable_fuel_supplied_diesel,
                line_2_eligible_renewable_fuel_supplied_jet_fuel,
                line_3_total_tracked_fuel_supplied_gasoline,
                line_3_total_tracked_fuel_supplied_diesel,
                line_3_total_tracked_fuel_supplied_jet_fuel,
                line_4_eligible_renewable_fuel_required_gasoline,
                line_4_eligible_renewable_fuel_required_diesel,
                line_4_eligible_renewable_fuel_required_jet_fuel,
                line_5_net_notionally_transferred_gasoline,
                line_5_net_notionally_transferred_diesel,
                line_5_net_notionally_transferred_jet_fuel,
                line_6_renewable_fuel_retained_gasoline,
                line_6_renewable_fuel_retained_diesel,
                line_6_renewable_fuel_retained_jet_fuel,
                line_7_previously_retained_gasoline,
                line_7_previously_retained_diesel,
                line_7_previously_retained_jet_fuel,
                line_8_obligation_deferred_gasoline,
                line_8_obligation_deferred_diesel,
                line_8_obligation_deferred_jet_fuel,
                line_9_obligation_added_gasoline,
                line_9_obligation_added_diesel,
                line_9_obligation_added_jet_fuel,
                line_10_net_renewable_fuel_supplied_gasoline,
                line_10_net_renewable_fuel_supplied_diesel,
                line_10_net_renewable_fuel_supplied_jet_fuel,
                line_11_non_compliance_penalty_gasoline,
                line_11_non_compliance_penalty_diesel,
                line_11_non_compliance_penalty_jet_fuel,
                line_12_low_carbon_fuel_required,
                line_13_low_carbon_fuel_supplied,
                line_14_low_carbon_fuel_surplus,
                line_15_banked_units_used,
                line_16_banked_units_remaining,
                line_17_non_banked_units_used,
                line_18_units_to_be_banked,
                line_19_units_to_be_exported,
                line_20_surplus_deficit_units,
                line_21_surplus_deficit_ratio,
                line_22_compliance_units_issued,
                line_11_fossil_derived_base_fuel_gasoline,
                line_11_fossil_derived_base_fuel_diesel,
                line_11_fossil_derived_base_fuel_jet_fuel,
                line_11_fossil_derived_base_fuel_total,
                line_21_non_compliance_penalty_payable,
                total_non_compliance_penalty_payable,
                create_date,
                update_date,
                create_user,
                update_user
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
        """

        try:
            # Build parameters list in the same order as the INSERT statement
            params = [
                record["compliance_report_id"],
                record["quarter"],
                record["is_locked"],
                (
                    float(record["line_1_fossil_derived_base_fuel_gasoline"])
                    if record["line_1_fossil_derived_base_fuel_gasoline"] is not None
                    else 0.0
                ),
                (
                    float(record["line_1_fossil_derived_base_fuel_diesel"])
                    if record["line_1_fossil_derived_base_fuel_diesel"] is not None
                    else 0.0
                ),
                0.0,  # jet_fuel
                0.0,  # gasoline supplied
                0.0,  # diesel supplied
                0.0,  # jet fuel supplied
                0.0,  # gasoline tracked
                0.0,  # diesel tracked
                0.0,  # jet fuel tracked
                0.0,  # gasoline required
                0.0,  # diesel required
                0.0,  # jet fuel required
                0.0,  # gasoline transferred
                0.0,  # diesel transferred
                0.0,  # jet fuel transferred
                (
                    float(record["line_6_renewable_fuel_retained_gasoline"])
                    if record["line_6_renewable_fuel_retained_gasoline"] is not None
                    else 0.0
                ),
                (
                    float(record["line_6_renewable_fuel_retained_diesel"])
                    if record["line_6_renewable_fuel_retained_diesel"] is not None
                    else 0.0
                ),
                0.0,  # jet fuel retained
                (
                    float(record["line_7_previously_retained_gasoline"])
                    if record["line_7_previously_retained_gasoline"] is not None
                    else 0.0
                ),
                (
                    float(record["line_7_previously_retained_diesel"])
                    if record["line_7_previously_retained_diesel"] is not None
                    else 0.0
                ),
                0.0,  # jet fuel previously retained
                (
                    float(record["line_8_obligation_deferred_gasoline"])
                    if record["line_8_obligation_deferred_gasoline"] is not None
                    else 0.0
                ),
                (
                    float(record["line_8_obligation_deferred_diesel"])
                    if record["line_8_obligation_deferred_diesel"] is not None
                    else 0.0
                ),
                0.0,  # jet fuel deferred
                (
                    float(record["line_9_obligation_added_gasoline"])
                    if record["line_9_obligation_added_gasoline"] is not None
                    else 0.0
                ),
                (
                    float(record["line_9_obligation_added_diesel"])
                    if record["line_9_obligation_added_diesel"] is not None
                    else 0.0
                ),
                0.0,  # jet fuel added
                0.0,  # gasoline net supplied
                0.0,  # diesel net supplied
                0.0,  # jet fuel net supplied
                None,  # gasoline penalty
                None,  # diesel penalty
                None,  # jet fuel penalty
                0.0,  # low carbon fuel required
                0.0,  # low carbon fuel supplied
                0.0,  # low carbon fuel surplus
                0.0,  # banked units used
                0.0,  # banked units remaining
                0.0,  # non-banked units used
                0.0,  # units to be banked
                0.0,  # units to be exported
                0.0,  # surplus deficit units
                0.0,  # surplus deficit ratio
                record["line_22_compliance_units_issued"],
                0.0,  # fossil gasoline (repeat)
                0.0,  # fossil diesel (repeat)
                0.0,  # fossil jet fuel (repeat)
                0.0,  # fossil total (repeat)
                0.0,  # penalty payable
                0.0,  # total penalty payable
                record["create_date"],
                record["update_date"],
                record["create_user"],
                record["update_user"],
            ]

            lcfs_cursor.execute(insert_sql, params)
            return True

        except Exception as e:
            logger.error(
                f"Failed to insert summary record for compliance_report_id {record['compliance_report_id']}: {e}"
            )
            return False

    def migrate(self) -> Tuple[int, int]:
        total_inserted = 0
        total_skipped = 0

        try:
            with get_source_connection() as tfrs_conn:
                with get_destination_connection() as lcfs_conn:
                    tfrs_cursor = tfrs_conn.cursor()
                    lcfs_cursor = lcfs_conn.cursor()

                    # Load mappings and existing data
                    self.load_mappings(lcfs_cursor)

                    # Fetch source data
                    source_records = self.fetch_source_data(tfrs_cursor)

                    logger.info("Starting migration process")
                    for source_record in source_records:
                        summary_record = self.build_summary_record(source_record)

                        if summary_record is None:
                            total_skipped += 1
                            continue

                        if self.insert_summary_record(lcfs_cursor, summary_record):
                            total_inserted += 1
                            # Track that we've inserted this compliance_report_id
                            self.existing_compliance_report_ids.add(
                                summary_record["compliance_report_id"]
                            )
                        else:
                            total_skipped += 1

                    # Commit all changes
                    lcfs_conn.commit()
                    logger.info(f"Successfully committed {total_inserted} records")

                    tfrs_cursor.close()
                    lcfs_cursor.close()

        except Exception as e:
            logger.error(f"Migration failed: {e}")
            raise

        return total_inserted, total_skipped


def main():
    setup_logging()
    logger.info("Starting Compliance Summary Migration")

    migrator = ComplianceSummaryMigrator()

    try:
        inserted, skipped = migrator.migrate()
        logger.info(
            f"Migration completed successfully. Inserted: {inserted}, Skipped: {skipped}"
        )
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
