#!/usr/bin/env python3
"""
Compliance Report History Migration Script

Migrates compliance report history data from TFRS to LCFS database.
This script replicates the functionality of compliance_report_history.groovy
"""

import os
import sys

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
import sys
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from core.database import get_source_connection, get_destination_connection
from core.utils import setup_logging, build_legacy_mapping

logger = logging.getLogger(__name__)


class ComplianceReportHistoryMigrator:
    def __init__(self):
        self.legacy_mapping: Dict[int, int] = {}
        self.status_mapping: Dict[str, int] = {}
        self.status_id_to_name: Dict[int, str] = {}

    def load_reference_data(self, lcfs_cursor):
        """Load reference data for status mapping"""
        logger.info("Loading reference data for status mapping")

        # Load legacy ID mappings
        self.legacy_mapping = build_legacy_mapping(lcfs_cursor, "compliance_report")
        logger.info(f"Loaded {len(self.legacy_mapping)} legacy mappings")

        # Load status mappings
        query = (
            "SELECT compliance_report_status_id, status FROM compliance_report_status"
        )
        lcfs_cursor.execute(query)

        for row in lcfs_cursor.fetchall():
            status_id, status_name = row
            status_lower = status_name.lower()
            self.status_mapping[status_lower] = status_id
            self.status_id_to_name[status_id] = status_lower

        logger.info(f"Loaded {len(self.status_mapping)} status mappings")

    def map_final_status(
        self,
        fuel_status: str,
        analyst_status: str,
        manager_status: str,
        director_status: str,
    ) -> Optional[int]:
        """
        Map workflow statuses to a final status ID.

        TFRS to LCFS status mapping:
        - Submitted → Submitted
        - Reviewed and recommended acceptance (analyst) → Recommended by analyst
        - Reviewed and recommended acceptance (manager) → Recommended by manager
        - Reviewed and recommended rejection (analyst) → Not recommended by analyst
        - Reviewed and recommended rejection (manager) → Not recommended by manager
        - Accepted → Assessed
        - Supplemental requested → Supplemental requested
        - Rejected → Rejected
        """

        # Normalize all statuses to lower-case
        fuel_status = fuel_status.lower() if fuel_status else ""
        analyst_status = analyst_status.lower() if analyst_status else ""
        manager_status = manager_status.lower() if manager_status else ""
        director_status = director_status.lower() if director_status else ""

        # Handle "Requested Supplemental" - map to supplemental_requested instead of skipping
        if (
            "requested supplemental" in fuel_status
            or "requested supplemental" in analyst_status
            or "requested supplemental" in manager_status
            or "requested supplemental" in director_status
        ):
            logger.debug(
                "Record marked as 'Requested Supplemental'; mapping to supplemental_requested."
            )
            return self.status_mapping.get("supplemental_requested")

        # Exclude records with a draft status
        if fuel_status == "draft":
            logger.debug("Record marked as 'Draft'; skipping history record.")
            return None

        # Handle director rejection
        if director_status == "rejected":
            return self.status_mapping.get("rejected")

        # Handle director acceptance (highest priority)
        if director_status == "accepted":
            return self.status_mapping.get("assessed")

        # Handle manager recommendation/rejection
        # Check for "recommended" or variations like "reviewed and recommended acceptance"
        if "recommended" in manager_status:
            if "rejection" in manager_status or "not recommended" in manager_status:
                return self.status_mapping.get("not_recommended_by_manager")
            else:
                return self.status_mapping.get("recommended_by_manager")

        # Handle analyst recommendation/rejection
        if "recommended" in analyst_status:
            if "rejection" in analyst_status or "not recommended" in analyst_status:
                return self.status_mapping.get("not_recommended_by_analyst")
            else:
                return self.status_mapping.get("recommended_by_analyst")

        # Default to submitted for fuel supplier submitted status
        if fuel_status == "submitted":
            return self.status_mapping.get("submitted")

        # If none of the above matched but we have some status, default to submitted
        if fuel_status or analyst_status or manager_status or director_status:
            logger.debug(
                f"Unhandled status combination: fuel={fuel_status}, analyst={analyst_status}, "
                f"manager={manager_status}, director={director_status}; defaulting to submitted."
            )
            return self.status_mapping.get("submitted")

        return None

    def truncate_destination_table(self, lcfs_cursor):
        """Truncate the destination compliance_report_history table for clean reload"""
        logger.info("Truncating destination compliance_report_history table")
        lcfs_cursor.execute("TRUNCATE TABLE compliance_report_history CASCADE")

    def fetch_source_history_records(self, tfrs_cursor) -> List[Dict]:
        """Fetch history records from source database"""
        source_query = """
            SELECT
                crh.id AS history_id,
                crh.compliance_report_id,
                crh.create_timestamp,
                crh.update_timestamp,
                crh.create_user_id,
                crh.status_id AS original_status_id,
                crh.update_user_id,
                cws.analyst_status_id,
                cws.director_status_id,
                cws.fuel_supplier_status_id,
                cws.manager_status_id
            FROM compliance_report_history crh
            JOIN compliance_report_workflow_state cws ON crh.status_id = cws.id
            ORDER BY crh.compliance_report_id, crh.create_timestamp;
        """

        logger.info("Fetching source history records from TFRS")
        tfrs_cursor.execute(source_query)
        records = []

        for row in tfrs_cursor.fetchall():
            records.append(
                {
                    "history_id": row[0],
                    "compliance_report_id": row[1],
                    "create_timestamp": row[2],
                    "update_timestamp": row[3],
                    "create_user_id": row[4],
                    "original_status_id": row[5],
                    "update_user_id": row[6],
                    "analyst_status_id": row[7],
                    "director_status_id": row[8],
                    "fuel_supplier_status_id": row[9],
                    "manager_status_id": row[10],
                }
            )

        logger.info(f"Fetched {len(records)} source history records")
        return records

    def insert_history_record(self, lcfs_cursor, record_data: Dict) -> bool:
        """Insert a single history record into destination"""
        insert_sql = """
            INSERT INTO compliance_report_history (
                compliance_report_id,
                status_id,
                user_profile_id,
                create_user,
                create_date,
                update_user,
                update_date
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """

        try:
            params = [
                record_data["destination_report_id"],
                record_data["final_status_id"],
                record_data["create_user_id"],
                str(record_data["create_user_id"]),
                record_data["create_timestamp"],
                (
                    str(record_data["update_user_id"])
                    if record_data["update_user_id"]
                    else None
                ),
                record_data["update_timestamp"],
            ]

            lcfs_cursor.execute(insert_sql, params)
            return True

        except Exception as e:
            logger.error(f"Failed to insert history record: {e}")
            return False

    def migrate(self) -> Tuple[int, int]:
        """Main migration logic"""
        records_processed = 0
        records_skipped = 0

        try:
            with get_source_connection() as tfrs_conn:
                with get_destination_connection() as lcfs_conn:
                    tfrs_cursor = tfrs_conn.cursor()
                    lcfs_cursor = lcfs_conn.cursor()

                    # Load reference data
                    self.load_reference_data(lcfs_cursor)

                    # Truncate destination table for clean reload
                    self.truncate_destination_table(lcfs_cursor)

                    # Fetch source records
                    source_records = self.fetch_source_history_records(tfrs_cursor)

                    logger.info("Starting history migration process")
                    for record in source_records:
                        # Get the TFRS compliance report id from the source history record
                        legacy_id = record["compliance_report_id"]

                        # Look up the corresponding LCFS compliance_report_id using the legacy mapping
                        destination_report_id = self.legacy_mapping.get(legacy_id)
                        if destination_report_id is None:
                            logger.warning(
                                f"No matching LCFS compliance report found for legacy id: {legacy_id}"
                            )
                            records_skipped += 1
                            continue

                        # Retrieve the workflow status values
                        analyst_status = record["analyst_status_id"] or ""
                        director_status = record["director_status_id"] or ""
                        fuel_status = record["fuel_supplier_status_id"] or ""
                        manager_status = record["manager_status_id"] or ""

                        # Recalculate the final status using the updated mapping function
                        final_status_id = self.map_final_status(
                            fuel_status, analyst_status, manager_status, director_status
                        )
                        if final_status_id is None:
                            logger.debug(
                                f"Skipping history record for legacy id: {legacy_id} due to unmapped status"
                            )
                            records_skipped += 1
                            continue

                        # Prepare record for insertion
                        record_data = {
                            "destination_report_id": destination_report_id,
                            "final_status_id": final_status_id,
                            "create_user_id": record["create_user_id"],
                            "update_user_id": record["update_user_id"],
                            "create_timestamp": record["create_timestamp"],
                            "update_timestamp": record["update_timestamp"],
                        }

                        if self.insert_history_record(lcfs_cursor, record_data):
                            records_processed += 1
                        else:
                            records_skipped += 1

                    # Commit all changes
                    lcfs_conn.commit()
                    logger.info(
                        f"Successfully committed {records_processed} history records"
                    )

                    tfrs_cursor.close()
                    lcfs_cursor.close()

        except Exception as e:
            logger.error(f"Migration failed: {e}")
            raise

        return records_processed, records_skipped


def main():
    setup_logging()
    logger.info("Starting Compliance Report History Migration")

    migrator = ComplianceReportHistoryMigrator()

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
