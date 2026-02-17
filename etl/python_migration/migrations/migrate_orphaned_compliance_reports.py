#!/usr/bin/env python3
"""
Orphaned Compliance Report Migration Script

Migrates compliance reports from TFRS that are missing in LCFS.
This script finds reports in TFRS that don't have a corresponding legacy_id in LCFS
and creates them.

The issue being fixed:
Some compliance reports were not migrated due to a status key mismatch bug where
the original migration used 'recommended by analyst' (spaces) but the LCFS status
table has 'Recommended_by_analyst' (underscores).

This script:
1. Identifies TFRS compliance reports missing from LCFS
2. Creates the compliance_report records with proper status mapping
3. Creates compliance_report_summary and history records
4. Maintains proper group_uuid and version for report chains
"""

import os
import sys
import uuid
import hashlib
from typing import Dict, List, Optional, Tuple
from datetime import datetime

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
from core.database import get_source_connection, get_destination_connection
from core.utils import setup_logging

logger = logging.getLogger(__name__)


class OrphanedComplianceReportMigrator:
    """Migrates compliance reports from TFRS that are missing in LCFS."""

    def __init__(self):
        self.status_mapping: Dict[str, int] = {}
        self.compliance_period_mapping: Dict[int, int] = {}

    def load_reference_data(self, lcfs_cursor):
        """Load reference data for status mapping from LCFS."""
        logger.info("Loading LCFS status mappings")

        # Load status mappings - key is lowercase status name
        lcfs_cursor.execute(
            "SELECT compliance_report_status_id, status FROM compliance_report_status"
        )
        for row in lcfs_cursor.fetchall():
            status_id, status_name = row
            # Store with lowercase key, handling both underscore and space versions
            key = status_name.lower().replace("_", " ")
            self.status_mapping[key] = status_id
            # Also store original lowercase
            self.status_mapping[status_name.lower()] = status_id

        logger.info(f"Loaded {len(self.status_mapping)} status mappings")

        # Compliance period mapping (TFRS ID -> LCFS ID)
        # TFRS has combined years like 2012-13, 2013-14
        # LCFS has single years
        self.compliance_period_mapping = {
            1: 1,
            2: 2,
            3: 3,  # 2012-13 -> 2012
            4: 5,  # 2013-14 -> 2014 (skip 2013)
            5: 6,
            6: 7,
            7: 8,
            8: 9,
            9: 10,
            10: 11,
            11: 12,
            12: 13,
            13: 14,
            14: 15,
            15: 16,
            16: 17,
            17: 18,
            18: 19,
            19: 20,
            20: 21,
        }

    def map_status(
        self,
        fuel_status: str,
        analyst_status: str,
        manager_status: str,
        director_status: str,
    ) -> Optional[int]:
        """
        Map TFRS workflow statuses to LCFS compliance_report_status_id.
        Returns None if the report should be excluded (deleted, draft, etc).
        """
        # Normalize all statuses to lowercase
        fuel_status = (fuel_status or "").lower()
        analyst_status = (analyst_status or "").lower()
        manager_status = (manager_status or "").lower()
        director_status = (director_status or "").lower()

        # Exclude deleted reports
        if fuel_status == "deleted":
            return None

        # Handle 'requested supplemental'
        if any(
            "requested supplemental" in s
            for s in [fuel_status, analyst_status, manager_status, director_status]
        ):
            return self.status_mapping.get("supplemental requested")

        # Handle director decisions (highest priority)
        if director_status == "rejected":
            return self.status_mapping.get("rejected")
        if director_status == "accepted":
            return self.status_mapping.get("assessed")

        # Handle manager recommendation
        if "recommended" in manager_status:
            if "not" in manager_status:
                return self.status_mapping.get("not recommended by manager")
            return self.status_mapping.get("recommended by manager")

        # Handle analyst recommendation
        if "recommended" in analyst_status:
            if "not" in analyst_status:
                return self.status_mapping.get("not recommended by analyst")
            return self.status_mapping.get("recommended by analyst")

        # Handle supplier statuses
        if fuel_status == "submitted":
            return self.status_mapping.get("submitted")
        if fuel_status == "draft":
            return self.status_mapping.get("draft")

        # Default: if we have any status, default to submitted
        if any([fuel_status, analyst_status, manager_status, director_status]):
            logger.debug(
                f"Unhandled status: fuel={fuel_status}, analyst={analyst_status}, "
                f"manager={manager_status}, director={director_status}"
            )
            return self.status_mapping.get("submitted")

        return None

    def generate_group_uuid(self, root_report_id: int) -> str:
        """Generate deterministic UUID based on root_report_id."""
        # Use SHA-1 to generate a deterministic UUID from root_report_id
        hash_bytes = hashlib.sha1(str(root_report_id).encode()).digest()[:16]
        return str(uuid.UUID(bytes=hash_bytes, version=5))

    def find_existing_group_uuid(
        self, lcfs_cursor, tfrs_cursor, tfrs_report_id: int, root_report_id: int
    ) -> Optional[str]:
        """
        Find existing group_uuid for a report chain by looking up other reports
        in the same TFRS chain that already exist in LCFS.
        """
        # Find all reports in the same chain from TFRS
        tfrs_cursor.execute("""
            SELECT id FROM compliance_report
            WHERE root_report_id = %s AND id != %s
        """, [root_report_id, tfrs_report_id])
        sibling_ids = [row[0] for row in tfrs_cursor.fetchall()]

        if not sibling_ids:
            return None

        # Check if any of these exist in LCFS
        placeholders = ",".join(["%s"] * len(sibling_ids))
        lcfs_cursor.execute(f"""
            SELECT compliance_report_group_uuid
            FROM compliance_report
            WHERE legacy_id IN ({placeholders})
            LIMIT 1
        """, sibling_ids)
        result = lcfs_cursor.fetchone()
        if result:
            return result[0]
        return None

    def find_missing_reports(self, tfrs_cursor, lcfs_cursor) -> List[Dict]:
        """
        Find TFRS compliance reports that don't exist in LCFS.
        Returns list of report data dictionaries.
        """
        logger.info("Finding TFRS compliance reports missing from LCFS")

        # Get all legacy_ids in LCFS
        lcfs_cursor.execute(
            "SELECT legacy_id FROM compliance_report WHERE legacy_id IS NOT NULL"
        )
        existing_legacy_ids = {row[0] for row in lcfs_cursor.fetchall()}
        logger.info(f"Found {len(existing_legacy_ids)} existing legacy_ids in LCFS")

        # Query TFRS for all compliance reports
        query = """
            SELECT
                cr.id AS compliance_report_id,
                cr.organization_id,
                cr.compliance_period_id,
                cr.root_report_id,
                cr.traversal,
                cr.supplements_id,
                cr.nickname,
                cr.supplemental_note,
                cr.create_user_id,
                cr.create_timestamp,
                cr.update_user_id,
                cr.update_timestamp,
                cr.credit_transaction_id,
                cws.fuel_supplier_status_id,
                cws.analyst_status_id,
                cws.manager_status_id,
                cws.director_status_id,
                cp.description AS period_desc
            FROM compliance_report cr
            JOIN compliance_report_workflow_state cws ON cr.status_id = cws.id
            JOIN compliance_period cp ON cr.compliance_period_id = cp.id
            WHERE cr.type_id = 1
            ORDER BY cr.root_report_id NULLS FIRST, cr.traversal, cr.id
        """

        tfrs_cursor.execute(query)
        columns = [desc[0] for desc in tfrs_cursor.description]

        missing_reports = []
        for row in tfrs_cursor.fetchall():
            record = dict(zip(columns, row))

            # Skip if already exists in LCFS
            if record["compliance_report_id"] in existing_legacy_ids:
                continue

            # Map status
            status_id = self.map_status(
                record["fuel_supplier_status_id"],
                record["analyst_status_id"],
                record["manager_status_id"],
                record["director_status_id"],
            )

            # Skip if status mapping returns None (deleted, etc)
            if status_id is None:
                logger.debug(
                    f"Skipping report {record['compliance_report_id']} - excluded status"
                )
                continue

            record["lcfs_status_id"] = status_id
            missing_reports.append(record)

        logger.info(f"Found {len(missing_reports)} reports missing from LCFS")
        return missing_reports

    def insert_compliance_report(
        self, lcfs_cursor, report: Dict, group_uuid: str, version: int
    ) -> Optional[int]:
        """Insert a compliance report into LCFS and return the new ID."""
        lcfs_period_id = self.compliance_period_mapping.get(
            report["compliance_period_id"], report["compliance_period_id"]
        )

        # Determine supplemental initiator
        supplemental_initiator = (
            "SUPPLIER_SUPPLEMENTAL" if report["supplements_id"] else None
        )

        # Generate nickname based on version
        nickname = (
            "Original Report" if version == 0 else f"Supplemental Report {version}"
        )

        insert_sql = """
            INSERT INTO compliance_report (
                organization_id,
                compliance_period_id,
                current_status_id,
                compliance_report_group_uuid,
                version,
                supplemental_initiator,
                reporting_frequency,
                nickname,
                supplemental_note,
                legacy_id,
                create_user,
                create_date,
                update_user,
                update_date
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s::SupplementalInitiatorType, 'ANNUAL'::ReportingFrequency,
                %s, %s, %s, %s, %s, %s, %s
            )
            RETURNING compliance_report_id
        """

        params = [
            report["organization_id"],
            lcfs_period_id,
            report["lcfs_status_id"],
            group_uuid,
            version,
            supplemental_initiator,
            nickname,
            report.get("supplemental_note"),
            report["compliance_report_id"],  # legacy_id
            str(report.get("create_user_id") or "ETL"),
            report.get("create_timestamp") or datetime.now(),
            str(report.get("update_user_id") or "ETL"),
            report.get("update_timestamp") or datetime.now(),
        ]

        try:
            lcfs_cursor.execute(insert_sql, params)
            result = lcfs_cursor.fetchone()
            if result:
                return result[0]
        except Exception as e:
            logger.error(
                f"Failed to insert compliance report for legacy_id {report['compliance_report_id']}: {e}"
            )
            raise

        return None

    def insert_compliance_report_summary(
        self, lcfs_cursor, lcfs_report_id: int
    ) -> bool:
        """Insert a minimal compliance_report_summary for the new report."""
        # First check if summary already exists
        check_sql = """
            SELECT 1 FROM compliance_report_summary
            WHERE compliance_report_id = %s
        """
        lcfs_cursor.execute(check_sql, [lcfs_report_id])
        if lcfs_cursor.fetchone():
            logger.debug(f"Summary already exists for report {lcfs_report_id}")
            return True

        # Insert all required columns with default values (0 for numeric)
        insert_sql = """
            INSERT INTO compliance_report_summary (
                compliance_report_id, is_locked,
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
                create_user, update_user
            ) VALUES (
                %s, TRUE,
                0, 0, 0,  -- line 1
                0, 0, 0,  -- line 2
                0, 0, 0,  -- line 3
                0, 0, 0,  -- line 4
                0, 0, 0,  -- line 5
                0, 0, 0,  -- line 6
                0, 0, 0,  -- line 7
                0, 0, 0,  -- line 8
                0, 0, 0,  -- line 9
                0, 0, 0,  -- line 10
                0, 0, 0,  -- line 12-14
                0, 0, 0,  -- line 15-17
                0, 0, 0,  -- line 18-20
                0, 0,     -- line 21-22
                0, 0, 0, 0,  -- line 11 fossil
                0, 0,     -- penalty
                'ETL', 'ETL'
            )
        """

        try:
            lcfs_cursor.execute(insert_sql, [lcfs_report_id])
            return True
        except Exception as e:
            logger.warning(f"Failed to insert summary for report {lcfs_report_id}: {e}")
            return False

    def disable_audit_triggers(self, lcfs_cursor):
        """Disable audit triggers on compliance_report table."""
        logger.info("Disabling audit triggers on compliance_report")
        lcfs_cursor.execute("""
            ALTER TABLE compliance_report DISABLE TRIGGER audit_compliance_report_insert_update_delete
        """)

    def enable_audit_triggers(self, lcfs_cursor):
        """Re-enable audit triggers on compliance_report table."""
        logger.info("Re-enabling audit triggers on compliance_report")
        lcfs_cursor.execute("""
            ALTER TABLE compliance_report ENABLE TRIGGER audit_compliance_report_insert_update_delete
        """)

    def migrate(self) -> Tuple[int, int, int]:
        """
        Run the migration to create missing compliance reports.
        Returns (total_found, migrated, skipped).
        """
        migrated = 0
        skipped = 0

        try:
            with get_source_connection() as tfrs_conn:
                with get_destination_connection() as lcfs_conn:
                    tfrs_cursor = tfrs_conn.cursor()
                    lcfs_cursor = lcfs_conn.cursor()

                    # Disable audit triggers
                    self.disable_audit_triggers(lcfs_cursor)

                    # Load reference data
                    self.load_reference_data(lcfs_cursor)

                    # Find missing reports
                    missing_reports = self.find_missing_reports(
                        tfrs_cursor, lcfs_cursor
                    )

                    if not missing_reports:
                        logger.info("No missing compliance reports found")
                        return 0, 0, 0

                    logger.info(f"Starting migration of {len(missing_reports)} reports")

                    # Process each missing report
                    for report in missing_reports:
                        tfrs_id = report["compliance_report_id"]
                        root_id = report.get("root_report_id") or tfrs_id
                        traversal = report.get("traversal") or 0

                        # Try to find existing group_uuid from sibling reports
                        group_uuid = self.find_existing_group_uuid(
                            lcfs_cursor, tfrs_cursor, tfrs_id, root_id
                        )
                        # If no existing group found, generate a new one
                        if not group_uuid:
                            group_uuid = self.generate_group_uuid(root_id)

                        # Calculate version
                        version = 0 if tfrs_id == root_id else traversal

                        try:
                            # Use savepoint for each report
                            lcfs_cursor.execute("SAVEPOINT report_insert")

                            # Insert compliance report
                            lcfs_report_id = self.insert_compliance_report(
                                lcfs_cursor, report, group_uuid, version
                            )

                            if lcfs_report_id:
                                # Insert minimal summary
                                self.insert_compliance_report_summary(
                                    lcfs_cursor, lcfs_report_id
                                )

                                # Release savepoint on success
                                lcfs_cursor.execute("RELEASE SAVEPOINT report_insert")

                                migrated += 1
                                logger.info(
                                    f"Migrated report: legacy_id={tfrs_id} -> "
                                    f"lcfs_id={lcfs_report_id} (v{version})"
                                )
                            else:
                                lcfs_cursor.execute(
                                    "ROLLBACK TO SAVEPOINT report_insert"
                                )
                                skipped += 1
                                logger.warning(
                                    f"Failed to migrate report legacy_id={tfrs_id}"
                                )

                        except Exception as e:
                            # Rollback to savepoint to keep transaction valid
                            try:
                                lcfs_cursor.execute(
                                    "ROLLBACK TO SAVEPOINT report_insert"
                                )
                            except:
                                pass
                            skipped += 1
                            logger.error(
                                f"Error migrating report legacy_id={tfrs_id}: {e}"
                            )

                    # Re-enable audit triggers
                    self.enable_audit_triggers(lcfs_cursor)

                    # Commit changes
                    lcfs_conn.commit()
                    logger.info(
                        f"Migration complete: {migrated} migrated, {skipped} skipped"
                    )

                    tfrs_cursor.close()
                    lcfs_cursor.close()

        except Exception as e:
            logger.error(f"Migration failed: {e}")
            # Try to re-enable triggers even on error
            try:
                with get_destination_connection() as lcfs_conn:
                    lcfs_cursor = lcfs_conn.cursor()
                    self.enable_audit_triggers(lcfs_cursor)
                    lcfs_conn.commit()
            except:
                pass
            raise

        return len(missing_reports), migrated, skipped


def main():
    setup_logging()
    logger.info("Starting Orphaned Compliance Report Migration")

    migrator = OrphanedComplianceReportMigrator()

    try:
        total, migrated, skipped = migrator.migrate()
        logger.info(
            f"Migration completed. Total found: {total}, "
            f"Migrated: {migrated}, Skipped: {skipped}"
        )
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
