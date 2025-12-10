#!/usr/bin/env python3
"""
Other Uses Migration Script

Migrates Schedule C (other uses) data from TFRS to LCFS database.
This script replicates the functionality of other_uses.groovy
"""

import os
import sys

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import argparse
import logging
import sys
import uuid
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


class OtherUsesMigrator:
    def __init__(self, dry_run: bool = False):
        self.record_uuid_map: Dict[int, str] = {}
        self.legacy_to_lcfs_mapping: Dict[int, int] = {}
        self.dry_run = dry_run
        
        # Statistics for dry run
        self.stats = {
            'tfrs_reports_found': 0,
            'schedule_c_records_found': 0,
            'creates': 0,
            'updates': 0,
            'skipped_no_lcfs_match': 0,
            'fuel_type_mappings': {},
            'fuel_category_mappings': {},
            'expected_use_mappings': {}
        }

    def map_fuel_category_id(self, fuel_class_id: int) -> Optional[int]:
        """Maps TFRS fuel_class_id to LCFS fuel_category_id"""
        mapping = {
            1: 2,  # Diesel
            2: 1,  # Gasoline
        }
        result = mapping.get(fuel_class_id)
        # Track mapping usage for stats
        if result:
            key = f"{fuel_class_id}->{result}"
            self.stats['fuel_category_mappings'][key] = self.stats['fuel_category_mappings'].get(key, 0) + 1
        return result

    def map_fuel_type_id(self, tfrs_type_id: int) -> int:
        """Maps TFRS fuel type ID to LCFS fuel type ID"""
        mapping = {
            1: 1,  # Biodiesel
            2: 2,  # CNG
            3: 3,  # Electricity
            4: 4,  # Ethanol
            5: 5,  # HDRD
            6: 6,  # Hydrogen
            7: 7,  # LNG
            8: 13,  # Propane
            9: 5,  # Renewable diesel -> HDRD
            10: 14,  # Renewable gasoline
            11: 17,  # Natural gas-based gasoline -> Fossil-derived gasoline
            19: 16,  # Petroleum-based diesel -> Fossil-derived diesel
            20: 17,  # Petroleum-based gasoline -> Fossil-derived gasoline
            21: 15,  # Renewable naphtha
        }
        result = mapping.get(tfrs_type_id, 19)  # Default to 'Other' if no match found
        # Track mapping usage for stats
        key = f"{tfrs_type_id}->{result}"
        self.stats['fuel_type_mappings'][key] = self.stats['fuel_type_mappings'].get(key, 0) + 1
        return result

    def map_expected_use_id(self, tfrs_expected_use_id: int) -> int:
        """Maps TFRS expected use ID to LCFS expected use ID"""
        mapping = {
            2: 1,  # Heating Oil
            1: 2,  # Other
        }
        result = mapping.get(tfrs_expected_use_id, 2)  # Default to 'Other' (id: 2)
        # Track mapping usage for stats
        key = f"{tfrs_expected_use_id}->{result}"
        self.stats['expected_use_mappings'][key] = self.stats['expected_use_mappings'].get(key, 0) + 1
        return result

    def is_record_changed(self, old_row: Optional[Dict], new_row: Dict) -> bool:
        """Checks if any relevant fields in a schedule_c record differ between old and new"""
        if not old_row or not new_row:
            return True

        return (
            old_row.get("quantity") != new_row.get("quantity")
            or old_row.get("fuel_type_id") != new_row.get("fuel_type_id")
            or old_row.get("fuel_class_id") != new_row.get("fuel_class_id")
            or old_row.get("expected_use_id") != new_row.get("expected_use_id")
            or old_row.get("rationale") != new_row.get("rationale")
        )

    def get_current_version(self, lcfs_cursor, group_uuid: str) -> int:
        """Get current highest version for a group UUID"""
        query = """
            SELECT version
            FROM other_uses
            WHERE group_uuid = %s
            ORDER BY version DESC
            LIMIT 1
        """
        lcfs_cursor.execute(query, (group_uuid,))
        result = lcfs_cursor.fetchone()
        return result[0] if result else -1

    def insert_version_row(
        self, lcfs_cursor, lcfs_cr_id: int, row_data: Dict, action: str, content_key: str
    ) -> bool:
        """Inserts a new row in other_uses with action=CREATE/UPDATE"""
        try:
            record_id = row_data["schedule_c_record_id"]

            # Use content_key for group_uuid instead of record_id
            # This ensures the same logical record (same content) gets the same
            # group_uuid across supplemental reports, even if the TFRS record_id changes
            group_uuid = self.record_uuid_map.get(content_key)
            if not group_uuid:
                group_uuid = str(uuid.uuid4())
                self.record_uuid_map[content_key] = group_uuid

            # Get current highest version
            current_ver = self.get_current_version(lcfs_cursor, group_uuid)
            next_ver = 0 if current_ver < 0 else current_ver + 1

            # Map TFRS fields to LCFS fields
            expected_use_id = self.map_expected_use_id(
                row_data.get("expected_use_id", 1)
            )
            fuel_cat_id = self.map_fuel_category_id(row_data.get("fuel_class_id"))
            fuel_type_id = self.map_fuel_type_id(row_data.get("fuel_type_id", 1))
            quantity = safe_decimal(row_data.get("quantity", 0))
            rationale = safe_str(row_data.get("rationale", ""))
            units = safe_str(row_data.get("unit_of_measure", ""))
            ci_of_fuel = safe_decimal(row_data.get("ci_of_fuel", 0))

            # Insert the record
            insert_sql = """
                INSERT INTO other_uses (
                    compliance_report_id,
                    fuel_type_id,
                    fuel_category_id,
                    provision_of_the_act_id,
                    ci_of_fuel,
                    quantity_supplied,
                    units,
                    expected_use_id,
                    rationale,
                    group_uuid,
                    version,
                    action_type,
                    create_user,
                    update_user
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::actiontypeenum, %s, %s)
            """

            params = [
                lcfs_cr_id,
                fuel_type_id,
                fuel_cat_id,
                7,  # provision_of_the_act_id
                float(ci_of_fuel),
                float(quantity),
                units,
                expected_use_id,
                rationale,
                group_uuid,
                next_ver,
                action,
                "ETL",
                "ETL",
            ]

            if self.dry_run:
                logger.info(
                    f"[DRY RUN] Would insert other_uses row: recordId={record_id}, action={action}, groupUuid={group_uuid}, version={next_ver}"
                )
            else:
                lcfs_cursor.execute(insert_sql, params)
                logger.info(
                    f"Inserted other_uses row: recordId={record_id}, action={action}, groupUuid={group_uuid}, version={next_ver}"
                )
            return True

        except Exception as e:
            logger.error(f"Failed to insert other_uses record: {e}")
            return False

    def get_lcfs_reports_with_legacy_ids(self, lcfs_cursor) -> List[int]:
        """Get all LCFS compliance reports with legacy IDs"""
        query = """
            SELECT compliance_report_id, legacy_id
            FROM compliance_report
            WHERE legacy_id IS NOT NULL
        """
        lcfs_cursor.execute(query)
        return [row[1] for row in lcfs_cursor.fetchall()]  # Return legacy_ids

    def get_root_report_id(self, tfrs_cursor, tfrs_id: int) -> Optional[int]:
        """Find root report ID for supplemental chain"""
        query = """
            SELECT root_report_id
            FROM compliance_report
            WHERE id = %s
        """
        tfrs_cursor.execute(query, (tfrs_id,))
        result = tfrs_cursor.fetchone()
        return result[0] if result else None

    def get_report_chain(self, tfrs_cursor, root_id: int) -> List[int]:
        """Get full chain of reports"""
        query = """
            SELECT
                c.id AS tfrs_report_id,
                c.traversal
            FROM compliance_report c
            WHERE c.root_report_id = %s
            ORDER BY c.traversal, c.id
        """
        tfrs_cursor.execute(query, (root_id,))
        return [row[0] for row in tfrs_cursor.fetchall()]

    def make_content_key(self, record: Dict) -> str:
        """Create a content-based key for comparing records across reports.

        In TFRS, supplemental reports create NEW schedule_c_record IDs even when
        the data is identical. We need to compare by content, not by record ID.
        """
        quantity = safe_decimal(record.get("quantity", 0))
        fuel_type_id = safe_int(record.get("fuel_type_id", 0))
        fuel_class_id = safe_int(record.get("fuel_class_id", 0))
        expected_use_id = safe_int(record.get("expected_use_id", 0))
        rationale = safe_str(record.get("rationale", "")).strip().lower()

        return f"{quantity}|{fuel_type_id}|{fuel_class_id}|{expected_use_id}|{rationale}"

    def get_schedule_c_records(
        self, tfrs_cursor, chain_tfrs_id: int
    ) -> Dict[str, Dict]:
        """Get current Schedule C records for a report.

        Returns a dict keyed by content_key (not record_id) to enable proper
        comparison across supplemental reports where record IDs change but
        content stays the same.
        """
        query = """
            SELECT
                scr.id AS schedule_c_record_id,
                scr.quantity,
                scr.fuel_type_id,
                scr.fuel_class_id,
                scr.expected_use_id,
                scr.rationale,
                cr.id AS compliance_report_id,
                uom.name AS unit_of_measure,
                dci.density AS default_ci_of_fuel
            FROM compliance_report_schedule_c_record scr
            JOIN compliance_report_schedule_c sc ON sc.id = scr.schedule_id
            JOIN compliance_report cr ON cr.schedule_c_id = sc.id
            LEFT JOIN approved_fuel_type aft ON aft.id = scr.fuel_type_id
            LEFT JOIN default_carbon_intensity dci ON dci.category_id = aft.default_carbon_intensity_category_id
            LEFT JOIN unit_of_measure uom ON uom.id = aft.unit_of_measure_id
            WHERE cr.id = %s
        """

        tfrs_cursor.execute(query, (chain_tfrs_id,))
        records = {}

        for row in tfrs_cursor.fetchall():
            record_data = {
                "schedule_c_record_id": row[0],
                "quantity": row[1],
                "fuel_type_id": row[2],
                "fuel_class_id": row[3],
                "expected_use_id": row[4],
                "rationale": row[5],
                "unit_of_measure": row[7],
                "ci_of_fuel": row[8],
            }
            # Key by content instead of record_id for proper comparison
            content_key = self.make_content_key(record_data)
            records[content_key] = record_data

        return records

    def get_lcfs_compliance_report_id(
        self, lcfs_cursor, chain_tfrs_id: int
    ) -> Optional[int]:
        """Find corresponding LCFS compliance report"""
        query = """
            SELECT compliance_report_id
            FROM compliance_report
            WHERE legacy_id = %s
        """
        lcfs_cursor.execute(query, (chain_tfrs_id,))
        result = lcfs_cursor.fetchone()
        return result[0] if result else None

    def migrate(self) -> Tuple[int, int]:
        """Main migration logic"""
        total_processed = 0
        total_skipped = 0

        try:
            with get_source_connection() as tfrs_conn:
                with get_destination_connection() as lcfs_conn:
                    tfrs_cursor = tfrs_conn.cursor()
                    lcfs_cursor = lcfs_conn.cursor()

                    # Get all LCFS compliance reports with legacy IDs
                    logger.info(
                        "Retrieving LCFS compliance_report with legacy_id != null"
                    )
                    tfrs_ids = self.get_lcfs_reports_with_legacy_ids(lcfs_cursor)
                    self.stats['tfrs_reports_found'] = len(tfrs_ids)
                    logger.info(f"Found {len(tfrs_ids)} reports to process")

                    # Track processed chains to avoid duplicates
                    # Each chain (identified by root_id) should only be processed once
                    processed_chains = set()

                    # Process each TFRS compliance report
                    for tfrs_id in tfrs_ids:
                        logger.info(f"Processing TFRS compliance_report.id = {tfrs_id}")

                        # Find root report ID for supplemental chain
                        root_id = self.get_root_report_id(tfrs_cursor, tfrs_id)
                        if not root_id:
                            logger.warning(
                                f"No root_report_id found for TFRS #{tfrs_id}; skipping."
                            )
                            total_skipped += 1
                            continue

                        # Skip if this chain has already been processed
                        if root_id in processed_chains:
                            logger.debug(
                                f"Chain with root_id={root_id} already processed; skipping TFRS #{tfrs_id}."
                            )
                            continue
                        processed_chains.add(root_id)

                        # Get full chain of reports
                        chain_ids = self.get_report_chain(tfrs_cursor, root_id)
                        if not chain_ids:
                            logger.warning(f"Chain empty for root={root_id}? skipping.")
                            total_skipped += 1
                            continue

                        # Track previous records for change detection
                        previous_records = {}

                        # Process each report in the chain
                        for idx, chain_tfrs_id in enumerate(chain_ids):
                            logger.info(f"TFRS #{chain_tfrs_id} (chain idx={idx})")

                            # Get current Schedule C records
                            current_records = self.get_schedule_c_records(
                                tfrs_cursor, chain_tfrs_id
                            )
                            self.stats['schedule_c_records_found'] += len(current_records)

                            # Find corresponding LCFS compliance report
                            lcfs_cr_id = self.get_lcfs_compliance_report_id(
                                lcfs_cursor, chain_tfrs_id
                            )
                            if not lcfs_cr_id:
                                logger.warning(
                                    f"TFRS #{chain_tfrs_id} not found in LCFS; skipping diff."
                                )
                                self.stats['skipped_no_lcfs_match'] += len(current_records)
                                previous_records = current_records
                                continue

                            # Compare and insert records
                            # Records are now keyed by content_key, not rec_id
                            for content_key, new_data in current_records.items():
                                if content_key not in previous_records:
                                    self.insert_version_row(
                                        lcfs_cursor, lcfs_cr_id, new_data, "CREATE", content_key
                                    )
                                    self.stats['creates'] += 1
                                    total_processed += 1
                                elif self.is_record_changed(
                                    previous_records.get(content_key), new_data
                                ):
                                    self.insert_version_row(
                                        lcfs_cursor, lcfs_cr_id, new_data, "UPDATE", content_key
                                    )
                                    self.stats['updates'] += 1
                                    total_processed += 1

                            # CRITICAL: Handle records that were DELETED in this supplemental
                            # Find records that existed in the previous report but are NOT in this report
                            deleted_keys = set(previous_records.keys()) - set(current_records.keys())
                            for deleted_key in deleted_keys:
                                old_data = previous_records[deleted_key]
                                logger.info(f"Record removed in supplemental, inserting DELETE: {deleted_key}")
                                if self.insert_version_row(
                                    lcfs_cursor, lcfs_cr_id, old_data, "DELETE", deleted_key
                                ):
                                    self.stats['deletes'] = self.stats.get('deletes', 0) + 1
                                    total_processed += 1

                            previous_records = current_records

                    # Commit all changes
                    if not self.dry_run:
                        lcfs_conn.commit()
                        logger.info(f"Successfully committed {total_processed} records")
                    else:
                        logger.info(f"[DRY RUN] Would commit {total_processed} records")

                    tfrs_cursor.close()
                    lcfs_cursor.close()

        except Exception as e:
            logger.error(f"Migration failed: {e}")
            raise

        return total_processed, total_skipped

    def print_statistics(self):
        """Print comprehensive migration statistics"""
        logger.info("=" * 60)
        logger.info("OTHER USES MIGRATION STATISTICS")
        logger.info("=" * 60)
        
        logger.info(f"📊 Source Data:")
        logger.info(f"  • TFRS Compliance Reports Found: {self.stats['tfrs_reports_found']}")
        logger.info(f"  • Schedule C Records Found: {self.stats['schedule_c_records_found']}")
        
        logger.info(f"🔄 Actions to Perform:")
        logger.info(f"  • CREATE operations: {self.stats['creates']}")
        logger.info(f"  • UPDATE operations: {self.stats['updates']}")
        logger.info(f"  • Records skipped (no LCFS match): {self.stats['skipped_no_lcfs_match']}")
        
        total_actions = self.stats['creates'] + self.stats['updates']
        logger.info(f"  • Total records to process: {total_actions}")
        
        if self.stats['fuel_type_mappings']:
            logger.info(f"🔗 Fuel Type Mappings:")
            for mapping, count in sorted(self.stats['fuel_type_mappings'].items()):
                logger.info(f"  • {mapping}: {count} records")
        
        if self.stats['fuel_category_mappings']:
            logger.info(f"🔗 Fuel Category Mappings:")
            for mapping, count in sorted(self.stats['fuel_category_mappings'].items()):
                logger.info(f"  • {mapping}: {count} records")
        
        if self.stats['expected_use_mappings']:
            logger.info(f"🔗 Expected Use Mappings:")
            for mapping, count in sorted(self.stats['expected_use_mappings'].items()):
                logger.info(f"  • {mapping}: {count} records")
        
        logger.info("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Migrate Other Uses (Schedule C) data from TFRS to LCFS")
    parser.add_argument(
        "--dry-run", 
        action="store_true", 
        help="Run migration in dry-run mode (no database changes, statistics only)"
    )
    args = parser.parse_args()
    
    setup_logging()
    mode = "DRY RUN" if args.dry_run else "PRODUCTION"
    logger.info(f"Starting Other Uses (Schedule C) Migration - {mode} MODE")

    migrator = OtherUsesMigrator(dry_run=args.dry_run)

    try:
        processed, skipped = migrator.migrate()
        
        # Print statistics
        migrator.print_statistics()
        
        if args.dry_run:
            logger.info(f"[DRY RUN] Migration analysis completed. Would process: {processed}, Would skip: {skipped}")
        else:
            logger.info(f"Migration completed successfully. Processed: {processed}, Skipped: {skipped}")
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
