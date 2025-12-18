#!/usr/bin/env python3
"""
Allocation Agreement Migration Script

Migrates allocation agreement data from TFRS to LCFS database.
This script replicates the functionality of allocation_agreement.groovy
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


class AllocationAgreementMigrator:
    def __init__(self):
        self.record_uuid_map: Dict[str, str] = {}  # Maps content_key to group_uuid
        self.legacy_to_lcfs_mapping: Dict[int, int] = {}
        self.responsibility_to_transaction_type_cache: Dict[str, int] = {}
        self.fuel_type_name_to_id_cache: Dict[str, int] = {}

        # Constants
        self.GASOLINE_CATEGORY_ID = 1
        self.DIESEL_CATEGORY_ID = 2

    def load_mappings(self, lcfs_cursor):
        """Load legacy ID to LCFS compliance_report_id mappings"""
        logger.info("Loading legacy ID to LCFS compliance_report_id mappings")
        self.legacy_to_lcfs_mapping = build_legacy_mapping(lcfs_cursor)
        logger.info(f"Loaded {len(self.legacy_to_lcfs_mapping)} legacy mappings")

    def get_transaction_type_id(self, lcfs_cursor, responsibility: str) -> int:
        """Returns the allocation transaction type ID for a given responsibility with caching"""
        if responsibility in self.responsibility_to_transaction_type_cache:
            return self.responsibility_to_transaction_type_cache[responsibility]

        query = """
            SELECT allocation_transaction_type_id 
            FROM allocation_transaction_type 
            WHERE type = %s
        """

        try:
            lcfs_cursor.execute(query, (responsibility,))
            result = lcfs_cursor.fetchone()
            if result:
                type_id = result[0]
                self.responsibility_to_transaction_type_cache[responsibility] = type_id
                return type_id
            else:
                logger.warning(
                    f"No transaction type found for responsibility: {responsibility}; using default 1."
                )
                return 1
        except Exception as e:
            logger.error(f"Error looking up transaction type for {responsibility}: {e}")
            return 1

    def get_fuel_type_id(self, lcfs_cursor, fuel_type: str) -> int:
        """Returns the fuel type ID for a given fuel type string with caching"""
        if fuel_type in self.fuel_type_name_to_id_cache:
            return self.fuel_type_name_to_id_cache[fuel_type]

        query = """
            SELECT fuel_type_id 
            FROM fuel_type 
            WHERE fuel_type = %s
        """

        try:
            lcfs_cursor.execute(query, (fuel_type,))
            result = lcfs_cursor.fetchone()
            if result:
                type_id = result[0]
                self.fuel_type_name_to_id_cache[fuel_type] = type_id
                return type_id
            else:
                logger.warning(f"No fuel type found for: {fuel_type}; using default 1.")
                return 1
        except Exception as e:
            logger.error(f"Error looking up fuel type for {fuel_type}: {e}")
            return 1

    def get_current_version(self, lcfs_cursor, group_uuid: str) -> int:
        """Get current highest version for a group UUID"""
        query = """
            SELECT version
            FROM allocation_agreement
            WHERE group_uuid = %s
            ORDER BY version DESC
            LIMIT 1
        """
        lcfs_cursor.execute(query, (group_uuid,))
        result = lcfs_cursor.fetchone()
        return result[0] if result else -1

    def get_lcfs_reports_with_legacy_ids(self, lcfs_cursor) -> List[int]:
        """Get all LCFS compliance reports with legacy IDs"""
        query = """
            SELECT compliance_report_id, legacy_id
            FROM compliance_report
            WHERE legacy_id IS NOT NULL
        """
        lcfs_cursor.execute(query)
        return [row[1] for row in lcfs_cursor.fetchall()]  # Return legacy_ids

    def get_lcfs_reports_with_group_uuid_info(
        self, lcfs_cursor
    ) -> List[Tuple[int, int, int, str]]:
        """Get LCFS compliance reports with their group UUID for proper versioning scope.

        Returns reports grouped by compliance_report_group_uuid to ensure separate report chains
        are processed independently, even if they're for the same organization/period.
        """
        query = """
        SELECT cr.legacy_id, cr.organization_id, cr.compliance_period_id, cr.compliance_report_group_uuid
        FROM compliance_report cr
        WHERE cr.legacy_id IS NOT NULL
        ORDER BY cr.compliance_report_group_uuid, cr.version
        """

        lcfs_cursor.execute(query)
        return [(row[0], row[1], row[2], row[3]) for row in lcfs_cursor.fetchall()]

    def get_exclusion_agreement_id_for_report(self, tfrs_cursor, tfrs_id: int) -> Optional[int]:
        """
        Get the exclusion_agreement_id for a given TFRS compliance report.

        IMPORTANT: We only use the direct exclusion_agreement_id from this report.
        We do NOT use a fallback to find allocation agreements from other reports,
        because different reports in the same org/period can be separate chains
        with different allocation agreements.

        Returns the exclusion_agreement_id or None if not found.
        """
        # Check if this report has its own exclusion_agreement_id
        query_direct = """
            SELECT exclusion_agreement_id
            FROM compliance_report
            WHERE id = %s
        """
        tfrs_cursor.execute(query_direct, (tfrs_id,))
        result = tfrs_cursor.fetchone()

        if not result:
            return None

        direct_exclusion_id = result[0]

        if direct_exclusion_id:
            logger.debug(f"Report {tfrs_id} has exclusion_agreement_id: {direct_exclusion_id}")
            return direct_exclusion_id

        # No exclusion_agreement_id means this report has no allocation agreements
        # Do NOT fallback to other reports - they may be different chains
        logger.debug(f"Report {tfrs_id} has no exclusion_agreement_id")
        return None

    def get_allocation_agreement_records(self, tfrs_cursor, tfrs_id: int) -> List[Dict]:
        """Get allocation agreement records for a given TFRS compliance report.

        This uses a two-step approach to avoid cross-join issues:
        1. First determine the correct exclusion_agreement_id
        2. Then fetch all records for that specific agreement
        """
        # Step 1: Get the correct exclusion_agreement_id
        exclusion_agreement_id = self.get_exclusion_agreement_id_for_report(tfrs_cursor, tfrs_id)

        if not exclusion_agreement_id:
            logger.debug(f"No exclusion_agreement_id found for TFRS report {tfrs_id}")
            return []

        # Step 2: Fetch all records for this specific exclusion agreement
        query = """
            SELECT
                crear.id AS agreement_record_id,
                CASE WHEN tt.the_type = 'Purchased' THEN 'Allocated from' ELSE 'Allocated to' END AS responsibility,
                aft.name AS fuel_type,
                aft.id AS fuel_type_id,
                crear.transaction_partner,
                crear.postal_address,
                crear.quantity,
                uom.name AS units,
                crear.quantity_not_sold,
                tt.id AS transaction_type_id
            FROM compliance_report_exclusion_agreement_record crear
            INNER JOIN transaction_type tt
                ON crear.transaction_type_id = tt.id
            INNER JOIN approved_fuel_type aft
                ON crear.fuel_type_id = aft.id
            INNER JOIN unit_of_measure uom
                ON aft.unit_of_measure_id = uom.id
            WHERE crear.exclusion_agreement_id = %s
            ORDER BY crear.id
        """

        tfrs_cursor.execute(query, (exclusion_agreement_id,))
        records = []

        for row in tfrs_cursor.fetchall():
            records.append(
                {
                    "agreement_record_id": row[0],
                    "responsibility": row[1],
                    "fuel_type": row[2],
                    "fuel_type_id": row[3],
                    "transaction_partner": row[4],
                    "postal_address": row[5],
                    "quantity": row[6],
                    "units": row[7],
                    "quantity_not_sold": row[8],
                    "transaction_type_id": row[9],
                }
            )

        return records

    def determine_fuel_category_id(self, fuel_type_string: str) -> Optional[int]:
        """Determine fuel category ID based on fuel type string"""
        if not fuel_type_string:
            return None

        fuel_type_lower = fuel_type_string.lower()
        if "gasoline" in fuel_type_lower:
            return self.GASOLINE_CATEGORY_ID
        elif "diesel" in fuel_type_lower:
            return self.DIESEL_CATEGORY_ID
        else:
            logger.warning(
                f"Could not determine fuel category for fuel type: {fuel_type_string}. Setting fuel_category_id to NULL."
            )
            return None

    def make_content_key(self, record_data: Dict) -> str:
        """Create a content-based key for comparing records across reports.

        In TFRS, supplemental reports create NEW agreement_record IDs even when
        the data is identical or just updated. We need to compare by content,
        not by record ID, to maintain proper versioning across supplementals.

        Key fields: transaction_partner, responsibility (Allocated from/to), fuel_type
        Quantity is excluded so that quantity changes create new versions, not new records.
        """
        transaction_partner = safe_str(record_data.get("transaction_partner", "")).strip().lower()
        responsibility = safe_str(record_data.get("responsibility", "")).strip().lower()
        fuel_type = safe_str(record_data.get("fuel_type", "")).strip().lower()

        return f"{transaction_partner}|{responsibility}|{fuel_type}"

    def insert_version_row(
        self, lcfs_cursor, lcfs_cr_id: int, row_data: Dict, action: str
    ) -> bool:
        """Inserts a new row into allocation_agreement with proper versioning.

        Uses a content-based key (partner|responsibility|fuel_type) for group_uuid mapping.
        This ensures the same logical allocation agreement gets the same group_uuid
        across supplemental reports, even when TFRS creates new record IDs.
        """
        try:
            record_id = row_data["agreement_record_id"]

            # Use content-based key for versioning (like notional_transfers and other_uses)
            # This handles TFRS creating new record IDs for supplemental reports
            content_key = self.make_content_key(row_data)
            group_uuid = self.record_uuid_map.get(content_key)
            if not group_uuid:
                group_uuid = str(uuid.uuid4())
                self.record_uuid_map[content_key] = group_uuid
                logger.debug(
                    f"Created new group_uuid {group_uuid} for content_key: {content_key}"
                )

            # Retrieve current highest version for this group_uuid
            current_ver = self.get_current_version(lcfs_cursor, group_uuid)
            next_ver = 0 if current_ver < 0 else current_ver + 1

            # Map source fields to destination fields
            alloc_transaction_type_id = self.get_transaction_type_id(
                lcfs_cursor, row_data["responsibility"]
            )
            fuel_type_id = self.get_fuel_type_id(lcfs_cursor, row_data["fuel_type"])
            quantity = safe_int(row_data.get("quantity", 0))
            quantity_not_sold = safe_int(row_data.get("quantity_not_sold", 0))
            transaction_partner = safe_str(row_data.get("transaction_partner", ""))
            postal_address = safe_str(row_data.get("postal_address", ""))
            units = safe_str(row_data.get("units", ""))
            fuel_type_string = row_data.get("fuel_type", "")

            # Determine Fuel Category ID
            fuel_category_id = self.determine_fuel_category_id(fuel_type_string)

            # Insert the record
            insert_sql = """
                INSERT INTO allocation_agreement(
                  compliance_report_id,
                  transaction_partner,
                  postal_address,
                  quantity,
                  quantity_not_sold,
                  units,
                  allocation_transaction_type_id,
                  fuel_type_id,
                  fuel_category_id,
                  group_uuid,
                  version,
                  action_type,
                  create_user,
                  update_user
                ) VALUES(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::actiontypeenum, %s, %s)
            """

            params = [
                lcfs_cr_id,
                transaction_partner,
                postal_address,
                quantity,
                quantity_not_sold,
                units,
                alloc_transaction_type_id,
                fuel_type_id,
                fuel_category_id,
                group_uuid,
                next_ver,
                action,
                "ETL",
                "ETL",
            ]

            lcfs_cursor.execute(insert_sql, params)
            logger.info(
                f"Inserted allocation_agreement row: recordId={record_id}, action={action}, groupUuid={group_uuid}, version={next_ver}"
            )
            return True

        except Exception as e:
            logger.error(f"Failed to insert allocation agreement record: {e}")
            return False

    def migrate(self) -> Tuple[int, int]:
        """Main migration logic"""
        total_inserted = 0
        total_skipped = 0

        try:
            with get_source_connection() as tfrs_conn:
                with get_destination_connection() as lcfs_conn:
                    tfrs_cursor = tfrs_conn.cursor()
                    lcfs_cursor = lcfs_conn.cursor()

                    # Load mappings
                    self.load_mappings(lcfs_cursor)

                    # Get all LCFS compliance reports with legacy IDs and their group UUID info
                    logger.info(
                        "Retrieving LCFS compliance reports with legacy_id != NULL"
                    )
                    reports_data = self.get_lcfs_reports_with_group_uuid_info(
                        lcfs_cursor
                    )
                    logger.info(f"Found {len(reports_data)} reports to process")

                    # Group reports by compliance_report_group_uuid to process each chain independently
                    # This is critical because the same organization/period can have multiple independent chains
                    report_groups = {}
                    for report_data in reports_data:
                        tfrs_id, org_id, period_id, group_uuid = report_data
                        group_key = group_uuid
                        if group_key not in report_groups:
                            report_groups[group_key] = []
                        report_groups[group_key].append(tfrs_id)

                    # Process each compliance report chain with its own record_uuid_map
                    for group_uuid, tfrs_ids in report_groups.items():
                        self.record_uuid_map = {}  # Reset for each compliance report chain
                        previous_record_ids = set()  # Track record IDs from previous report for DELETE detection
                        logger.info(
                            f"Processing report chain {group_uuid} with {len(tfrs_ids)} reports"
                        )

                        for tfrs_id in tfrs_ids:
                            logger.info(
                                f"Processing TFRS compliance_report.id = {tfrs_id}"
                            )

                            # Look up the original LCFS compliance_report record by legacy_id
                            lcfs_cr_id = self.legacy_to_lcfs_mapping.get(tfrs_id)
                            if not lcfs_cr_id:
                                logger.warning(
                                    f"No LCFS compliance_report found for TFRS legacy id {tfrs_id}; skipping allocation agreement processing."
                                )
                                total_skipped += 1
                                continue

                            # Check if this is a supplemental report that needs special handling
                            logger.debug(
                                f"Checking if TFRS report {tfrs_id} is a supplemental report that needs allocation inheritance"
                            )

                            # Retrieve allocation agreement records from source for the given TFRS report
                            allocation_records = self.get_allocation_agreement_records(
                                tfrs_cursor, tfrs_id
                            )

                            current_record_ids = set()
                            current_records_by_id = {}

                            if allocation_records:
                                # Process each allocation agreement record
                                for record_data in allocation_records:
                                    rec_id = record_data["agreement_record_id"]
                                    current_record_ids.add(rec_id)
                                    current_records_by_id[rec_id] = record_data
                                    logger.info(
                                        f"Found source allocation record ID: {rec_id} for TFRS report ID: {tfrs_id}. Preparing for LCFS insert."
                                    )

                                    # Insert each allocation agreement record with versioning
                                    if self.insert_version_row(
                                        lcfs_cursor, lcfs_cr_id, record_data, "CREATE"
                                    ):
                                        total_inserted += 1
                                    else:
                                        total_skipped += 1

                            # CRITICAL: Handle records that were DELETED in this supplemental
                            # Find records that existed in the previous report but are NOT in this report
                            # IMPORTANT: Only run DELETE detection if this report has actual records
                            # A report with no records should not trigger mass deletion
                            if previous_record_ids and current_record_ids:
                                deleted_record_ids = previous_record_ids - current_record_ids
                                for deleted_rec_id in deleted_record_ids:
                                    # We need to get the record UUID from our map
                                    content_key = str(deleted_rec_id)
                                    if content_key in self.record_uuid_map:
                                        logger.info(f"Record {deleted_rec_id} removed in supplemental, inserting DELETE")
                                        # Create a minimal record_data for the DELETE
                                        delete_record_data = {
                                            "agreement_record_id": deleted_rec_id,
                                            "responsibility": "Purchased",  # Default, will be looked up
                                            "fuel_type": "Other",  # Default
                                            "fuel_category": "Diesel",  # Default
                                            "postal_address": "",
                                            "ci_of_fuel": 0,
                                            "quantity": 0,
                                            "units": "L",
                                            "quantity_not_sold": 0,
                                        }
                                        if self.insert_version_row(
                                            lcfs_cursor, lcfs_cr_id, delete_record_data, "DELETE"
                                        ):
                                            total_inserted += 1
                            elif not current_record_ids and previous_record_ids:
                                logger.warning(
                                    f"No records found for TFRS #{tfrs_id} - skipping DELETE detection"
                                )

                            # Update previous record IDs for next iteration
                            # Only update if we have records - preserves state for DELETE detection
                            if current_record_ids:
                                previous_record_ids = current_record_ids

                    # Commit all changes
                    lcfs_conn.commit()
                    logger.info(
                        f"Successfully committed {total_inserted} allocation agreement records"
                    )

                    tfrs_cursor.close()
                    lcfs_cursor.close()

        except Exception as e:
            logger.error(f"Migration failed: {e}")
            raise

        return total_inserted, total_skipped


def main():
    setup_logging()
    logger.info("Starting Allocation Agreement Migration")

    migrator = AllocationAgreementMigrator()

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
