#!/usr/bin/env python3
"""
GHGenius Fuel Supply Migration Script

Migrates GHGenius fuel supply records from TFRS to LCFS database using a CSV file
that contains all the specific GHGenius records with their correct CI values.

This script addresses Issue #15 where GHGenius compliance units were calculated
incorrectly because the user-provided CI value was being ignored.

Key features:
1. Reads GHGenius records from a CSV file exported from TFRS
2. Maps TFRS Report IDs to LCFS compliance_report_ids
3. Creates fuel_supply records with the correct user-provided CI values
4. Uses the CI Fuel column from the CSV as the effective carbon intensity
"""

import os
import sys
import csv
import uuid
import logging
from decimal import Decimal, InvalidOperation
from typing import Dict, List, Optional, Tuple

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import get_destination_connection
from core.utils import setup_logging, safe_decimal, safe_int, safe_str

logger = logging.getLogger(__name__)

# Path to the CSV file
CSV_FILE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "ghgenius_fuel_supply_cis.csv"
)


class GHGeniusMigrator:
    def __init__(self):
        self.legacy_to_lcfs_mapping: Dict[int, int] = {}
        self.fuel_type_mapping: Dict[str, int] = {}
        self.fuel_category_mapping: Dict[str, int] = {}
        self.provision_id: Optional[int] = None  # GHGenius provision ID

        # Unit mapping from TFRS to LCFS
        # Note: m³ may appear as UTF-8 or Latin-1 encoded, so we include both
        self.unit_mapping = {
            "L": "Litres",
            "kg": "Kilograms",
            "m³": "Cubic_metres",  # UTF-8 encoded
            "m\xb3": "Cubic_metres",  # Latin-1 encoded (byte 0xb3)
            "kWh": "Kilowatt_hour",
        }

    def load_mappings(self, lcfs_cursor):
        """Load reference data mappings from LCFS database"""
        logger.info("Loading reference data mappings")

        # Load legacy_id to compliance_report_id mapping
        lcfs_cursor.execute(
            "SELECT compliance_report_id, legacy_id FROM compliance_report WHERE legacy_id IS NOT NULL"
        )
        for row in lcfs_cursor.fetchall():
            lcfs_id, legacy_id = row
            self.legacy_to_lcfs_mapping[legacy_id] = lcfs_id
        logger.info(f"Loaded {len(self.legacy_to_lcfs_mapping)} legacy mappings")

        # Load fuel type mappings
        lcfs_cursor.execute("SELECT fuel_type_id, fuel_type FROM fuel_type")
        for row in lcfs_cursor.fetchall():
            fuel_type_id, fuel_type_name = row
            self.fuel_type_mapping[fuel_type_name.lower()] = fuel_type_id
        logger.info(f"Loaded {len(self.fuel_type_mapping)} fuel type mappings")

        # Load fuel category mappings
        lcfs_cursor.execute("SELECT fuel_category_id, category FROM fuel_category")
        for row in lcfs_cursor.fetchall():
            fuel_cat_id, category_name = row
            self.fuel_category_mapping[category_name.lower()] = fuel_cat_id
        logger.info(f"Loaded {len(self.fuel_category_mapping)} fuel category mappings")

        # Load GHGenius provision ID
        lcfs_cursor.execute(
            "SELECT provision_of_the_act_id FROM provision_of_the_act WHERE name LIKE '%GHGenius%'"
        )
        result = lcfs_cursor.fetchone()
        if result:
            self.provision_id = result[0]
            logger.info(f"Found GHGenius provision ID: {self.provision_id}")
        else:
            logger.error("GHGenius provision not found in database!")
            raise ValueError("GHGenius provision not found")

    def parse_number(self, value: str) -> Optional[Decimal]:
        """Parse a number from CSV, removing commas and handling empty values"""
        if not value or value.strip() in ("", ".", "-"):
            return None
        try:
            # Remove commas from numbers like "690,166"
            cleaned = value.replace(",", "").strip()
            return Decimal(cleaned)
        except (InvalidOperation, ValueError):
            logger.warning(f"Could not parse number: '{value}'")
            return None

    def parse_report_id(self, value: str) -> Optional[int]:
        """Parse report ID from CSV, handling quoted values with commas like '3,854'"""
        if not value:
            return None
        try:
            # Remove commas and quotes
            cleaned = value.replace(",", "").replace('"', "").strip()
            return int(cleaned)
        except ValueError:
            logger.warning(f"Could not parse report ID: '{value}'")
            return None

    def lookup_fuel_type_id(self, fuel_type: str) -> Optional[int]:
        """Look up fuel type ID by name"""
        if not fuel_type:
            return None

        fuel_type_lower = fuel_type.lower().strip()

        # Direct lookup
        if fuel_type_lower in self.fuel_type_mapping:
            return self.fuel_type_mapping[fuel_type_lower]

        # Try alternate names
        alternates = {
            "renewable diesel": ["renewable diesel", "hdrd", "hydrogenation-derived renewable diesel"],
            "renewable gasoline": ["renewable gasoline"],
            "renewable naphtha": ["renewable naphtha"],
            "hdrd": ["hdrd", "hydrogenation-derived renewable diesel"],
            "ethanol": ["ethanol"],
            "biodiesel": ["biodiesel"],
            "propane": ["propane"],
            "cng": ["cng", "compressed natural gas"],
            "lng": ["lng", "liquefied natural gas"],
            "hydrogen": ["hydrogen"],
        }

        for key, alts in alternates.items():
            if fuel_type_lower in alts:
                if key in self.fuel_type_mapping:
                    return self.fuel_type_mapping[key]

        logger.warning(f"Could not find fuel type: '{fuel_type}'")
        return None

    def lookup_fuel_category_id(self, fuel_category: str) -> Optional[int]:
        """Look up fuel category ID by name"""
        if not fuel_category:
            return None

        fuel_cat_lower = fuel_category.lower().strip()

        if fuel_cat_lower in self.fuel_category_mapping:
            return self.fuel_category_mapping[fuel_cat_lower]

        logger.warning(f"Could not find fuel category: '{fuel_category}'")
        return None

    def read_csv_records(self) -> List[Dict]:
        """Read GHGenius records from CSV file"""
        records = []

        if not os.path.exists(CSV_FILE_PATH):
            logger.error(f"CSV file not found: {CSV_FILE_PATH}")
            return records

        # Use latin-1 encoding as the CSV contains m³ (cubic meters) character
        with open(CSV_FILE_PATH, 'r', encoding='latin-1') as f:
            reader = csv.DictReader(f)
            for row in reader:
                records.append(row)

        logger.info(f"Read {len(records)} records from CSV file")
        return records

    def check_existing_record(
        self, lcfs_cursor, compliance_report_id: int, fuel_type_id: int,
        fuel_category_id: int, quantity: Decimal
    ) -> bool:
        """Check if a similar GHGenius fuel supply record already exists.

        We check by compliance_report_id, provision_id, fuel_type, fuel_category, and quantity
        to detect if this record was already migrated.

        Returns True if a matching record exists.
        """
        query = """
            SELECT fuel_supply_id FROM fuel_supply
            WHERE compliance_report_id = %s
            AND provision_of_the_act_id = %s
            AND fuel_type_id = %s
            AND fuel_category_id = %s
            AND quantity = %s
            LIMIT 1
        """
        lcfs_cursor.execute(query, (
            compliance_report_id,
            self.provision_id,
            fuel_type_id,
            fuel_category_id,
            float(quantity)
        ))
        return lcfs_cursor.fetchone() is not None

    def insert_fuel_supply_record(
        self, lcfs_cursor, record: Dict, compliance_report_id: int
    ) -> str:
        """Insert a single GHGenius fuel supply record.

        Returns:
            'inserted' - Record was successfully inserted
            'exists' - Record already exists (skipped)
            'error' - Record failed validation or insertion
        """
        try:
            # Parse record data
            tfrs_id = safe_int(record.get("ID"))
            fuel_type = record.get("Fuel type", "").strip()
            fuel_category = record.get("Fuel category", "").strip()
            quantity = self.parse_number(record.get("Quantity", ""))
            units = record.get("Units", "").strip()
            credits_val = self.parse_number(record.get("Credits", ""))
            debits_val = self.parse_number(record.get("Debits", ""))
            energy_content = self.parse_number(record.get("Energy Content", ""))
            energy_density = self.parse_number(record.get("Energy Density", ""))
            ci_limit = self.parse_number(record.get("CI Limit", ""))  # Target CI
            eer = self.parse_number(record.get("EER", ""))
            ci_fuel = self.parse_number(record.get("CI Fuel", ""))  # THE KEY VALUE

            # Calculate compliance units
            if credits_val is not None and credits_val > 0:
                compliance_units = credits_val
            elif debits_val is not None and debits_val > 0:
                compliance_units = -debits_val
            else:
                compliance_units = None

            # Look up IDs
            fuel_type_id = self.lookup_fuel_type_id(fuel_type)
            fuel_category_id = self.lookup_fuel_category_id(fuel_category)

            # Map units
            unit_full_form = self.unit_mapping.get(units, units)

            # Validation
            if fuel_type_id is None:
                logger.warning(f"Skipping record {tfrs_id}: could not map fuel type '{fuel_type}'")
                return "error"

            if fuel_category_id is None:
                logger.warning(f"Skipping record {tfrs_id}: could not map fuel category '{fuel_category}'")
                return "error"

            if quantity is None:
                logger.warning(f"Skipping record {tfrs_id}: missing quantity")
                return "error"

            if ci_fuel is None:
                logger.warning(f"Skipping record {tfrs_id}: missing CI Fuel value")
                return "error"

            # Check if record already exists (avoid duplicates on re-runs)
            if self.check_existing_record(lcfs_cursor, compliance_report_id, fuel_type_id, fuel_category_id, quantity):
                logger.debug(f"Record {tfrs_id} already exists for CR {compliance_report_id} - skipping")
                return "exists"

            # Generate a stable group_uuid based on the TFRS ID
            group_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"ghgenius-{tfrs_id}"))

            # Insert the record (includes action_type for proper versioning)
            insert_query = """
                INSERT INTO fuel_supply (
                    compliance_report_id,
                    fuel_category_id,
                    fuel_type_id,
                    provision_of_the_act_id,
                    fuel_code_id,
                    end_use_id,
                    fuel_type_other,
                    quantity,
                    units,
                    ci_of_fuel,
                    energy_density,
                    eer,
                    uci,
                    energy,
                    compliance_units,
                    target_ci,
                    create_date,
                    update_date,
                    create_user,
                    update_user,
                    group_uuid,
                    version,
                    action_type
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::actiontypeenum
                )
            """

            # Use Decimal values directly to preserve precision (PostgreSQL Numeric works with Python Decimal)
            params = (
                compliance_report_id,
                fuel_category_id,
                fuel_type_id,
                self.provision_id,  # GHGenius provision
                None,  # fuel_code_id - not applicable for GHGenius
                None,  # end_use_id
                None,  # fuel_type_other
                quantity,  # Keep as Decimal for precision
                unit_full_form,
                ci_fuel,  # THE KEY: Use CI Fuel from CSV as effective CI (keep as Decimal)
                energy_density,  # Keep as Decimal
                eer if eer else Decimal("1.0"),
                None,  # uci
                energy_content,  # Keep as Decimal
                compliance_units,  # Keep as Decimal for precision (important for credit calculations)
                ci_limit,  # target_ci - keep as Decimal
                None,  # create_date
                None,  # update_date
                "ETL_GHGENIUS",  # create_user - mark as GHGenius ETL
                "ETL_GHGENIUS",  # update_user
                group_uuid,
                1,  # version
                "CREATE",  # action_type
            )

            lcfs_cursor.execute(insert_query, params)
            logger.debug(f"Inserted GHGenius record {tfrs_id} with CI={ci_fuel}")
            return "inserted"

        except Exception as e:
            logger.error(f"Failed to insert GHGenius record: {e}")
            return "error"

    def migrate(self) -> Tuple[int, int]:
        """Main migration logic"""
        total_processed = 0
        total_skipped = 0
        total_not_found = 0
        total_already_exists = 0

        try:
            with get_destination_connection() as lcfs_conn:
                lcfs_cursor = lcfs_conn.cursor()

                # Load mappings
                self.load_mappings(lcfs_cursor)

                # Read CSV records
                csv_records = self.read_csv_records()

                if not csv_records:
                    logger.error("No records found in CSV file")
                    return 0, 0

                logger.info(f"Processing {len(csv_records)} GHGenius records")

                for record in csv_records:
                    tfrs_id = safe_int(record.get("ID"))
                    tfrs_report_id = self.parse_report_id(record.get("Report ID", ""))
                    org_name = record.get("Organization Name", "")
                    compliance_period = record.get("Compliance Period", "")

                    if not tfrs_report_id:
                        logger.warning(f"Skipping record {tfrs_id}: invalid Report ID")
                        total_skipped += 1
                        continue

                    # Find corresponding LCFS compliance report
                    lcfs_report_id = self.legacy_to_lcfs_mapping.get(tfrs_report_id)

                    if not lcfs_report_id:
                        logger.warning(
                            f"Skipping record {tfrs_id}: TFRS report {tfrs_report_id} not found in LCFS "
                            f"(Org: {org_name}, Period: {compliance_period})"
                        )
                        total_not_found += 1
                        continue

                    # Insert the record (returns 'inserted', 'exists', or 'error')
                    result = self.insert_fuel_supply_record(lcfs_cursor, record, lcfs_report_id)
                    if result == "inserted":
                        total_processed += 1
                    elif result == "exists":
                        total_already_exists += 1
                    else:
                        total_skipped += 1

                # Commit all changes
                lcfs_conn.commit()

                logger.info("=== GHGENIUS MIGRATION SUMMARY ===")
                logger.info(f"Total CSV Records: {len(csv_records)}")
                logger.info(f"Records Inserted: {total_processed}")
                logger.info(f"Records Already Exist: {total_already_exists}")
                logger.info(f"Records Skipped (errors): {total_skipped}")
                logger.info(f"Reports Not Found in LCFS: {total_not_found}")
                logger.info("==================================")

                lcfs_cursor.close()

        except Exception as e:
            logger.error(f"Migration failed: {e}")
            raise

        return total_processed, total_skipped


def main():
    setup_logging()
    logger.info("Starting GHGenius Fuel Supply Migration")

    migrator = GHGeniusMigrator()

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
