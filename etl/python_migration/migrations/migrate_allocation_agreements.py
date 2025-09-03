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
        self.record_uuid_map: Dict[int, str] = {}
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

    def get_lcfs_reports_with_org_period_info(
        self, lcfs_cursor
    ) -> List[Tuple[int, int, int]]:
        """Get LCFS compliance reports with their organization and period info for proper versioning scope"""
        query = """
        SELECT cr.legacy_id, cr.organization_id, cr.compliance_period_id
        FROM compliance_report cr
        WHERE cr.legacy_id IS NOT NULL
        ORDER BY cr.organization_id, cr.compliance_period_id, cr.legacy_id
        """

        lcfs_cursor.execute(query)
        return [(row[0], row[1], row[2]) for row in lcfs_cursor.fetchall()]

    def get_allocation_agreement_records(self, tfrs_cursor, tfrs_id: int) -> List[Dict]:
        """Get allocation agreement records for a given TFRS compliance report"""
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
            FROM compliance_report legacy_cr
            -- First, try to join to the report's own exclusion agreement if it exists (combo reports)
            LEFT JOIN compliance_report_exclusion_agreement crea_direct
                ON legacy_cr.exclusion_agreement_id = crea_direct.id
            LEFT JOIN compliance_report_exclusion_agreement_record crear_direct
                ON crea_direct.id = crear_direct.exclusion_agreement_id
            -- If not found, join to the latest exclusion report in the same organization/period
            LEFT JOIN (
                SELECT DISTINCT ON (exclusion_cr.organization_id, exclusion_cr.compliance_period_id)
                    exclusion_cr.exclusion_agreement_id,
                    exclusion_cr.organization_id,
                    exclusion_cr.compliance_period_id
                FROM compliance_report exclusion_cr
                WHERE exclusion_cr.exclusion_agreement_id IS NOT NULL
                ORDER BY exclusion_cr.organization_id, exclusion_cr.compliance_period_id, exclusion_cr.traversal DESC
            ) latest_exclusion 
                ON latest_exclusion.organization_id = legacy_cr.organization_id
               AND latest_exclusion.compliance_period_id = legacy_cr.compliance_period_id
               AND crea_direct.id IS NULL  -- Only use if direct exclusion not found
            LEFT JOIN compliance_report_exclusion_agreement crea_latest
                ON latest_exclusion.exclusion_agreement_id = crea_latest.id
            LEFT JOIN compliance_report_exclusion_agreement_record crear_latest
                ON crea_latest.id = crear_latest.exclusion_agreement_id
            -- Coalesce the results to use direct first, then latest
            CROSS JOIN (
                SELECT 
                    COALESCE(crear_direct.id, crear_latest.id) AS id,
                    COALESCE(crear_direct.transaction_partner, crear_latest.transaction_partner) AS transaction_partner,
                    COALESCE(crear_direct.postal_address, crear_latest.postal_address) AS postal_address,
                    COALESCE(crear_direct.quantity, crear_latest.quantity) AS quantity,
                    COALESCE(crear_direct.quantity_not_sold, crear_latest.quantity_not_sold) AS quantity_not_sold,
                    COALESCE(crear_direct.transaction_type_id, crear_latest.transaction_type_id) AS transaction_type_id,
                    COALESCE(crear_direct.fuel_type_id, crear_latest.fuel_type_id) AS fuel_type_id
            ) crear
            -- Standard joins for details
            INNER JOIN transaction_type tt
                ON crear.transaction_type_id = tt.id
            INNER JOIN approved_fuel_type aft
                ON crear.fuel_type_id = aft.id
            INNER JOIN unit_of_measure uom
                ON aft.unit_of_measure_id = uom.id
            WHERE
                legacy_cr.id = %s
                AND crear.id IS NOT NULL  -- Ensure we have allocation data
            ORDER BY
                crear.id;
        """

        tfrs_cursor.execute(query, (tfrs_id,))
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

    def generate_logical_record_key(self, record_data: Dict) -> str:
        """Generate a logical key for allocation agreement versioning based on business data"""
        # Use key business fields that define a unique logical allocation agreement
        # NOTE: Quantity is excluded so that quantity changes create new versions, not new records
        transaction_partner = record_data.get("transaction_partner", "").strip()
        responsibility = record_data.get("responsibility", "").strip()
        fuel_type = record_data.get("fuel_type", "").strip()

        # Create a logical key from the business identifiers (excluding quantity)
        logical_key = f"{transaction_partner}|{responsibility}|{fuel_type}"
        return logical_key

    def insert_version_row(
        self, lcfs_cursor, lcfs_cr_id: int, row_data: Dict, action: str
    ) -> bool:
        """Inserts a new row into allocation_agreement with proper versioning"""
        try:
            record_id = row_data["agreement_record_id"]

            # Generate logical key for this allocation agreement
            logical_key = self.generate_logical_record_key(row_data)

            # Retrieve or create a stable group_uuid based on logical key
            group_uuid = self.record_uuid_map.get(logical_key)
            if not group_uuid:
                group_uuid = str(uuid.uuid4())
                self.record_uuid_map[logical_key] = group_uuid
                logger.debug(
                    f"Created new group_uuid {group_uuid} for logical key: {logical_key}"
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

                    # Get all LCFS compliance reports with legacy IDs and their org/period info
                    logger.info(
                        "Retrieving LCFS compliance reports with legacy_id != NULL"
                    )
                    reports_data = self.get_lcfs_reports_with_org_period_info(
                        lcfs_cursor
                    )
                    logger.info(f"Found {len(reports_data)} reports to process")

                    # Group reports by organization + period to ensure proper versioning scope
                    report_groups = {}
                    for report_data in reports_data:
                        tfrs_id, org_id, period_id = report_data
                        group_key = (org_id, period_id)
                        if group_key not in report_groups:
                            report_groups[group_key] = []
                        report_groups[group_key].append(tfrs_id)

                    # Process each organization/period group with its own record_uuid_map
                    for (org_id, period_id), tfrs_ids in report_groups.items():
                        self.record_uuid_map = (
                            {}
                        )  # Reset for each organization + period combination
                        logger.info(
                            f"Processing organization {org_id}, period {period_id} with {len(tfrs_ids)} reports"
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

                            if not allocation_records:
                                logger.warning(
                                    f"No allocation agreement records found in source for TFRS report ID: {tfrs_id} (or cr.exclusion_agreement_id was NULL)."
                                )
                                continue

                            # Process each allocation agreement record
                            for record_data in allocation_records:
                                rec_id = record_data["agreement_record_id"]
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
