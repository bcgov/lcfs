#!/usr/bin/env python3
"""
Compliance Summary Validation Script

Validates the migration of compliance summaries from TFRS to LCFS by comparing
the source snapshot data with the migrated LCFS summary records.
"""

import os
import sys

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import logging
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from core.database import get_source_connection, get_destination_connection
from core.utils import setup_logging, safe_decimal, build_legacy_mapping

logger = logging.getLogger(__name__)


class ComplianceSummaryValidator:
    def __init__(self):
        self.legacy_to_lcfs_mapping: Dict[int, int] = {}
        self.validation_errors: List[Dict] = []
        self.warnings: List[Dict] = []

    def load_mappings(self, lcfs_cursor):
        logger.info("Loading legacy ID to LCFS compliance_report_id mappings")
        self.legacy_to_lcfs_mapping = build_legacy_mapping(lcfs_cursor)
        logger.info(f"Loaded {len(self.legacy_to_lcfs_mapping)} legacy mappings")

    def fetch_tfrs_snapshot_data(self, tfrs_cursor) -> List[Dict]:
        """Fetch snapshot data from TFRS"""
        query = """
            SELECT compliance_report_id, snapshot
            FROM public.compliance_report_snapshot
            WHERE snapshot IS NOT NULL
        """

        tfrs_cursor.execute(query)
        records = []

        for row in tfrs_cursor.fetchall():
            try:
                snapshot_data = json.loads(row[1])
                records.append(
                    {"compliance_report_id": row[0], "snapshot": snapshot_data}
                )
            except json.JSONDecodeError as e:
                logger.warning(
                    f"Failed to parse JSON for compliance_report_id {row[0]}: {e}"
                )
                continue

        logger.info(f"Fetched {len(records)} TFRS snapshot records")
        return records

    def fetch_lcfs_summary_data(self, lcfs_cursor) -> Dict[int, Dict]:
        """Fetch summary data from LCFS"""
        query = """
            SELECT 
                compliance_report_id,
                line_1_fossil_derived_base_fuel_gasoline,
                line_2_eligible_renewable_fuel_supplied_gasoline,
                line_3_total_tracked_fuel_supplied_gasoline,
                line_4_eligible_renewable_fuel_required_gasoline,
                line_5_net_notionally_transferred_gasoline,
                line_6_renewable_fuel_retained_gasoline,
                line_7_previously_retained_gasoline,
                line_8_obligation_deferred_gasoline,
                line_9_obligation_added_gasoline,
                line_10_net_renewable_fuel_supplied_gasoline,
                line_11_non_compliance_penalty_gasoline,
                line_1_fossil_derived_base_fuel_diesel,
                line_2_eligible_renewable_fuel_supplied_diesel,
                line_3_total_tracked_fuel_supplied_diesel,
                line_4_eligible_renewable_fuel_required_diesel,
                line_5_net_notionally_transferred_diesel,
                line_6_renewable_fuel_retained_diesel,
                line_7_previously_retained_diesel,
                line_8_obligation_deferred_diesel,
                line_9_obligation_added_diesel,
                line_10_net_renewable_fuel_supplied_diesel,
                line_11_non_compliance_penalty_diesel,
                line_15_banked_units_used,
                line_22_compliance_units_issued,
                line_21_non_compliance_penalty_payable,
                total_non_compliance_penalty_payable
            FROM compliance_report_summary
        """

        lcfs_cursor.execute(query)
        records = {}

        for row in lcfs_cursor.fetchall():
            compliance_report_id = row[0]
            records[compliance_report_id] = {
                "line_1_fossil_derived_base_fuel_gasoline": row[1],
                "line_2_eligible_renewable_fuel_supplied_gasoline": row[2],
                "line_3_total_tracked_fuel_supplied_gasoline": row[3],
                "line_4_eligible_renewable_fuel_required_gasoline": row[4],
                "line_5_net_notionally_transferred_gasoline": row[5],
                "line_6_renewable_fuel_retained_gasoline": row[6],
                "line_7_previously_retained_gasoline": row[7],
                "line_8_obligation_deferred_gasoline": row[8],
                "line_9_obligation_added_gasoline": row[9],
                "line_10_net_renewable_fuel_supplied_gasoline": row[10],
                "line_11_non_compliance_penalty_gasoline": row[11],
                "line_1_fossil_derived_base_fuel_diesel": row[12],
                "line_2_eligible_renewable_fuel_supplied_diesel": row[13],
                "line_3_total_tracked_fuel_supplied_diesel": row[14],
                "line_4_eligible_renewable_fuel_required_diesel": row[15],
                "line_5_net_notionally_transferred_diesel": row[16],
                "line_6_renewable_fuel_retained_diesel": row[17],
                "line_7_previously_retained_diesel": row[18],
                "line_8_obligation_deferred_diesel": row[19],
                "line_9_obligation_added_diesel": row[20],
                "line_10_net_renewable_fuel_supplied_diesel": row[21],
                "line_11_non_compliance_penalty_diesel": row[22],
                "line_15_banked_units_used": row[23],
                "line_22_compliance_units_issued": row[24],
                "line_21_non_compliance_penalty_payable": row[25],
                "total_non_compliance_penalty_payable": row[26],
            }

        logger.info(f"Fetched {len(records)} LCFS summary records")
        return records

    def parse_tfrs_snapshot(self, snapshot: Dict) -> Dict:
        """Parse TFRS snapshot data into expected format"""
        summary_lines = snapshot.get("summary", {}).get("lines", {})

        # Extract gasoline class mappings (lines 1-11)
        gasoline_values = {}
        for i in range(1, 12):
            gasoline_values[f"line_{i}_gasoline"] = safe_decimal(
                summary_lines.get(str(i), 0)
            )

        # Extract diesel class mappings (lines 12-22)
        diesel_values = {}
        for i in range(1, 12):
            diesel_values[f"line_{i}_diesel"] = safe_decimal(
                summary_lines.get(str(i + 11), 0)
            )

        # Extract special fields
        compliance_units_issued = safe_decimal(summary_lines.get("25", 0))
        banked_used = safe_decimal(summary_lines.get("26", 0))
        line28_penalty = safe_decimal(summary_lines.get("28", 0))
        total_payable = safe_decimal(
            snapshot.get("summary", {}).get("total_payable", 0)
        )

        return {
            **gasoline_values,
            **diesel_values,
            "compliance_units_issued": compliance_units_issued,
            "banked_used": banked_used,
            "line28_penalty": line28_penalty,
            "total_payable": total_payable,
        }

    def validate_field_mapping(
        self,
        tfrs_data: Dict,
        lcfs_data: Dict,
        legacy_report_id: int,
        lcfs_report_id: int,
    ) -> bool:
        """Validate that TFRS fields are correctly mapped to LCFS fields"""
        validation_passed = True
        tolerance = Decimal("0.01")  # Allow small floating point differences

        # Define field mappings for validation
        field_mappings = [
            # Gasoline class mappings
            ("line_1_gasoline", "line_1_fossil_derived_base_fuel_gasoline"),
            ("line_2_gasoline", "line_2_eligible_renewable_fuel_supplied_gasoline"),
            ("line_3_gasoline", "line_3_total_tracked_fuel_supplied_gasoline"),
            ("line_4_gasoline", "line_4_eligible_renewable_fuel_required_gasoline"),
            ("line_5_gasoline", "line_5_net_notionally_transferred_gasoline"),
            ("line_6_gasoline", "line_6_renewable_fuel_retained_gasoline"),
            ("line_7_gasoline", "line_7_previously_retained_gasoline"),
            ("line_8_gasoline", "line_8_obligation_deferred_gasoline"),
            ("line_9_gasoline", "line_9_obligation_added_gasoline"),
            ("line_10_gasoline", "line_10_net_renewable_fuel_supplied_gasoline"),
            ("line_11_gasoline", "line_11_non_compliance_penalty_gasoline"),
            # Diesel class mappings
            ("line_1_diesel", "line_1_fossil_derived_base_fuel_diesel"),
            ("line_2_diesel", "line_2_eligible_renewable_fuel_supplied_diesel"),
            ("line_3_diesel", "line_3_total_tracked_fuel_supplied_diesel"),
            ("line_4_diesel", "line_4_eligible_renewable_fuel_required_diesel"),
            ("line_5_diesel", "line_5_net_notionally_transferred_diesel"),
            ("line_6_diesel", "line_6_renewable_fuel_retained_diesel"),
            ("line_7_diesel", "line_7_previously_retained_diesel"),
            ("line_8_diesel", "line_8_obligation_deferred_diesel"),
            ("line_9_diesel", "line_9_obligation_added_diesel"),
            ("line_10_diesel", "line_10_net_renewable_fuel_supplied_diesel"),
            ("line_11_diesel", "line_11_non_compliance_penalty_diesel"),
            # Special field mappings
            ("compliance_units_issued", "line_22_compliance_units_issued"),
            ("banked_used", "line_15_banked_units_used"),
            ("line28_penalty", "line_21_non_compliance_penalty_payable"),
            ("total_payable", "total_non_compliance_penalty_payable"),
        ]

        # Validate decimal/float fields
        for tfrs_field, lcfs_field in field_mappings:
            tfrs_value = Decimal(str(tfrs_data.get(tfrs_field, 0)))
            lcfs_value = Decimal(str(lcfs_data.get(lcfs_field, 0)))

            if abs(tfrs_value - lcfs_value) > tolerance:
                self.validation_errors.append(
                    {
                        "type": "field_mismatch",
                        "legacy_report_id": legacy_report_id,
                        "lcfs_report_id": lcfs_report_id,
                        "field": lcfs_field,
                        "tfrs_value": float(tfrs_value),
                        "lcfs_value": float(lcfs_value),
                        "difference": float(abs(tfrs_value - lcfs_value)),
                    }
                )
                validation_passed = False

        # No integer fields to validate since credits_offset fields are not in LCFS

        return validation_passed

    def validate_migration(self) -> Tuple[int, int, int]:
        """Run full validation of compliance summary migration"""
        total_validated = 0
        total_passed = 0
        total_failed = 0

        try:
            with get_source_connection() as tfrs_conn:
                with get_destination_connection() as lcfs_conn:
                    tfrs_cursor = tfrs_conn.cursor()
                    lcfs_cursor = lcfs_conn.cursor()

                    # Load mappings
                    self.load_mappings(lcfs_cursor)

                    # Fetch data from both systems
                    tfrs_snapshots = self.fetch_tfrs_snapshot_data(tfrs_cursor)
                    lcfs_summaries = self.fetch_lcfs_summary_data(lcfs_cursor)

                    logger.info("Starting validation process")

                    for tfrs_record in tfrs_snapshots:
                        legacy_report_id = tfrs_record["compliance_report_id"]
                        lcfs_report_id = self.legacy_to_lcfs_mapping.get(
                            legacy_report_id
                        )

                        if lcfs_report_id is None:
                            self.warnings.append(
                                {
                                    "type": "missing_mapping",
                                    "legacy_report_id": legacy_report_id,
                                    "message": "No LCFS mapping found for TFRS report",
                                }
                            )
                            continue

                        if lcfs_report_id not in lcfs_summaries:
                            self.validation_errors.append(
                                {
                                    "type": "missing_lcfs_summary",
                                    "legacy_report_id": legacy_report_id,
                                    "lcfs_report_id": lcfs_report_id,
                                    "message": "LCFS summary record not found",
                                }
                            )
                            total_failed += 1
                            continue

                        # Parse TFRS snapshot data
                        tfrs_parsed = self.parse_tfrs_snapshot(tfrs_record["snapshot"])
                        lcfs_data = lcfs_summaries[lcfs_report_id]

                        # Validate field mappings
                        if self.validate_field_mapping(
                            tfrs_parsed, lcfs_data, legacy_report_id, lcfs_report_id
                        ):
                            total_passed += 1
                        else:
                            total_failed += 1

                        total_validated += 1

                    tfrs_cursor.close()
                    lcfs_cursor.close()

        except Exception as e:
            logger.error(f"Validation failed: {e}")
            raise

        return total_validated, total_passed, total_failed

    def generate_report(self) -> str:
        """Generate validation report"""
        report = []
        report.append("=" * 60)
        report.append("COMPLIANCE SUMMARY VALIDATION REPORT")
        report.append("=" * 60)

        if self.validation_errors:
            report.append(f"\nCRITICAL ERRORS ({len(self.validation_errors)}):")
            report.append("-" * 40)
            for error in self.validation_errors:
                report.append(
                    f"• {error['type']}: Legacy ID {error['legacy_report_id']}"
                )
                if "field" in error:
                    report.append(f"  Field: {error['field']}")
                    if "tfrs_value" in error:
                        report.append(
                            f"  TFRS: {error['tfrs_value']}, LCFS: {error['lcfs_value']}"
                        )
                if "message" in error:
                    report.append(f"  {error['message']}")
                report.append("")

        if self.warnings:
            report.append(f"\nWARNINGS ({len(self.warnings)}):")
            report.append("-" * 40)
            for warning in self.warnings:
                report.append(
                    f"• {warning['type']}: Legacy ID {warning['legacy_report_id']}"
                )
                report.append(f"  {warning['message']}")
                report.append("")

        return "\n".join(report)


def main():
    setup_logging()
    logger.info("Starting Compliance Summary Validation")

    validator = ComplianceSummaryValidator()

    try:
        validated, passed, failed = validator.validate_migration()

        logger.info(
            f"Validation completed: {validated} records validated, {passed} passed, {failed} failed"
        )

        # Generate and display report
        report = validator.generate_report()
        print(report)

        # Save report to file
        with open("compliance_summary_validation_report.txt", "w") as f:
            f.write(report)

        logger.info(
            "Validation report saved to compliance_summary_validation_report.txt"
        )

        # Exit with error code if validation failed
        if failed > 0:
            sys.exit(1)

    except Exception as e:
        logger.error(f"Validation failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
