#!/usr/bin/env python3
"""
Notional Transfer Migration Script

Migrates notional transfers (Schedule A) data from TFRS to LCFS database.
This script replicates the functionality of notional_transfer.groovy

Key features:
1. Finds all LCFS compliance reports having a TFRS legacy_id
2. For each TFRS compliance report, determines its chain (root_report_id)
3. Retrieves schedule_a records for each version in the chain
4. Computes a diff (CREATE / UPDATE) between consecutive versions
5. Inserts rows in notional_transfer with a stable, random group_uuid per schedule_a_record_id
6. Versions these notional_transfer entries so that subsequent changes increment the version
"""

import os
import sys

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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


class NotionalTransferMigrator:
    def __init__(self):
        self.record_uuid_map: Dict[int, str] = {}
        self.legacy_to_lcfs_mapping: Dict[int, int] = {}

    def load_mappings(self, lcfs_cursor):
        """Load legacy ID to LCFS compliance_report_id mappings"""
        logger.info("Loading legacy ID to LCFS compliance_report_id mappings")
        self.legacy_to_lcfs_mapping = build_legacy_mapping(lcfs_cursor)
        logger.info(f"Loaded {len(self.legacy_to_lcfs_mapping)} legacy mappings")

    def map_received_or_transferred(self, transfer_type_id: int) -> str:
        """Maps TFRS transfer_type_id to 'Received' or 'Transferred'
        TFRS: 1=Transferred, 2=Received

        Note: This appears to be inverted in the original Groovy code.
        The mapping returns "Received" for type 1, which seems counterintuitive.
        Preserving original logic for consistency.
        """
        if transfer_type_id == 1:
            return "Received"
        return "Transferred"

    def map_fuel_category_id(self, fuel_class_id: int) -> Optional[int]:
        """Maps TFRS fuel_class_id to LCFS fuel_category_id"""
        mapping = {
            1: 2,  # Diesel
            2: 1,  # Gasoline
        }
        return mapping.get(fuel_class_id)

    def is_record_changed(self, old_row: Optional[Dict], new_row: Dict) -> bool:
        """Checks if any relevant fields in a schedule_a record differ between old and new"""
        if old_row is None or new_row is None:
            return True

        # Check numeric field changes
        if old_row.get("quantity") != new_row.get("quantity"):
            return True

        # Check other field changes
        if (
            old_row.get("fuel_class_id") != new_row.get("fuel_class_id")
            or old_row.get("transfer_type_id") != new_row.get("transfer_type_id")
            or old_row.get("trading_partner") != new_row.get("trading_partner")
            or old_row.get("postal_address") != new_row.get("postal_address")
        ):
            return True

        return False

    def get_current_version(self, lcfs_cursor, group_uuid: str) -> int:
        """Find current highest version in notional_transfer for that group_uuid"""
        query = """
            SELECT version
            FROM notional_transfer
            WHERE group_uuid = %s
            ORDER BY version DESC
            LIMIT 1
        """
        lcfs_cursor.execute(query, (group_uuid,))
        result = lcfs_cursor.fetchone()
        return result[0] if result else -1

    def get_lcfs_reports_with_legacy_ids(self, lcfs_cursor) -> List[int]:
        """Find all LCFS compliance reports that have TFRS legacy_id"""
        query = """
            SELECT compliance_report_id, legacy_id
            FROM compliance_report
            WHERE legacy_id IS NOT NULL
        """
        lcfs_cursor.execute(query)
        return [row[1] for row in lcfs_cursor.fetchall()]  # Return legacy_ids

    def get_root_report_id(self, tfrs_cursor, tfrs_id: int) -> Optional[int]:
        """Find the root_report_id for a given TFRS report"""
        query = """
            SELECT root_report_id
            FROM compliance_report
            WHERE id = %s
        """
        tfrs_cursor.execute(query, (tfrs_id,))
        result = tfrs_cursor.fetchone()
        return result[0] if result else None

    def get_report_chain(self, tfrs_cursor, root_id: int) -> List[int]:
        """Gather the chain of reports in ascending order"""
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

        In TFRS, supplemental reports create NEW schedule_a_record IDs even when
        the data is identical. We need to compare by content, not by record ID.
        """
        # Normalize values for consistent comparison
        trading_partner = safe_str(record.get("trading_partner", "")).strip().lower()
        postal_address = safe_str(record.get("postal_address", "")).strip().lower()
        quantity = safe_decimal(record.get("quantity", 0))
        fuel_class_id = safe_int(record.get("fuel_class_id", 0))
        transfer_type_id = safe_int(record.get("transfer_type_id", 0))

        return f"{trading_partner}|{postal_address}|{quantity}|{fuel_class_id}|{transfer_type_id}"

    def get_schedule_a_records(
        self, tfrs_cursor, tfrs_report_id: int
    ) -> Dict[str, Dict]:
        """Fetch current TFRS schedule_a records for a report.

        Returns a dict keyed by content_key (not record_id) to enable proper
        comparison across supplemental reports where record IDs change but
        content stays the same.
        """
        query = """
            SELECT
                sar.id AS schedule_a_record_id,
                sar.quantity,
                sar.trading_partner,
                sar.postal_address,
                sar.fuel_class_id,
                sar.transfer_type_id
            FROM compliance_report_schedule_a_record sar
            JOIN compliance_report_schedule_a sa ON sa.id = sar.schedule_id
            JOIN compliance_report c ON c.schedule_a_id = sa.id
            WHERE c.id = %s
            ORDER BY sar.id
        """

        tfrs_cursor.execute(query, (tfrs_report_id,))
        records = {}

        for row in tfrs_cursor.fetchall():
            rec_id = row[0]
            record_data = {
                "schedule_a_record_id": rec_id,
                "quantity": row[1],
                "trading_partner": row[2],
                "postal_address": row[3],
                "fuel_class_id": row[4],
                "transfer_type_id": row[5],
            }
            # Key by content instead of record_id for proper comparison
            content_key = self.make_content_key(record_data)
            records[content_key] = record_data

        return records

    def get_lcfs_compliance_report_id(self, lcfs_cursor, tfrs_id: int) -> Optional[int]:
        """Find the matching LCFS compliance_report by legacy_id"""
        query = """
            SELECT compliance_report_id
            FROM compliance_report
            WHERE legacy_id = %s
        """
        lcfs_cursor.execute(query, (tfrs_id,))
        result = lcfs_cursor.fetchone()
        return result[0] if result else None

    def insert_version_row(
        self, lcfs_cursor, lcfs_cr_id: int, row_data: Dict, action: str, content_key: str
    ) -> bool:
        """Inserts a new row in notional_transfer with proper versioning"""
        try:
            # Use content_key for group_uuid instead of record_id
            # This ensures the same logical record (same content) gets the same
            # group_uuid across supplemental reports, even if the TFRS record_id changes
            group_uuid = self.record_uuid_map.get(content_key)
            if not group_uuid:
                group_uuid = str(uuid.uuid4())
                self.record_uuid_map[content_key] = group_uuid

            # Find current highest version
            current_ver = self.get_current_version(lcfs_cursor, group_uuid)
            next_ver = 0 if current_ver < 0 else current_ver + 1

            # Map TFRS fields to LCFS fields
            rec_or_xfer = self.map_received_or_transferred(
                row_data.get("transfer_type_id", 2)
            )
            fuel_cat_id = self.map_fuel_category_id(row_data.get("fuel_class_id", 1))
            quantity = safe_decimal(row_data.get("quantity", 0))
            trade_partner = safe_str(row_data.get("trading_partner", ""))
            postal_address = safe_str(row_data.get("postal_address", ""))

            # Insert the new row
            insert_sql = """
                INSERT INTO notional_transfer (
                    compliance_report_id,
                    quantity,
                    legal_name,
                    address_for_service,
                    fuel_category_id,
                    received_or_transferred,
                    group_uuid,
                    version,
                    action_type,
                    create_user, 
                    update_user
                ) VALUES (
                    %s, %s, %s, %s, %s, %s::receivedOrTransferredEnum, %s, %s, %s::actiontypeenum, %s, %s
                )
            """

            params = [
                lcfs_cr_id,
                float(quantity),
                trade_partner,
                postal_address,
                fuel_cat_id,
                rec_or_xfer,
                group_uuid,
                next_ver,
                action,
                "ETL",
                "ETL",
            ]

            lcfs_cursor.execute(insert_sql, params)
            logger.info(
                f"Inserted notional_transfer row: content_key={content_key}, action={action}, groupUuid={group_uuid}, version={next_ver}"
            )
            return True

        except Exception as e:
            logger.error(f"Failed to insert notional transfer record: {e}")
            return False

    def migrate(self) -> Tuple[int, int]:
        """Main migration logic"""
        total_processed = 0
        total_skipped = 0

        try:
            with get_source_connection() as tfrs_conn:
                with get_destination_connection() as lcfs_conn:
                    tfrs_cursor = tfrs_conn.cursor()
                    lcfs_cursor = lcfs_conn.cursor()

                    # Load mappings
                    self.load_mappings(lcfs_cursor)

                    # Find all LCFS compliance reports that have TFRS legacy_id
                    logger.info(
                        "Retrieving LCFS compliance_report with legacy_id != null"
                    )
                    tfrs_ids = self.get_lcfs_reports_with_legacy_ids(lcfs_cursor)
                    logger.info(f"Found {len(tfrs_ids)} reports to process")

                    # Track processed chains to avoid duplicates
                    # Each chain (identified by root_id) should only be processed once
                    processed_chains = set()

                    # For each TFRS compliance_report ID, follow the chain approach
                    for tfrs_id in tfrs_ids:
                        logger.info(f"Processing TFRS compliance_report.id = {tfrs_id}")

                        # Find the root_report_id
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

                        # Gather the chain in ascending order
                        chain_ids = self.get_report_chain(tfrs_cursor, root_id)
                        if not chain_ids:
                            logger.warning(f"Chain empty for root={root_id}? skipping.")
                            total_skipped += 1
                            continue

                        # Keep the old version's schedule_a data in memory for diffs
                        previous_records = {}

                        for idx, chain_tfrs_id in enumerate(chain_ids):
                            logger.info(f"TFRS #{chain_tfrs_id} (chain idx={idx})")

                            # Fetch current TFRS schedule_a records
                            current_records = self.get_schedule_a_records(
                                tfrs_cursor, chain_tfrs_id
                            )

                            # Find the matching LCFS compliance_report
                            lcfs_cr_id = self.get_lcfs_compliance_report_id(
                                lcfs_cursor, chain_tfrs_id
                            )
                            if not lcfs_cr_id:
                                logger.warning(
                                    f"TFRS #{chain_tfrs_id} not found in LCFS? Skipping diff, just storing previousRecords."
                                )
                                previous_records = current_records
                                continue

                            # Compare old vs new for each record in currentRecords
                            # Records are now keyed by content_key, not rec_id
                            for content_key, new_data in current_records.items():
                                if content_key not in previous_records:
                                    # Wasn't in old => CREATE
                                    if self.insert_version_row(
                                        lcfs_cursor, lcfs_cr_id, new_data, "CREATE", content_key
                                    ):
                                        total_processed += 1
                                else:
                                    # Existed => check if changed
                                    old_data = previous_records[content_key]
                                    if self.is_record_changed(old_data, new_data):
                                        if self.insert_version_row(
                                            lcfs_cursor, lcfs_cr_id, new_data, "UPDATE", content_key
                                        ):
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
                                    total_processed += 1

                            # Update previousRecords for the next version
                            previous_records = current_records

                    # Commit all changes
                    lcfs_conn.commit()
                    logger.info(
                        f"Successfully committed {total_processed} notional transfer records"
                    )

                    tfrs_cursor.close()
                    lcfs_cursor.close()

        except Exception as e:
            logger.error(f"Migration failed: {e}")
            raise

        return total_processed, total_skipped


def main():
    setup_logging()
    logger.info("Starting Notional Transfer Migration")

    migrator = NotionalTransferMigrator()

    try:
        processed, skipped = migrator.migrate()
        logger.info(
            f"Migration completed successfully. Processed: {processed}, Skipped: {skipped}"
        )
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
