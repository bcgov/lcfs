#!/usr/bin/env python3
"""
Orphaned Allocation Agreement Migration Script

Migrates orphaned allocation agreements from TFRS to LCFS database.
This script replicates the functionality of orphaned_allocation_agreement.groovy

Overview:
1. Identify TFRS compliance reports marked as 'exclusion reports' that do not have a
   corresponding 'main' compliance report in the same compliance period/organization.
2. For each orphaned TFRS exclusion report:
    a. Check if an LCFS compliance report with legacy_id = TFRS report ID already exists.
    b. If not, create a new minimal LCFS compliance report (type='Supplemental', status='Draft').
    c. Fetch the allocation agreement records linked to the TFRS exclusion_agreement_id.
    d. Insert these records into LCFS allocation_agreement, linked to the new LCFS report.
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
from core.utils import setup_logging, safe_decimal, safe_int, safe_str

logger = logging.getLogger(__name__)


class OrphanedAllocationAgreementMigrator:
    def __init__(self):
        self.record_uuid_map: Dict[int, str] = {}
        self.responsibility_to_transaction_type_cache: Dict[str, int] = {}
        self.tfrs_fuel_name_to_lcfs_fuel_type_cache: Dict[str, int] = {}

        # Constants
        self.GASOLINE_CATEGORY_ID = 1
        self.DIESEL_CATEGORY_ID = 2

    def find_orphaned_exclusion_reports(self, tfrs_cursor) -> List[Dict]:
        """Find TFRS exclusion reports without a sibling report"""
        query = """
            /*
             * Find exclusion reports that are truly standalone (orphaned):
             * 1. Has exclusion_agreement_id (is an exclusion report)
             * 2. Does NOT have ANY main compliance report in the same organization/period
             *    (regardless of root_report_id, since the allocation_agreement migration
             *    uses a fallback that finds exclusion data by org/period without root_report_id)
             * 3. Excludes reports that are part of combo compliance+exclusion reports
             * If multiple exclusion supplementals exist in a chain, pick the latest one.
             *
             * IMPORTANT: The migrate_allocation_agreements.py script uses a fallback mechanism
             * that copies exclusion agreement data from ANY exclusion report in the same
             * org/period to main compliance reports. So we only create standalone reports
             * for exclusion reports where NO main compliance report exists in the same org/period.
             */
            WITH exclusion_candidates AS (
                SELECT
                    cr_excl.id AS tfrs_exclusion_report_id,
                    cr_excl.root_report_id,
                    cr_excl.traversal,
                    cr_excl.organization_id AS tfrs_organization_id,
                    cr_excl.compliance_period_id AS tfrs_compliance_period_id,
                    cr_excl.exclusion_agreement_id,
                    ws.director_status_id AS tfrs_director_status
                FROM compliance_report cr_excl
                JOIN compliance_report_workflow_state ws ON cr_excl.status_id = ws.id
                WHERE cr_excl.exclusion_agreement_id IS NOT NULL
                -- Check if this is truly a standalone exclusion report:
                -- No main compliance report exists in the same org/period at all
                -- (not just the same root_report_id chain)
                AND NOT EXISTS (
                    SELECT 1
                    FROM compliance_report cr_other
                    WHERE cr_other.organization_id = cr_excl.organization_id
                      AND cr_other.compliance_period_id = cr_excl.compliance_period_id
                      AND cr_other.exclusion_agreement_id IS NULL  -- Has main compliance data
                )
            ), latest_exclusion_per_chain AS (
                SELECT ec.*
                FROM exclusion_candidates ec
                JOIN (
                    SELECT root_report_id, MAX(traversal) AS max_traversal
                    FROM exclusion_candidates
                    GROUP BY root_report_id
                ) mx
                ON ec.root_report_id = mx.root_report_id AND ec.traversal = mx.max_traversal
            )
            SELECT
                tfrs_exclusion_report_id,
                tfrs_organization_id,
                tfrs_compliance_period_id,
                exclusion_agreement_id,
                tfrs_director_status
            FROM latest_exclusion_per_chain;
        """

        tfrs_cursor.execute(query)
        reports = []

        for row in tfrs_cursor.fetchall():
            reports.append(
                {
                    "tfrs_exclusion_report_id": row[0],
                    "tfrs_organization_id": row[1],
                    "tfrs_compliance_period_id": row[2],
                    "exclusion_agreement_id": row[3],
                    "tfrs_director_status": row[4],
                }
            )

        return reports

    def check_lcfs_report_exists(self, lcfs_cursor, legacy_id: int) -> bool:
        """Check if an LCFS report with a specific legacy_id exists"""
        query = "SELECT 1 FROM compliance_report WHERE legacy_id = %s LIMIT 1"
        lcfs_cursor.execute(query, (legacy_id,))
        return lcfs_cursor.fetchone() is not None

    def get_tfrs_org_name(self, tfrs_cursor, org_id: int) -> Optional[str]:
        """Get TFRS organization name based on TFRS organization ID"""
        query = "SELECT name FROM organization WHERE id = %s LIMIT 1"
        tfrs_cursor.execute(query, (org_id,))
        result = tfrs_cursor.fetchone()
        return result[0] if result else None

    def get_lcfs_org_id(self, lcfs_cursor, org_name: str) -> Optional[int]:
        """Get LCFS organization ID based on organization name"""
        if not org_name:
            logger.error(
                "Cannot map LCFS organization ID from null TFRS organization name."
            )
            return None

        query = "SELECT organization_id FROM organization WHERE name = %s LIMIT 1"
        lcfs_cursor.execute(query, (org_name,))
        result = lcfs_cursor.fetchone()

        if not result:
            logger.error(
                f"Could not find LCFS organization mapped to TFRS organization name: {org_name}"
            )
            return None

        return result[0]

    def get_tfrs_period_desc(self, tfrs_cursor, period_id: int) -> Optional[str]:
        """Get TFRS compliance period description based on TFRS period ID"""
        query = "SELECT description FROM compliance_period WHERE id = %s LIMIT 1"
        tfrs_cursor.execute(query, (period_id,))
        result = tfrs_cursor.fetchone()
        return result[0] if result else None

    def get_lcfs_period_id(self, lcfs_cursor, period_desc: str) -> Optional[int]:
        """Get LCFS compliance period ID based on description"""
        if not period_desc:
            logger.error(
                "Cannot map LCFS compliance period ID from null TFRS period description."
            )
            return None

        query = "SELECT compliance_period_id FROM compliance_period WHERE description = %s LIMIT 1"
        lcfs_cursor.execute(query, (period_desc,))
        result = lcfs_cursor.fetchone()

        if not result:
            logger.error(
                f"Could not find LCFS compliance period mapped to TFRS description: {period_desc}"
            )
            return None

        return result[0]

    def get_lcfs_report_status_id(self, lcfs_cursor, status_name: str) -> Optional[int]:
        """Get LCFS report status ID by name"""
        query = "SELECT compliance_report_status_id FROM compliance_report_status WHERE status = %s::compliancereportstatusenum LIMIT 1"
        lcfs_cursor.execute(query, (status_name,))
        result = lcfs_cursor.fetchone()

        if not result:
            logger.error(
                f"Could not find LCFS compliance report status ID for status: {status_name}"
            )
            return None

        return result[0]

    def create_lcfs_placeholder_report(
        self,
        lcfs_cursor,
        lcfs_org_id: int,
        lcfs_period_id: int,
        status_id: int,
        reporting_frequency: str,
        tfrs_legacy_id: int,
    ) -> Optional[int]:
        """Create a minimal LCFS Compliance Report record, default summary, and org snapshot"""
        group_uuid = str(uuid.uuid4())
        version = 0  # Initial version

        try:
            # 1. Create Compliance Report
            insert_report_sql = """
                INSERT INTO compliance_report (
                    organization_id, compliance_period_id, current_status_id, reporting_frequency,
                    compliance_report_group_uuid, version, legacy_id, create_user, update_user,
                    nickname
                ) VALUES (%s, %s, %s, %s::reportingfrequency, %s, %s, %s, 'ETL', 'ETL', %s)
                RETURNING compliance_report_id;
            """

            params = [
                lcfs_org_id,
                lcfs_period_id,
                status_id,
                reporting_frequency,
                group_uuid,
                version,
                tfrs_legacy_id,
                "Original Report",
            ]

            lcfs_cursor.execute(insert_report_sql, params)
            result = lcfs_cursor.fetchone()

            if not result:
                logger.error(
                    f"Failed to create placeholder LCFS compliance report for TFRS legacy ID: {tfrs_legacy_id}"
                )
                return None

            new_lcfs_report_id = result[0]
            logger.info(
                f"Created placeholder LCFS compliance report ID: {new_lcfs_report_id} for TFRS legacy ID: {tfrs_legacy_id}"
            )

            # 2. Create Default Summary Record
            self.create_default_summary(lcfs_cursor, new_lcfs_report_id)

            # 3. Create Organization Snapshot
            self.create_organization_snapshot(
                lcfs_cursor, new_lcfs_report_id, lcfs_org_id
            )

            return new_lcfs_report_id

        except Exception as e:
            logger.error(
                f"Exception creating placeholder LCFS compliance report for TFRS legacy ID: {tfrs_legacy_id}: {e}"
            )
            return None

    def create_default_summary(self, lcfs_cursor, report_id: int):
        """Create default summary record for a compliance report"""
        try:
            # Corrected to have 60 values total as per the Groovy script
            insert_summary_sql = """
                INSERT INTO compliance_report_summary (
                    compliance_report_id, quarter, is_locked,
                    line_1_fossil_derived_base_fuel_gasoline, line_1_fossil_derived_base_fuel_diesel, line_1_fossil_derived_base_fuel_jet_fuel,
                    line_2_eligible_renewable_fuel_supplied_gasoline, line_2_eligible_renewable_fuel_supplied_diesel, line_2_eligible_renewable_fuel_supplied_jet_fuel,
                    line_3_total_tracked_fuel_supplied_gasoline, line_3_total_tracked_fuel_supplied_diesel, line_3_total_tracked_fuel_supplied_jet_fuel,
                    line_4_eligible_renewable_fuel_required_gasoline, line_4_eligible_renewable_fuel_required_diesel, line_4_eligible_renewable_fuel_required_jet_fuel,
                    line_5_net_notionally_transferred_gasoline, line_5_net_notionally_transferred_diesel, line_5_net_notionally_transferred_jet_fuel,
                    line_6_renewable_fuel_retained_gasoline, line_6_renewable_fuel_retained_diesel, line_6_renewable_fuel_retained_jet_fuel,
                    line_7_previously_retained_gasoline, line_7_previously_retained_diesel, line_7_previously_retained_jet_fuel,
                    line_8_obligation_deferred_gasoline, line_8_obligation_deferred_diesel, line_8_obligation_deferred_jet_fuel,
                    line_9_obligation_added_gasoline, line_9_obligation_added_diesel, line_9_obligation_added_jet_fuel,
                    line_10_net_renewable_fuel_supplied_gasoline, line_10_net_renewable_fuel_supplied_diesel, line_10_net_renewable_fuel_supplied_jet_fuel,
                    line_11_non_compliance_penalty_gasoline, line_11_non_compliance_penalty_diesel, line_11_non_compliance_penalty_jet_fuel,
                    line_12_low_carbon_fuel_required, line_13_low_carbon_fuel_supplied, line_14_low_carbon_fuel_surplus,
                    line_15_banked_units_used, line_16_banked_units_remaining, line_17_non_banked_units_used,
                    line_18_units_to_be_banked, line_19_units_to_be_exported, line_20_surplus_deficit_units, line_21_surplus_deficit_ratio,
                    line_22_compliance_units_issued,
                    line_11_fossil_derived_base_fuel_gasoline, line_11_fossil_derived_base_fuel_diesel, line_11_fossil_derived_base_fuel_jet_fuel, line_11_fossil_derived_base_fuel_total,
                    line_21_non_compliance_penalty_payable, total_non_compliance_penalty_payable,
                    create_user, update_user,
                    early_issuance_credits_q1, early_issuance_credits_q2, early_issuance_credits_q3, early_issuance_credits_q4
                ) VALUES (
                    %s, null, false,
                    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                    null, null, null,
                    0.0, 0.0, 0.0,
                    0.0, 0.0, 0.0,
                    0.0, 0.0, 0.0, 0.0,
                    0.0,
                    0.0, 0.0, 0.0, 0.0,
                    0.0, 0.0,
                    'ETL', 'ETL',
                    null, null, null, null
                )
            """

            lcfs_cursor.execute(insert_summary_sql, (report_id,))
            logger.info(
                f"Created default summary record for LCFS report ID: {report_id}"
            )

        except Exception as e:
            logger.error(
                f"Exception creating default summary for LCFS report ID: {report_id}: {e}"
            )

    def create_organization_snapshot(self, lcfs_cursor, report_id: int, org_id: int):
        """Create organization snapshot for a compliance report"""
        try:
            # Fetch org details
            query = """
                SELECT
                    org.name,
                    org.operating_name,
                    org.email,
                    org.phone,
                    org.records_address,
                    addr.street_address,
                    addr.address_other,
                    addr.city,
                    addr.province_state,
                    addr.country,
                    addr."postalCode_zipCode"
                FROM organization org
                LEFT JOIN organization_address addr ON org.organization_address_id = addr.organization_address_id
                WHERE org.organization_id = %s
            """

            lcfs_cursor.execute(query, (org_id,))
            result = lcfs_cursor.fetchone()

            if result:
                name, operating_name, email, phone, records_addr = result[:5]
                street, other, city, province, country, postal = result[5:]

                # Construct addresses
                address_parts = [
                    part
                    for part in [street, other, city, province, country, postal]
                    if part
                ]
                full_address = ", ".join(address_parts)
                service_address = full_address
                head_office_address = full_address

                # Insert snapshot
                insert_snapshot_sql = """
                    INSERT INTO compliance_report_organization_snapshot (
                        compliance_report_id, name, operating_name, email, phone,
                        service_address, head_office_address, records_address, is_edited,
                        create_user, update_user
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'ETL', 'ETL')
                """

                params = [
                    report_id,
                    name or "",
                    operating_name or "",
                    email or "",
                    phone or "",
                    service_address or "",
                    head_office_address or "",
                    records_addr or "",
                    False,
                ]

                lcfs_cursor.execute(insert_snapshot_sql, params)
                logger.info(
                    f"Created organization snapshot for LCFS report ID: {report_id}"
                )
            else:
                logger.warning(
                    f"Could not find LCFS organization details for ID: {org_id} to create snapshot."
                )

        except Exception as e:
            logger.error(
                f"Exception creating organization snapshot for LCFS report ID: {report_id}: {e}"
            )

    def get_lcfs_transaction_type_id(
        self, lcfs_cursor, responsibility: str
    ) -> Optional[int]:
        """Get LCFS Transaction Type ID from TFRS Responsibility string"""
        if responsibility in self.responsibility_to_transaction_type_cache:
            return self.responsibility_to_transaction_type_cache[responsibility]

        query = "SELECT allocation_transaction_type_id FROM allocation_transaction_type WHERE type = %s"
        lcfs_cursor.execute(query, (responsibility,))
        result = lcfs_cursor.fetchone()

        if result:
            type_id = result[0]
            self.responsibility_to_transaction_type_cache[responsibility] = type_id
            return type_id
        else:
            logger.warning(
                f"No LCFS transaction type found for responsibility: {responsibility}; returning null."
            )
            return None

    def get_lcfs_fuel_type_id_by_name(
        self, lcfs_cursor, tfrs_fuel_type_name: str
    ) -> Optional[int]:
        """Get LCFS Fuel Type ID from TFRS Fuel Type Name"""
        if not tfrs_fuel_type_name:
            logger.error("Cannot map LCFS fuel type ID from null TFRS fuel type name.")
            return None

        if tfrs_fuel_type_name in self.tfrs_fuel_name_to_lcfs_fuel_type_cache:
            return self.tfrs_fuel_name_to_lcfs_fuel_type_cache[tfrs_fuel_type_name]

        query = "SELECT fuel_type_id FROM fuel_type WHERE fuel_type = %s"
        lcfs_cursor.execute(query, (tfrs_fuel_type_name,))
        result = lcfs_cursor.fetchone()

        if result:
            lcfs_id = result[0]
            self.tfrs_fuel_name_to_lcfs_fuel_type_cache[tfrs_fuel_type_name] = lcfs_id
            return lcfs_id
        else:
            logger.warning(
                f"No LCFS fuel type found mapped for TFRS fuel type name: {tfrs_fuel_type_name}; returning null."
            )
            return None

    def get_allocation_records_by_agreement_id(
        self, tfrs_cursor, agreement_id: int
    ) -> List[Dict]:
        """Get allocation agreement records directly via exclusion_agreement_id"""
        query = """
            SELECT
                crear.id AS agreement_record_id,
                CASE WHEN tt.the_type = 'Purchased' THEN 'Allocated from' ELSE 'Allocated to' END AS responsibility,
                aft.name AS fuel_type,
                aft.id AS tfrs_fuel_type_id,
                crear.transaction_partner,
                crear.postal_address,
                crear.quantity,
                uom.name AS units,
                crear.quantity_not_sold,
                tt.id AS transaction_type_id
            FROM compliance_report_exclusion_agreement_record crear
            INNER JOIN transaction_type tt ON crear.transaction_type_id = tt.id
            INNER JOIN approved_fuel_type aft ON crear.fuel_type_id = aft.id
            INNER JOIN unit_of_measure uom ON aft.unit_of_measure_id = uom.id
            WHERE crear.exclusion_agreement_id = %s
            ORDER BY crear.id;
        """

        tfrs_cursor.execute(query, (agreement_id,))
        records = []

        for row in tfrs_cursor.fetchall():
            records.append(
                {
                    "agreement_record_id": row[0],
                    "responsibility": row[1],
                    "fuel_type": row[2],
                    "tfrs_fuel_type_id": row[3],
                    "transaction_partner": row[4],
                    "postal_address": row[5],
                    "quantity": row[6],
                    "units": row[7],
                    "quantity_not_sold": row[8],
                    "transaction_type_id": row[9],
                }
            )

        return records

    def get_current_allocation_version(self, lcfs_cursor, group_uuid: str) -> int:
        """Get current highest version for allocation agreement group UUID"""
        query = "SELECT version FROM allocation_agreement WHERE group_uuid = %s ORDER BY version DESC LIMIT 1"
        lcfs_cursor.execute(query, (group_uuid,))
        result = lcfs_cursor.fetchone()
        return result[0] if result else -1

    def insert_allocation_agreement_version_row(
        self, lcfs_cursor, lcfs_cr_id: int, row_data: Dict, action: str
    ) -> bool:
        """Inserts a new row into LCFS allocation_agreement with proper versioning"""
        try:
            record_id = row_data["agreement_record_id"]

            # Retrieve or create a stable group_uuid
            group_uuid = self.record_uuid_map.get(record_id)
            if not group_uuid:
                group_uuid = str(uuid.uuid4())
                self.record_uuid_map[record_id] = group_uuid

            # Retrieve current highest version
            current_ver = self.get_current_allocation_version(lcfs_cursor, group_uuid)
            next_ver = 0 if current_ver < 0 else current_ver + 1

            # Map source fields to LCFS fields
            lcfs_alloc_transaction_type_id = self.get_lcfs_transaction_type_id(
                lcfs_cursor, row_data["responsibility"]
            )
            lcfs_fuel_type_id = self.get_lcfs_fuel_type_id_by_name(
                lcfs_cursor, row_data["fuel_type"]
            )
            quantity = safe_int(row_data.get("quantity", 0))
            quantity_not_sold = safe_int(row_data.get("quantity_not_sold", 0))
            transaction_partner = safe_str(row_data.get("transaction_partner", ""))
            postal_address = safe_str(row_data.get("postal_address", ""))
            units = safe_str(row_data.get("units", ""))
            fuel_type_string = row_data.get("fuel_type", "")

            # Determine LCFS Fuel Category ID based on TFRS fuel type name
            fuel_category_id = None
            if fuel_type_string:
                fuel_type_lower = fuel_type_string.lower()
                if "gasoline" in fuel_type_lower:
                    fuel_category_id = self.GASOLINE_CATEGORY_ID
                elif "diesel" in fuel_type_lower:
                    fuel_category_id = self.DIESEL_CATEGORY_ID
                else:
                    logger.warning(
                        f"Could not determine LCFS fuel category for TFRS fuel type: {fuel_type_string}. Setting fuel_category_id to NULL."
                    )

            # Validation
            if lcfs_alloc_transaction_type_id is None or lcfs_fuel_type_id is None:
                logger.error(
                    f"Skipping insert for TFRS record ID {record_id} due to missing LCFS mapping (TransactionType: {lcfs_alloc_transaction_type_id}, FuelType: {lcfs_fuel_type_id})"
                )
                return False

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
                lcfs_alloc_transaction_type_id,
                lcfs_fuel_type_id,
                fuel_category_id,
                group_uuid,
                next_ver,
                action,
                "ETL",
                "ETL",
            ]

            lcfs_cursor.execute(insert_sql, params)
            logger.info(
                f"Inserted LCFS allocation_agreement row: TFRS_recordId={record_id}, LCFS_CR_ID={lcfs_cr_id}, action={action}, groupUuid={group_uuid}, version={next_ver}"
            )
            return True

        except Exception as e:
            logger.error(f"Failed to insert allocation agreement record: {e}")
            return False

    def migrate(self) -> Tuple[int, int, int]:
        """Main migration logic"""
        orphaned_count = 0
        processed_count = 0
        skipped_count = 0

        try:
            with get_source_connection() as tfrs_conn:
                with get_destination_connection() as lcfs_conn:
                    tfrs_cursor = tfrs_conn.cursor()
                    lcfs_cursor = lcfs_conn.cursor()

                    # Pre-fetch necessary data
                    default_reporting_frequency = "ANNUAL"
                    logger.info(
                        f"Using default Reporting Frequency: {default_reporting_frequency}"
                    )

                    # Find orphaned TFRS exclusion reports
                    logger.info("Querying TFRS for orphaned exclusion reports...")
                    orphaned_reports = self.find_orphaned_exclusion_reports(tfrs_cursor)
                    orphaned_count = len(orphaned_reports)
                    logger.info(
                        f"Found {orphaned_count} orphaned TFRS exclusion reports"
                    )

                    for report in orphaned_reports:
                        tfrs_exclusion_report_id = report["tfrs_exclusion_report_id"]
                        tfrs_org_id = report["tfrs_organization_id"]
                        tfrs_period_id = report["tfrs_compliance_period_id"]
                        tfrs_exclusion_agreement_id = report["exclusion_agreement_id"]
                        tfrs_director_status = report["tfrs_director_status"]

                        logger.info(
                            f"Processing orphaned TFRS exclusion report ID: {tfrs_exclusion_report_id} (Org: {tfrs_org_id}, Period: {tfrs_period_id}, Agreement: {tfrs_exclusion_agreement_id}, DirectorStatus: {tfrs_director_status})"
                        )

                        # Check if already migrated
                        if self.check_lcfs_report_exists(
                            lcfs_cursor, tfrs_exclusion_report_id
                        ):
                            logger.warning(
                                f"LCFS report with legacy_id {tfrs_exclusion_report_id} already exists. Skipping."
                            )
                            skipped_count += 1
                            continue

                        # Get TFRS Org Name for Mapping
                        tfrs_org_name = self.get_tfrs_org_name(tfrs_cursor, tfrs_org_id)

                        # Get TFRS Period Description for Mapping
                        tfrs_period_desc = self.get_tfrs_period_desc(
                            tfrs_cursor, tfrs_period_id
                        )

                        # Determine Target LCFS Status
                        target_lcfs_status_name = "Draft"  # Default to Draft
                        if tfrs_director_status == "Accepted":
                            target_lcfs_status_name = "Assessed"
                        elif tfrs_director_status == "Rejected":
                            target_lcfs_status_name = "Rejected"

                        logger.info(
                            f"Mapping TFRS Director Status '{tfrs_director_status}' to LCFS Status '{target_lcfs_status_name}'"
                        )
                        lcfs_status_id = self.get_lcfs_report_status_id(
                            lcfs_cursor, target_lcfs_status_name
                        )

                        if lcfs_status_id is None:
                            logger.error(
                                f"Failed to find LCFS Status ID for '{target_lcfs_status_name}'. Skipping creation."
                            )
                            skipped_count += 1
                            continue

                        # Create placeholder LCFS report
                        logger.info(
                            f"Creating placeholder LCFS report with Status ID: {lcfs_status_id}..."
                        )
                        lcfs_org_id = self.get_lcfs_org_id(lcfs_cursor, tfrs_org_name)
                        lcfs_period_id = self.get_lcfs_period_id(
                            lcfs_cursor, tfrs_period_desc
                        )

                        if lcfs_org_id is None or lcfs_period_id is None:
                            logger.error(
                                f"Failed to map TFRS Org/Period IDs for TFRS report {tfrs_exclusion_report_id}. Skipping creation and associated records."
                            )
                            skipped_count += 1
                            continue

                        new_lcfs_report_id = self.create_lcfs_placeholder_report(
                            lcfs_cursor,
                            lcfs_org_id,
                            lcfs_period_id,
                            lcfs_status_id,
                            default_reporting_frequency,
                            tfrs_exclusion_report_id,
                        )

                        if new_lcfs_report_id is None:
                            logger.error(
                                f"Failed to create placeholder LCFS report for TFRS ID {tfrs_exclusion_report_id}. Skipping associated records."
                            )
                            skipped_count += 1
                            continue

                        # Fetch associated allocation records from TFRS
                        logger.info(
                            f"Fetching allocation records from TFRS for agreement ID: {tfrs_exclusion_agreement_id}"
                        )
                        allocation_records = (
                            self.get_allocation_records_by_agreement_id(
                                tfrs_cursor, tfrs_exclusion_agreement_id
                            )
                        )

                        if not allocation_records:
                            logger.warning(
                                f"No allocation records found in TFRS for agreement ID: {tfrs_exclusion_agreement_id}"
                            )
                        else:
                            # Insert allocation agreement records
                            for record_data in allocation_records:
                                self.insert_allocation_agreement_version_row(
                                    lcfs_cursor,
                                    new_lcfs_report_id,
                                    record_data,
                                    "CREATE",
                                )

                        processed_count += 1

                    # Commit all changes
                    lcfs_conn.commit()
                    logger.info(
                        f"Successfully committed all orphaned allocation agreement migrations"
                    )

                    tfrs_cursor.close()
                    lcfs_cursor.close()

        except Exception as e:
            logger.error(f"Migration failed: {e}")
            raise

        return orphaned_count, processed_count, skipped_count


def main():
    setup_logging()
    logger.info("Starting Orphaned Allocation Agreement Migration")

    migrator = OrphanedAllocationAgreementMigrator()

    try:
        orphaned, processed, skipped = migrator.migrate()
        logger.info(
            f"Migration completed. Found {orphaned} orphaned reports. Processed: {processed}, Skipped: {skipped}"
        )
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
