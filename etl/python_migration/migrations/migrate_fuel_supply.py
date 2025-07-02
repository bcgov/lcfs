#!/usr/bin/env python3
"""
Fuel Supply Migration Script

Migrates fuel supply (Schedule B) data from TFRS to LCFS database.
This script replicates the functionality of fuel_supply.groovy
"""

import os
import sys

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import logging
import sys
from decimal import Decimal
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime

from core.database import get_source_connection, get_destination_connection
from core.utils import (
    setup_logging,
    safe_decimal,
    safe_int,
    safe_str,
    build_legacy_mapping,
)

logger = logging.getLogger(__name__)


class FuelSupplyMigrator:
    def __init__(self):
        self.legacy_to_lcfs_mapping: Dict[int, int] = {}
        self.group_base_versions: Dict[str, int] = {}
        self.unit_mapping = {
            "L": "Litres",
            "kg": "Kilograms",
            "kWh": "Kilowatt_hour",
            "m³": "Cubic_metres",
        }
        self.failed_records = []

    def load_mappings(self, lcfs_cursor):
        """Load legacy ID to LCFS compliance_report_id mappings"""
        logger.info("Loading legacy ID to LCFS compliance_report_id mappings")
        self.legacy_to_lcfs_mapping = build_legacy_mapping(lcfs_cursor)
        logger.info(f"Loaded {len(self.legacy_to_lcfs_mapping)} legacy mappings")

    def fetch_base_versions(self, lcfs_cursor):
        """Pre-fetch base versions for action type determination"""
        logger.info("Fetching base versions from compliance_report table...")
        query = """
            SELECT compliance_report_group_uuid, MIN(version) as base_version
            FROM compliance_report
            WHERE compliance_report_group_uuid IS NOT NULL
            GROUP BY compliance_report_group_uuid
        """
        lcfs_cursor.execute(query)

        for row in lcfs_cursor.fetchall():
            self.group_base_versions[row[0]] = row[1]

        logger.info(f"Finished fetching {len(self.group_base_versions)} base versions.")

    def get_compliance_reports_with_legacy_ids(self, lcfs_cursor) -> List[Tuple]:
        """Get all compliance reports with non-null legacy_id from LCFS"""
        query = """
            SELECT compliance_report_id, legacy_id, compliance_report_group_uuid, version
            FROM compliance_report
            WHERE legacy_id IS NOT NULL
        """
        lcfs_cursor.execute(query)
        return lcfs_cursor.fetchall()

    def fetch_snapshot_data(self, tfrs_cursor, legacy_id: int) -> Optional[Dict]:
        """Fetch the snapshot record from compliance_report_snapshot in TFRS"""
        query = """
            SELECT snapshot
            FROM compliance_report_snapshot
            WHERE compliance_report_id = %s
        """
        tfrs_cursor.execute(query, (legacy_id,))
        result = tfrs_cursor.fetchone()

        if result and result[0]:
            try:
                return json.loads(result[0])
            except json.JSONDecodeError as e:
                logger.error(
                    f"Failed to parse JSON snapshot for legacy_id {legacy_id}: {e}"
                )
                return None
        return None

    def fetch_sql_fallback_data(self, tfrs_cursor, legacy_id: int) -> List[Dict]:
        """Fallback: Retrieve fuel supply data from TFRS using SQL"""
        query = """
            WITH schedule_b AS (
                SELECT crsbr.id as fuel_supply_id,
                    cr.id as cr_legacy_id,
                    crsbr.quantity,
                    uom.name as unit_of_measure,
                    (SELECT cil.density
                    FROM carbon_intensity_limit cil
                    WHERE cil.fuel_class_id = crsbr.fuel_class_id
                        AND cil.effective_date <= cp.effective_date
                        AND cil.expiration_date > cp.effective_date
                    ORDER BY cil.effective_date DESC, cil.update_timestamp DESC
                    LIMIT 1) as ci_limit,
                    CASE
                        WHEN dt.the_type = 'Alternative' THEN crsbr.intensity
                        WHEN dt.the_type = 'GHGenius' THEN (
                            SELECT SUM(sdo.intensity)
                            FROM public.compliance_report_schedule_d crsd
                            JOIN public.compliance_report_schedule_d_sheet sds ON sds.schedule_id = crsd.id
                            JOIN public.compliance_report_schedule_d_sheet_output sdo ON sdo.sheet_id = sds.id
                            WHERE crsd.id = cr.schedule_d_id
                              AND sds.fuel_type_id = crsbr.fuel_type_id
                              AND sds.fuel_class_id = crsbr.fuel_class_id
                        )
                        WHEN dt.the_type = 'Fuel Code' THEN fc1.carbon_intensity
                        WHEN dt.the_type IN ('Default Carbon Intensity', 'Carbon Intensity')
                            THEN (SELECT dci.density
                                FROM default_carbon_intensity dci
                                JOIN default_carbon_intensity_category dcic
                                    ON dcic.id = dci.category_id
                                JOIN approved_fuel_type aft_sub
                                    ON aft_sub.default_carbon_intensity_category_id = dcic.id
                                WHERE aft_sub.id = aft.id
                                    AND dci.effective_date <= cp.effective_date
                                    AND (dci.expiration_date > cp.effective_date OR dci.expiration_date IS NULL)
                                ORDER BY dci.effective_date DESC, dci.update_timestamp DESC
                                LIMIT 1)
                        ELSE NULL
                    END as ci_of_fuel,
                    (SELECT ed.density
                    FROM energy_density ed
                    JOIN energy_density_category edc
                        ON edc.id = aft.energy_density_category_id
                    WHERE ed.effective_date <= cp.effective_date
                        AND ed.expiration_date > cp.effective_date
                    ORDER BY ed.effective_date DESC, ed.update_timestamp DESC
                    LIMIT 1) as energy_density,
                    (SELECT eer.ratio
                    FROM energy_effectiveness_ratio eer
                    JOIN energy_effectiveness_ratio_category eerc
                        ON eerc.id = aft.energy_effectiveness_ratio_category_id
                    WHERE eer.effective_date <= cp.effective_date
                        AND eer.expiration_date > cp.effective_date
                    ORDER BY eer.effective_date DESC, eer.update_timestamp DESC
                    LIMIT 1) as eer,
                    fc.fuel_class as fuel_category,
                    fc1.fuel_code as fuel_code_prefix,
                    CAST(CONCAT(fc1.fuel_code_version, '.', fc1.fuel_code_version_minor) AS CHAR) as fuel_code_suffix,
                    aft.name as fuel_type,
                    CONCAT(TRIM(pa.description), ' - ', TRIM(pa.provision)) as provision_act,
                    cr.create_timestamp as create_date,
                    cr.update_timestamp as update_date,
                    'ETL' as create_user,
                    'ETL' as update_user,
                    'SUPPLIER' as user_type,
                    'CREATE' as action_type
                FROM compliance_report_schedule_b_record crsbr
                INNER JOIN fuel_class fc ON fc.id = crsbr.fuel_class_id
                INNER JOIN approved_fuel_type aft ON aft.id = crsbr.fuel_type_id
                INNER JOIN provision_act pa ON pa.id = crsbr.provision_of_the_act_id
                LEFT JOIN carbon_intensity_fuel_determination cifd
                    ON cifd.fuel_id = aft.id AND cifd.provision_act_id = pa.id
                LEFT JOIN determination_type dt ON dt.id = cifd.determination_type_id
                INNER JOIN compliance_report cr ON cr.schedule_b_id = crsbr.schedule_id
                INNER JOIN compliance_period cp ON cp.id = cr.compliance_period_id
                LEFT JOIN fuel_code fc1 ON fc1.id = crsbr.fuel_code_id
                LEFT JOIN unit_of_measure uom ON uom.id = aft.unit_of_measure_id
                WHERE cr.id = %s
            )
            SELECT b.*, (b.energy_density * b.quantity) AS energy_content,
                ((((b.ci_limit * b.eer) - b.ci_of_fuel) * (b.energy_density * b.quantity)) / 1000000) AS compliance_units
            FROM schedule_b b
        """

        tfrs_cursor.execute(query, (legacy_id,))
        records = []

        for row in tfrs_cursor.fetchall():
            records.append(
                {
                    "fuel_supply_id": row[0],
                    "cr_legacy_id": row[1],
                    "quantity": row[2],
                    "unit_of_measure": row[3],
                    "ci_limit": row[4],
                    "ci_of_fuel": row[5],
                    "energy_density": row[6],
                    "eer": row[7],
                    "fuel_category": row[8],
                    "fuel_code_prefix": row[9],
                    "fuel_code_suffix": row[10],
                    "fuel_type": row[11],
                    "provision_act": row[12],
                    "create_date": row[13],
                    "update_date": row[14],
                    "create_user": row[15],
                    "update_user": row[16],
                    "user_type": row[17],
                    "action_type": row[18],
                    "energy_content": row[19],
                    "compliance_units": row[20],
                }
            )

        return records

    def lookup_provision_id(
        self, lcfs_cursor, provision_value: Optional[str]
    ) -> Optional[int]:
        """Lookup provision_of_the_act_id"""
        if not provision_value:
            return None

        query = (
            "SELECT provision_of_the_act_id FROM provision_of_the_act WHERE name = %s"
        )
        lcfs_cursor.execute(query, (provision_value,))
        result = lcfs_cursor.fetchone()
        return result[0] if result else None

    def lookup_fuel_category_id(
        self, lcfs_cursor, fuel_category_value: Optional[str]
    ) -> Optional[int]:
        """Lookup fuel_category_id"""
        if not fuel_category_value:
            return None

        query = "SELECT fuel_category_id FROM fuel_category WHERE category = %s::fuel_category_enum"
        lcfs_cursor.execute(query, (fuel_category_value,))
        result = lcfs_cursor.fetchone()
        return result[0] if result else None

    def lookup_fuel_code_id(
        self, lcfs_cursor, prefix: Optional[str], suffix: Optional[str]
    ) -> Optional[int]:
        """Lookup fuel_code_id"""
        if not prefix:
            return None

        query = """
            SELECT fuel_code_id 
            FROM fuel_code fc 
            JOIN fuel_code_prefix fcp ON fcp.fuel_code_prefix_id = fc.prefix_id 
            WHERE fcp.prefix = %s AND fc.fuel_suffix = %s
        """
        lcfs_cursor.execute(query, (prefix, suffix or ""))
        result = lcfs_cursor.fetchone()
        return result[0] if result else None

    def lookup_fuel_type_id(
        self, lcfs_cursor, fuel_type_value: Optional[str]
    ) -> Optional[int]:
        """Lookup fuel_type_id"""
        if not fuel_type_value:
            return None

        query = "SELECT fuel_type_id FROM fuel_type WHERE fuel_type = %s"
        lcfs_cursor.execute(query, (fuel_type_value,))
        result = lcfs_cursor.fetchone()
        return result[0] if result else None

    def safe_get_number(
        self, record: Dict, field_name: str, use_snapshot: bool, legacy_id: int
    ) -> Optional[Decimal]:
        """Safe function to get numeric values from snapshot or SQL records"""
        try:
            val = record.get(field_name)

            # Handle explicit "null" string values
            if isinstance(val, str) and val.lower() == "null":
                val = None

            # Handle null quantity specifically
            if val is None and field_name == "quantity":
                error_msg = f"ERROR: Found null quantity for field '{field_name}' for CR ID {legacy_id}"
                logger.error(error_msg)
                self.failed_records.append(
                    {
                        "cr_id": legacy_id,
                        "compliance_report_id": legacy_id,
                        "record_type": "fuel_supply",
                        "reason": "Null quantity value",
                        "record_data": str(record),
                    }
                )
                return None

            if val is None:
                return None

            # Convert to Decimal
            if isinstance(val, str):
                val = val.strip().replace(",", "")
                if val and val.replace("-", "").replace(".", "").isdigit():
                    return Decimal(val)
                else:
                    if field_name == "quantity":
                        logger.error(
                            f"ERROR: Invalid quantity value '{val}' for CR ID {legacy_id}"
                        )
                        self.failed_records.append(
                            {
                                "cr_id": legacy_id,
                                "compliance_report_id": legacy_id,
                                "record_type": "fuel_supply",
                                "reason": f"Non-numeric quantity value: '{val}'",
                                "record_data": str(record),
                            }
                        )
                    return None
            elif isinstance(val, (int, float)):
                return Decimal(str(val))
            else:
                if field_name == "quantity":
                    logger.error(
                        f"ERROR: Quantity has unexpected type: {type(val).__name__} for CR ID {legacy_id}"
                    )
                    self.failed_records.append(
                        {
                            "cr_id": legacy_id,
                            "compliance_report_id": legacy_id,
                            "record_type": "fuel_supply",
                            "reason": f"Quantity has unexpected type: {type(val).__name__}",
                            "record_data": str(record),
                        }
                    )
                return None

        except Exception as e:
            logger.warning(
                f"Error accessing/converting {field_name} for CR ID {legacy_id}: {e}"
            )
            if field_name == "quantity":
                logger.error(
                    f"ERROR: Exception while processing quantity value for CR ID {legacy_id}: {e}"
                )
                self.failed_records.append(
                    {
                        "cr_id": legacy_id,
                        "compliance_report_id": legacy_id,
                        "record_type": "fuel_supply",
                        "reason": f"Exception while processing quantity: {e}",
                        "record_data": str(record),
                    }
                )
            return None

    def process_schedule_b_record(
        self,
        record: Dict,
        use_snapshot: bool,
        compliance_report_id: int,
        legacy_id: int,
        group_uuid: str,
        version: int,
        action_type: str,
        lcfs_cursor,
    ) -> bool:
        """Process a single Schedule B record"""
        try:
            # Get unit of measure
            unit_of_measure = record.get("unit_of_measure")
            unit_full_form = (
                self.unit_mapping.get(unit_of_measure, unit_of_measure)
                if unit_of_measure
                else None
            )

            # Get provision description for snapshot records
            provision_act_description = None
            if use_snapshot:
                provision_act_description = record.get(
                    "provision_of_the_act_description"
                )

            # Determine provision lookup value
            provision_lookup_value = None
            if use_snapshot:
                description = record.get("provision_of_the_act_description")
                provision = record.get("provision_of_the_act")
                if description and provision:
                    provision_lookup_value = f"{description} - {provision}"
            else:
                provision_lookup_value = record.get("provision_act")

            provision_id = self.lookup_provision_id(lcfs_cursor, provision_lookup_value)

            # Get fuel category
            fuel_category_lookup_value = (
                record.get("fuel_class")
                if use_snapshot
                else record.get("fuel_category")
            )
            fuel_category_id = self.lookup_fuel_category_id(
                lcfs_cursor, fuel_category_lookup_value
            )

            # Get fuel code
            fuel_code_id = None
            if use_snapshot:
                fuel_code_desc = record.get("fuel_code_description", "")
                if fuel_code_desc and isinstance(fuel_code_desc, str):
                    # Find the index of the first digit to split prefix/suffix
                    first_digit_index = -1
                    for i, char in enumerate(fuel_code_desc):
                        if char.isdigit():
                            first_digit_index = i
                            break

                    if first_digit_index != -1:
                        fuel_code_prefix = fuel_code_desc[:first_digit_index]
                        fuel_code_suffix = fuel_code_desc[first_digit_index:]
                    else:
                        fuel_code_prefix = fuel_code_desc
                        fuel_code_suffix = ""

                    fuel_code_id = self.lookup_fuel_code_id(
                        lcfs_cursor, fuel_code_prefix, fuel_code_suffix
                    )
            else:
                fuel_code_prefix = record.get("fuel_code_prefix")
                fuel_code_suffix = record.get("fuel_code_suffix")
                if fuel_code_prefix:
                    fuel_code_id = self.lookup_fuel_code_id(
                        lcfs_cursor, fuel_code_prefix, fuel_code_suffix
                    )

            # Get fuel type
            fuel_type_lookup_value = record.get("fuel_type")
            fuel_type_id = self.lookup_fuel_type_id(lcfs_cursor, fuel_type_lookup_value)

            # Get numeric values
            quantity = self.safe_get_number(record, "quantity", use_snapshot, legacy_id)

            # Handle compliance units and CI of fuel
            compliance_units = None
            ci_of_fuel = None

            if use_snapshot:
                # Prioritize snapshot values
                credits = self.safe_get_number(
                    record, "credits", use_snapshot, legacy_id
                )
                debits = self.safe_get_number(record, "debits", use_snapshot, legacy_id)
                if credits is not None:
                    compliance_units = -credits
                elif debits is not None:
                    compliance_units = debits

                # Get CI of fuel from snapshot based on provision type
                if provision_act_description == "Prescribed carbon intensity":
                    ci_of_fuel = self.safe_get_number(
                        record, "effective_carbon_intensity", use_snapshot, legacy_id
                    )
                elif provision_act_description in [
                    "Approved fuel code",
                    "Default Carbon Intensity Value",
                    "GHGenius modelled",
                ]:
                    ci_of_fuel = self.safe_get_number(
                        record, "effective_carbon_intensity", use_snapshot, legacy_id
                    )
                else:
                    ci_of_fuel = self.safe_get_number(
                        record, "intensity", use_snapshot, legacy_id
                    )
            else:
                # SQL fallback
                compliance_units = self.safe_get_number(
                    record, "compliance_units", use_snapshot, legacy_id
                )
                ci_of_fuel = self.safe_get_number(
                    record, "ci_of_fuel", use_snapshot, legacy_id
                )

            ci_limit = self.safe_get_number(record, "ci_limit", use_snapshot, legacy_id)
            energy_density = self.safe_get_number(
                record, "energy_density", use_snapshot, legacy_id
            )
            eer = self.safe_get_number(record, "eer", use_snapshot, legacy_id)
            energy_content = self.safe_get_number(
                record, "energy_content", use_snapshot, legacy_id
            )

            # Pre-insert validation
            validation_errors = []
            if quantity is None:
                validation_errors.append("Quantity is NULL or invalid")
            if unit_full_form is None:
                validation_errors.append(
                    "Units (unit_of_measure) is NULL or could not be determined"
                )

            if validation_errors:
                logger.error(
                    f"Skipping insert for CR ID {legacy_id} (LCFS ID: {compliance_report_id}) due to validation errors: {', '.join(validation_errors)}"
                )
                if "Quantity is NULL or invalid" not in validation_errors:
                    self.failed_records.append(
                        {
                            "cr_id": legacy_id,
                            "compliance_report_id": compliance_report_id,
                            "record_type": "fuel_supply",
                            "reason": f"Validation failed: {', '.join(validation_errors)}",
                            "record_data": str(record),
                        }
                    )
                return False

            # Insert record
            insert_sql = """
                INSERT INTO public.fuel_supply (
                    compliance_report_id, quantity, units, compliance_units, target_ci, ci_of_fuel,
                    energy_density, eer, energy, fuel_type_other, fuel_category_id, fuel_code_id,
                    fuel_type_id, provision_of_the_act_id, end_use_id, create_date, update_date,
                    create_user, update_user, group_uuid, version, action_type
                ) VALUES (%s, %s, %s::quantityunitsenum, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::actiontypeenum)
            """

            params = [
                compliance_report_id,
                float(quantity),
                unit_full_form,
                float(compliance_units) if compliance_units is not None else None,
                float(ci_limit) if ci_limit is not None else None,
                float(ci_of_fuel) if ci_of_fuel is not None else None,
                float(energy_density) if energy_density is not None else None,
                float(eer) if eer is not None else None,
                float(energy_content) if energy_content is not None else None,
                None,  # fuel_type_other
                fuel_category_id,
                fuel_code_id,
                fuel_type_id,
                provision_id,
                None,  # end_use_id
                None,  # create_date
                None,  # update_date
                "ETL",
                "ETL",
                group_uuid,
                version,
                action_type,
            ]

            lcfs_cursor.execute(insert_sql, params)
            return True

        except Exception as e:
            logger.error(
                f"Error processing individual record (CR ID {legacy_id}, LCFS ID: {compliance_report_id}): {e}"
            )
            self.failed_records.append(
                {
                    "cr_id": legacy_id,
                    "compliance_report_id": compliance_report_id,
                    "record_type": "fuel_supply",
                    "reason": f"Exception during processing: {e}",
                    "record_data": str(record),
                }
            )
            return False

    def migrate(self) -> Tuple[int, int]:
        """Main migration logic"""
        total_processed = 0
        total_failed = 0

        try:
            with get_source_connection() as tfrs_conn:
                with get_destination_connection() as lcfs_conn:
                    tfrs_cursor = tfrs_conn.cursor()
                    lcfs_cursor = lcfs_conn.cursor()

                    # Load mappings and base versions
                    self.load_mappings(lcfs_cursor)
                    self.fetch_base_versions(lcfs_cursor)

                    # Get compliance reports to process
                    compliance_reports = self.get_compliance_reports_with_legacy_ids(
                        lcfs_cursor
                    )

                    for (
                        compliance_report_id,
                        legacy_id,
                        group_uuid,
                        version,
                    ) in compliance_reports:
                        logger.info(f"Processing source CR ID {legacy_id}")

                        # Determine action type
                        base_version = self.group_base_versions.get(group_uuid)
                        action_type = (
                            "CREATE"
                            if base_version is None or version == base_version
                            else "UPDATE"
                        )

                        # Try to get snapshot data first
                        snapshot_data = self.fetch_snapshot_data(tfrs_cursor, legacy_id)

                        if (
                            snapshot_data
                            and "schedule_b" in snapshot_data
                            and "records" in snapshot_data["schedule_b"]
                        ):
                            # Process snapshot records
                            schedule_b_records = snapshot_data["schedule_b"]["records"]
                            logger.info(
                                f"Processing {len(schedule_b_records)} records from snapshot for source CR ID {legacy_id}"
                            )

                            for record in schedule_b_records:
                                if self.process_schedule_b_record(
                                    record,
                                    True,
                                    compliance_report_id,
                                    legacy_id,
                                    group_uuid,
                                    version,
                                    action_type,
                                    lcfs_cursor,
                                ):
                                    total_processed += 1
                                else:
                                    total_failed += 1
                        else:
                            # Fallback to SQL
                            logger.warning(
                                f"No snapshot found for source CR ID {legacy_id}. Using direct SQL query fallback."
                            )
                            sql_records = self.fetch_sql_fallback_data(
                                tfrs_cursor, legacy_id
                            )

                            for record in sql_records:
                                if self.process_schedule_b_record(
                                    record,
                                    False,
                                    compliance_report_id,
                                    legacy_id,
                                    group_uuid,
                                    version,
                                    action_type,
                                    lcfs_cursor,
                                ):
                                    total_processed += 1
                                else:
                                    total_failed += 1

                    # Commit all changes
                    lcfs_conn.commit()
                    logger.info(
                        f"Successfully committed {total_processed} fuel supply records"
                    )

                    # Log failed records summary
                    if self.failed_records:
                        logger.error(
                            f"Total failed records: {len(self.failed_records)}"
                        )
                        for failed in self.failed_records[:10]:  # Log first 10 failures
                            logger.error(
                                f"Failed: CR {failed['cr_id']} - {failed['reason']}"
                            )

                    tfrs_cursor.close()
                    lcfs_cursor.close()

        except Exception as e:
            logger.error(f"Migration failed: {e}")
            raise

        return total_processed, total_failed


def main():
    setup_logging()
    logger.info("Starting Fuel Supply Migration")

    migrator = FuelSupplyMigrator()

    try:
        processed, failed = migrator.migrate()
        logger.info(f"Migration completed. Processed: {processed}, Failed: {failed}")
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
