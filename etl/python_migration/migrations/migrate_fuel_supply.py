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
import uuid
from decimal import Decimal, InvalidOperation
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
            # Map TFRS units to LCFS enum values
            "m³": "Cubic_metres",
            "L": "Litres",
            "kg": "Kilograms",
            "kWh": "Kilowatt_hour",
            # Add other common unit variations
            "Litres": "Litres",
            "Kilograms": "Kilograms",
            "Kilowatt_hour": "Kilowatt_hour",
            "Cubic_metres": "Cubic_metres",
        }

        # Map TFRS provision names to LCFS provision names
        self.provision_mapping = {
            "Default Carbon Intensity Value": "Default Carbon Intensity Value - Section 6 (5) (d) (i)",
            "Prescribed carbon intensity": "Prescribed carbon intensity - section 19 (a)",
            "Approved fuel code": "Approved fuel code - Section 6 (5) (c)",
            "GHGenius modelled": "GHGenius modelled - Section 6 (5) (d) (ii) (A)",
            "Alternative Method": "Alternative Method - Section 6 (5) (d) (ii) (B)",
            "Fuel code": "Fuel code - section 19 (b) (i)",
            "Default carbon intensity": "Default carbon intensity - section 19 (b) (ii)",
        }

        self.legacy_to_lcfs_mapping = {}

    def load_mappings(self, lcfs_cursor):
        """Load reference data mappings from LCFS database"""
        # Initialize mapping dictionaries
        self.unit_mapping = {
            # Map TFRS units to LCFS enum values
            "m³": "Cubic_metres",
            "L": "Litres",
            "kg": "Kilograms",
            "kWh": "Kilowatt_hour",
            # Add other common unit variations
            "Litres": "Litres",
            "Kilograms": "Kilograms",
            "Kilowatt_hour": "Kilowatt_hour",
            "Cubic_metres": "Cubic_metres",
        }
        self.legacy_to_lcfs_mapping = {}

        try:
            # Load fuel category mappings
            lcfs_cursor.execute("SELECT fuel_category_id, category FROM fuel_category")
            for row in lcfs_cursor.fetchall():
                self.legacy_to_lcfs_mapping[row[1]] = row[0]

            # Load fuel type mappings
            lcfs_cursor.execute("SELECT fuel_type_id, fuel_type FROM fuel_type")
            for row in lcfs_cursor.fetchall():
                self.legacy_to_lcfs_mapping[row[1]] = row[0]

            # Load provision mappings
            lcfs_cursor.execute(
                "SELECT provision_of_the_act_id, name FROM provision_of_the_act"
            )
            for row in lcfs_cursor.fetchall():
                self.legacy_to_lcfs_mapping[row[1]] = row[0]

            logger.info("Loaded reference data mappings")

        except Exception as e:
            logger.error(f"Failed to load mappings: {e}")
            raise

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
                # Handle both string and already-parsed dict data
                snapshot_data = result[0]
                if isinstance(snapshot_data, str):
                    return json.loads(snapshot_data)
                elif isinstance(snapshot_data, dict):
                    return snapshot_data
                else:
                    logger.error(
                        f"Unexpected snapshot data type for legacy_id {legacy_id}: {type(snapshot_data)}"
                    )
                    return None
            except json.JSONDecodeError as e:
                logger.error(
                    f"Failed to parse JSON snapshot for legacy_id {legacy_id}: {e}"
                )
                return None
        return None

    def fetch_sql_fallback_data(self, tfrs_cursor, legacy_id: int) -> List[Dict]:
        """Fallback: Retrieve fuel supply data from TFRS using SQL"""
        # DISABLED: This query causes "relation 'fuel_supply' does not exist" errors
        # because the TFRS database doesn't have a fuel_supply table with this structure
        logger.warning(
            f"SQL fallback disabled for legacy_id {legacy_id} - using snapshot data only"
        )
        return []

    def lookup_fuel_category_id(self, lcfs_cursor, fuel_category: str) -> Optional[int]:
        """Look up fuel category ID by name"""
        if not fuel_category:
            logger.info("fuel_category is empty/None, returning None")
            return None
        query = "SELECT fuel_category_id FROM fuel_category WHERE category = %s"
        lcfs_cursor.execute(query, (fuel_category,))
        result = lcfs_cursor.fetchone()

        if not result:
            # Debug: Show available categories when lookup fails
            logger.info(
                f"Failed to find fuel_category '{fuel_category}', checking available categories..."
            )
            lcfs_cursor.execute("SELECT category FROM fuel_category ORDER BY category")
            available_categories = [row[0] for row in lcfs_cursor.fetchall()]
            logger.info(f"Available fuel categories: {available_categories}")
            return None

        return result[0]

    def lookup_fuel_type_id(self, lcfs_cursor, fuel_type: str) -> Optional[int]:
        """Look up fuel type ID by name"""
        if not fuel_type:
            return None
        query = "SELECT fuel_type_id FROM fuel_type WHERE fuel_type = %s"
        lcfs_cursor.execute(query, (fuel_type,))
        result = lcfs_cursor.fetchone()
        return result[0] if result else None

    def lookup_provision_id(self, lcfs_cursor, provision_name: str) -> Optional[int]:
        """Look up provision of the act ID by name"""
        if not provision_name:
            logger.info("provision_name is empty/None, returning None")
            return None

        # Try direct lookup first
        query = (
            "SELECT provision_of_the_act_id FROM provision_of_the_act WHERE name = %s"
        )
        lcfs_cursor.execute(query, (provision_name,))
        result = lcfs_cursor.fetchone()

        if result:
            return result[0]

        # If direct lookup fails, try the mapping
        mapped_provision = self.provision_mapping.get(provision_name)
        if mapped_provision:
            logger.info(
                f"Using provision mapping: '{provision_name}' -> '{mapped_provision}'"
            )
            lcfs_cursor.execute(query, (mapped_provision,))
            result = lcfs_cursor.fetchone()
            if result:
                return result[0]

        # Debug: Show available provisions when lookup fails
        logger.info(
            f"Failed to find provision '{provision_name}' (mapped: '{mapped_provision}'), checking available provisions..."
        )
        lcfs_cursor.execute("SELECT name FROM provision_of_the_act ORDER BY name")
        available_provisions = [row[0] for row in lcfs_cursor.fetchall()]
        logger.info(f"Available provisions: {available_provisions}")
        return None

    def lookup_fuel_code_id(
        self, lcfs_cursor, fuel_code_prefix: str, fuel_code_suffix: str = None
    ) -> Optional[int]:
        """Look up fuel code ID by prefix and suffix"""
        if not fuel_code_prefix:
            return None

        try:
            # First, find the prefix_id from the fuel_code_prefix table
            prefix_query = (
                "SELECT fuel_code_prefix_id FROM fuel_code_prefix WHERE prefix = %s"
            )
            lcfs_cursor.execute(prefix_query, (fuel_code_prefix,))
            prefix_result = lcfs_cursor.fetchone()

            if not prefix_result:
                logger.debug(f"No fuel code prefix found for: {fuel_code_prefix}")
                return None

            prefix_id = prefix_result[0]

            # Now find the fuel code using prefix_id and suffix
            if fuel_code_suffix:
                fuel_code_query = """
                    SELECT fuel_code_id FROM fuel_code 
                    WHERE prefix_id = %s AND fuel_suffix = %s
                    AND fuel_status_id != 3  -- Exclude deleted fuel codes
                """
                lcfs_cursor.execute(fuel_code_query, (prefix_id, fuel_code_suffix))
            else:
                fuel_code_query = """
                    SELECT fuel_code_id FROM fuel_code 
                    WHERE prefix_id = %s AND fuel_suffix IS NULL
                    AND fuel_status_id != 3  -- Exclude deleted fuel codes
                """
                lcfs_cursor.execute(fuel_code_query, (prefix_id,))

            result = lcfs_cursor.fetchone()
            if result:
                logger.debug(
                    f"Found fuel_code_id {result[0]} for prefix '{fuel_code_prefix}' suffix '{fuel_code_suffix}'"
                )
                return result[0]
            else:
                logger.debug(
                    f"No fuel code found for prefix '{fuel_code_prefix}' suffix '{fuel_code_suffix}'"
                )
                return None

        except Exception as e:
            logger.error(f"Error looking up fuel code: {e}")
            return None

    def lookup_fuel_code_by_full_code(
        self, lcfs_cursor, full_fuel_code: str
    ) -> Optional[int]:
        """Look up LCFS fuel code ID by full fuel code string (e.g., BCLCF236.1)"""
        if not full_fuel_code:
            return None

        try:
            # Try to find an exact match first
            lcfs_cursor.execute(
                """
                SELECT fc.fuel_code_id 
                FROM fuel_code fc
                JOIN fuel_code_prefix fcp ON fc.prefix_id = fcp.fuel_code_prefix_id
                WHERE CONCAT(fcp.prefix, fc.fuel_suffix) = %s
                AND fc.fuel_status_id != 3  -- Exclude deleted fuel codes
                """,
                (full_fuel_code,),
            )
            result = lcfs_cursor.fetchone()
            if result:
                logger.debug(
                    f"Found exact LCFS fuel code match for {full_fuel_code}: {result[0]}"
                )
                return result[0]

            # If no exact match, try parsing the fuel code to extract prefix and suffix
            # Look for patterns like BCLCF236.1 where BCLCF is prefix and 236.1 is suffix
            import re

            match = re.match(r"^([A-Z]+)(.+)$", full_fuel_code)
            if match:
                prefix_part = match.group(1)
                suffix_part = match.group(2)

                # Try with the parsed prefix and suffix
                lcfs_cursor.execute(
                    """
                    SELECT fc.fuel_code_id 
                    FROM fuel_code fc
                    JOIN fuel_code_prefix fcp ON fc.prefix_id = fcp.fuel_code_prefix_id
                    WHERE fcp.prefix = %s AND fc.fuel_suffix = %s
                    AND fc.fuel_status_id != 3  -- Exclude deleted fuel codes
                    """,
                    (prefix_part, suffix_part),
                )
                result = lcfs_cursor.fetchone()
                if result:
                    logger.debug(
                        f"Found LCFS fuel code by parsing {full_fuel_code} -> prefix={prefix_part}, suffix={suffix_part}: {result[0]}"
                    )
                    return result[0]

            logger.debug(f"No LCFS fuel code found for {full_fuel_code}")
            return None

        except Exception as e:
            logger.error(f"Error looking up LCFS fuel code for {full_fuel_code}: {e}")
            return None

    def lookup_end_use_id(self, lcfs_cursor, end_use: str) -> Optional[int]:
        """Look up end use type ID by name"""
        if not end_use:
            return None
        query = "SELECT end_use_type_id FROM end_use_type WHERE name = %s"
        lcfs_cursor.execute(query, (end_use,))
        result = lcfs_cursor.fetchone()
        return result[0] if result else None

    def safe_get_number(
        self, record: Dict, field: str, use_snapshot: bool, legacy_id: int
    ) -> Optional[Decimal]:
        """Safely get and convert a number from record"""
        try:
            val = record.get(field)
            if val is None or val == "":
                return None
            elif isinstance(val, (int, float, Decimal)):
                return Decimal(str(val))
            else:
                # Try to convert string to Decimal
                val_str = str(val).strip()
                if val_str == "":
                    return None
                return Decimal(val_str)
        except (ValueError, TypeError, InvalidOperation) as e:
            logger.warning(
                f"Could not convert {field}='{val}' to Decimal for legacy_id {legacy_id}: {e}"
            )
            return None

    def get_standardized_fuel_data(
        self,
        lcfs_cursor,
        fuel_type_id: int,
        fuel_category_id: int,
        end_use_id: int,
        compliance_period: str,
        fuel_code_id: Optional[int] = None,
        provision_id: Optional[int] = None,
    ) -> Dict[str, Optional[float]]:
        """
        Fetch standardized fuel data similar to LCFS backend logic.
        Returns calculated values for RCI, TCI, EER, energy_density, UCI.
        """
        result = {
            "effective_carbon_intensity": None,  # RCI
            "target_ci": None,  # TCI
            "eer": 1.0,  # EER (default to 1.0)
            "energy_density": None,  # Energy Density
            "uci": None,  # UCI
        }

        try:
            # Get compliance period ID
            lcfs_cursor.execute(
                "SELECT compliance_period_id FROM compliance_period WHERE description = %s",
                (compliance_period,),
            )
            compliance_period_row = lcfs_cursor.fetchone()
            if not compliance_period_row:
                logger.warning(f"No compliance period found for '{compliance_period}'")
                return result
            compliance_period_id = compliance_period_row[0]

            # Get fuel type details
            lcfs_cursor.execute(
                "SELECT unrecognized, default_carbon_intensity FROM fuel_type WHERE fuel_type_id = %s",
                (fuel_type_id,),
            )
            fuel_type_row = lcfs_cursor.fetchone()
            if not fuel_type_row:
                logger.warning(f"No fuel type found for ID {fuel_type_id}")
                return result
            is_unrecognized, default_ci = fuel_type_row

            # Get energy density for this fuel type and compliance period
            lcfs_cursor.execute(
                """
                SELECT density FROM energy_density 
                WHERE fuel_type_id = %s AND compliance_period_id <= %s 
                ORDER BY compliance_period_id DESC LIMIT 1
            """,
                (fuel_type_id, compliance_period_id),
            )
            energy_density_row = lcfs_cursor.fetchone()
            if energy_density_row:
                result["energy_density"] = float(energy_density_row[0])

            # Get effective carbon intensity (RCI)
            if fuel_code_id:
                # Use fuel code carbon intensity if available
                lcfs_cursor.execute(
                    "SELECT carbon_intensity FROM fuel_code WHERE fuel_code_id = %s",
                    (fuel_code_id,),
                )
                fuel_code_row = lcfs_cursor.fetchone()
                if fuel_code_row:
                    result["effective_carbon_intensity"] = float(fuel_code_row[0])

            if not result["effective_carbon_intensity"]:
                if is_unrecognized:
                    # Use category carbon intensity for unrecognized fuels
                    lcfs_cursor.execute(
                        """
                        SELECT cci.category_carbon_intensity 
                        FROM category_carbon_intensity cci
                        WHERE cci.fuel_category_id = %s AND cci.compliance_period_id = %s
                    """,
                        (fuel_category_id, compliance_period_id),
                    )
                    category_ci_row = lcfs_cursor.fetchone()
                    if category_ci_row:
                        result["effective_carbon_intensity"] = float(category_ci_row[0])
                else:
                    # Use default carbon intensity from fuel type
                    if default_ci:
                        result["effective_carbon_intensity"] = float(default_ci)

            # Get target carbon intensity (TCI)
            lcfs_cursor.execute(
                """
                SELECT target_carbon_intensity 
                FROM target_carbon_intensity 
                WHERE fuel_category_id = %s AND compliance_period_id = %s
            """,
                (fuel_category_id, compliance_period_id),
            )
            tci_row = lcfs_cursor.fetchone()
            if tci_row:
                result["target_ci"] = float(tci_row[0])

            # Get energy effectiveness ratio (EER)
            if end_use_id:
                lcfs_cursor.execute(
                    """
                    SELECT ratio FROM energy_effectiveness_ratio 
                    WHERE fuel_type_id = %s AND fuel_category_id = %s 
                    AND compliance_period_id = %s AND end_use_type_id = %s
                """,
                    (fuel_type_id, fuel_category_id, compliance_period_id, end_use_id),
                )
                eer_row = lcfs_cursor.fetchone()
                if eer_row:
                    result["eer"] = float(eer_row[0])

            # Get additional carbon intensity (UCI)
            if end_use_id:
                lcfs_cursor.execute(
                    """
                    SELECT intensity FROM additional_carbon_intensity 
                    WHERE fuel_type_id = %s AND end_use_type_id = %s 
                    AND compliance_period_id = %s
                """,
                    (fuel_type_id, end_use_id, compliance_period_id),
                )
                uci_row = lcfs_cursor.fetchone()
                if uci_row:
                    result["uci"] = float(uci_row[0])

        except Exception as e:
            logger.error(f"Error getting standardized fuel data: {e}")

        return result

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
        """Process a single Schedule B record for fuel supply"""
        try:
            # Get unit of measure
            unit_of_measure = None
            if use_snapshot:
                # For snapshot data, get the original unit_of_measure from _full_record
                if "_full_record" in record:
                    unit_of_measure = record["_full_record"].get("unit_of_measure")
                else:
                    unit_of_measure = record.get("unit_of_measure")
            else:
                # For other data sources, use 'units' field
                unit_of_measure = record.get("units")

            unit_full_form = (
                self.unit_mapping.get(unit_of_measure, unit_of_measure)
                if unit_of_measure
                else None
            )

            # Get provision of the act
            provision_act_description = None
            if use_snapshot:
                # For snapshot data, provision info is in provision_of_the_act_description field
                provision_act_description = record.get(
                    "provision_of_the_act_description"
                )
            else:
                provision_act_description = record.get("provision_act")

            # Check if provision_act is empty, try from _full_record
            if not provision_act_description and "_full_record" in record:
                full_record_provision = record["_full_record"].get(
                    "provision_of_the_act_description"
                )
                if full_record_provision:
                    provision_act_description = full_record_provision
                else:
                    # Try the direct provision field
                    full_record_provision_direct = record["_full_record"].get(
                        "provision_of_the_act"
                    )
                    provision_act_description = full_record_provision_direct

            provision_id = self.lookup_provision_id(
                lcfs_cursor, provision_act_description
            )

            # Get end use
            end_use_value = record.get("end_use")
            end_use_id = self.lookup_end_use_id(lcfs_cursor, end_use_value)

            # Get fuel category
            fuel_category_lookup_value = None
            if use_snapshot:
                # For snapshot data, fuel category info is in fuel_class field
                fuel_category_lookup_value = record.get("fuel_class")
            else:
                fuel_category_lookup_value = record.get("fuel_category")

            # Check if fuel_category is empty, try fuel_class from _full_record as fallback
            if not fuel_category_lookup_value and "_full_record" in record:
                fuel_class = record["_full_record"].get("fuel_class")
                fuel_category_lookup_value = fuel_class

            fuel_category_id = self.lookup_fuel_category_id(
                lcfs_cursor, fuel_category_lookup_value
            )

            # Get fuel code - Updated logic to handle TFRS numeric fuel codes
            fuel_code_id = None
            if use_snapshot:
                # For snapshot data, TFRS has numeric fuel_code that needs lookup
                tfrs_fuel_code_id = record.get("fuel_code")
                if tfrs_fuel_code_id:
                    try:
                        # Look up the full fuel code details from TFRS
                        with get_source_connection() as tfrs_conn:
                            tfrs_cursor = tfrs_conn.cursor()
                            tfrs_cursor.execute(
                                """
                                SELECT fuel_code, fuel_code_version, fuel_code_version_minor 
                                FROM fuel_code 
                                WHERE id = %s
                                """,
                                (tfrs_fuel_code_id,),
                            )
                            tfrs_fuel_result = tfrs_cursor.fetchone()

                            if tfrs_fuel_result:
                                base_code, version, minor = tfrs_fuel_result
                                # Construct the full fuel code (e.g., BCLCF236.1)
                                full_fuel_code = f"{base_code}{version}.{minor}"

                                # Now look up this fuel code in LCFS
                                fuel_code_id = self.lookup_fuel_code_by_full_code(
                                    lcfs_cursor, full_fuel_code
                                )

                                if fuel_code_id:
                                    logger.debug(
                                        f"Found LCFS fuel_code_id {fuel_code_id} for TFRS fuel code {full_fuel_code}"
                                    )
                                else:
                                    logger.warning(
                                        f"Could not find LCFS fuel code for {full_fuel_code}"
                                    )
                            else:
                                logger.warning(
                                    f"Could not find TFRS fuel code details for ID {tfrs_fuel_code_id}"
                                )
                    except Exception as e:
                        logger.error(
                            f"Error looking up TFRS fuel code {tfrs_fuel_code_id}: {e}"
                        )

                # Fallback: try the old logic for fuel_code_description
                if not fuel_code_id:
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

            # Handle compliance units from TFRS data
            compliance_units = None
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
            else:
                # SQL fallback
                compliance_units = self.safe_get_number(
                    record, "compliance_units", use_snapshot, legacy_id
                )

            # Get standardized fuel data from LCFS fuel code lookup system
            # This will populate the derived fields (RCI, TCI, EER, energy density, UCI)
            standardized_data = None
            if fuel_type_id and fuel_category_id:
                # Get compliance period from the record context
                compliance_period = "2023"  # Default, should be determined from report
                try:
                    # Try to get the compliance period from the compliance report
                    lcfs_cursor.execute(
                        """
                        SELECT cp.description 
                        FROM compliance_report cr
                        JOIN compliance_period cp ON cr.compliance_period_id = cp.compliance_period_id
                        WHERE cr.compliance_report_id = %s
                    """,
                        (compliance_report_id,),
                    )
                    period_row = lcfs_cursor.fetchone()
                    if period_row:
                        compliance_period = period_row[0]
                except Exception as e:
                    logger.warning(f"Could not get compliance period: {e}")

                standardized_data = self.get_standardized_fuel_data(
                    lcfs_cursor=lcfs_cursor,
                    fuel_type_id=fuel_type_id,
                    fuel_category_id=fuel_category_id,
                    end_use_id=end_use_id,
                    compliance_period=compliance_period,
                    fuel_code_id=fuel_code_id,
                    provision_id=provision_id,
                )

            # Use standardized data if available, otherwise fallback to TFRS values
            if standardized_data:
                ci_of_fuel = standardized_data.get("effective_carbon_intensity")
                target_ci = standardized_data.get("target_ci")
                eer = standardized_data.get("eer") or 1.0
                energy_density = standardized_data.get("energy_density")
                uci = standardized_data.get("uci")

                # Calculate energy content if we have energy density and quantity
                energy_content = None
                if energy_density and quantity:
                    energy_content = float(energy_density) * float(quantity)
            else:
                # Fallback to TFRS values if standardized lookup fails
                logger.warning(f"Using TFRS fallback values for legacy_id {legacy_id}")
                if use_snapshot:
                    # For snapshot data, use effective_carbon_intensity for all provision types
                    ci_of_fuel = self.safe_get_number(
                        record, "effective_carbon_intensity", use_snapshot, legacy_id
                    )
                else:
                    ci_of_fuel = self.safe_get_number(
                        record, "ci_of_fuel", use_snapshot, legacy_id
                    )

                target_ci = self.safe_get_number(
                    record, "target_ci", use_snapshot, legacy_id
                )
                energy_density = self.safe_get_number(
                    record, "energy_density", use_snapshot, legacy_id
                )
                eer = self.safe_get_number(record, "eer", use_snapshot, legacy_id)
                energy_content = self.safe_get_number(
                    record, "energy_content", use_snapshot, legacy_id
                )
                uci = None  # Not available in TFRS data

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
                    f"Validation failed for record in CR {legacy_id}: {', '.join(validation_errors)}"
                )
                return False

            # Insert into fuel_supply table
            insert_query = """
                INSERT INTO fuel_supply (
                    compliance_report_id, fuel_category_id, fuel_type_id, provision_of_the_act_id,
                    fuel_code_id, end_use_id, fuel_type_other,
                    quantity, units, ci_of_fuel, energy_density,
                    eer, uci, energy, compliance_units, target_ci, create_date, update_date,
                    create_user, update_user, group_uuid, version
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
            """

            # Extract "other" fields - only use fuel_type_other since that's the only one that exists
            fuel_type_other = record.get("fuel_type_other")

            lcfs_cursor.execute(
                insert_query,
                (
                    compliance_report_id,
                    fuel_category_id,
                    fuel_type_id,
                    provision_id,
                    fuel_code_id,
                    end_use_id,
                    fuel_type_other,
                    quantity,
                    unit_full_form,
                    ci_of_fuel,
                    energy_density,
                    eer,
                    uci,
                    energy_content,
                    compliance_units,
                    target_ci,
                    None,  # create_date
                    None,  # update_date
                    "ETL",  # create_user
                    "ETL",  # update_user
                    group_uuid,
                    version,
                ),
            )

            return True

        except Exception as e:
            logger.error(f"Error inserting fuel supply record for CR {legacy_id}: {e}")
            return False

    def get_fuel_supply_records_for_report(
        self, tfrs_cursor, legacy_id: int
    ) -> List[Dict]:
        """Get all fuel supply records for a specific TFRS compliance report"""
        records = []

        # Try to get snapshot data first
        snapshot_data = self.fetch_snapshot_data(tfrs_cursor, legacy_id)

        if (
            snapshot_data
            and snapshot_data is not None
            and "schedule_b" in snapshot_data
            and snapshot_data["schedule_b"] is not None
            and "records" in snapshot_data["schedule_b"]
        ):
            # Use snapshot data
            raw_records = snapshot_data["schedule_b"]["records"]
            logger.info(
                f"Found {len(raw_records)} raw records in snapshot for legacy_id {legacy_id}"
            )

            for i, record in enumerate(raw_records):
                logger.debug(
                    f"Processing record {i+1}: fuel_type={record.get('fuel_type')}, fuel_category={record.get('fuel_category')}, quantity={record.get('quantity')}"
                )
                normalized_record = self.normalize_tfrs_record(record)
                if normalized_record:
                    records.append(normalized_record)
                    logger.debug(f"Record {i+1} normalized successfully")
                else:
                    logger.warning(f"Record {i+1} failed normalization and was skipped")
        else:
            # Fall back to SQL query
            logger.info(
                f"No snapshot data available for legacy_id {legacy_id}, using SQL fallback"
            )
            sql_records = self.fetch_sql_fallback_data(tfrs_cursor, legacy_id)
            for record in sql_records:
                normalized_record = self.normalize_tfrs_record(record)
                if normalized_record:
                    records.append(normalized_record)

        logger.info(
            f"Final count: {len(records)} processed records for legacy_id {legacy_id}"
        )
        return records

    def normalize_tfrs_record(self, record: Dict) -> Optional[Dict]:
        """Normalize TFRS record fields to standard format for comparison"""
        if not record:
            return None

        # Handle fuel_code - preserve numeric fuel code from TFRS
        fuel_code = ""
        # For TFRS data, preserve the numeric fuel_code if it exists
        if record.get("fuel_code"):
            fuel_code = str(record.get("fuel_code"))
        else:
            # Fallback: try to build from prefix/suffix if available
            fuel_code_prefix = record.get("fuel_code_prefix", "") or ""
            fuel_code_suffix = record.get("fuel_code_suffix", "") or ""
            if fuel_code_prefix and fuel_code_suffix:
                fuel_code = f"{fuel_code_prefix}.{fuel_code_suffix}"
            elif fuel_code_prefix:
                fuel_code = fuel_code_prefix
            elif fuel_code_suffix:
                fuel_code = fuel_code_suffix

        return {
            "fuel_type": str(record.get("fuel_type", "")).strip(),
            "fuel_category": str(record.get("fuel_category", "")).strip(),
            "provision_of_the_act": str(record.get("provision_act", "")).strip(),
            "fuel_code": fuel_code.strip(),
            "end_use": str(record.get("end_use", "")).strip(),
            "ci_of_fuel": str(record.get("ci_of_fuel", "")).strip(),
            "quantity": str(record.get("quantity", "")).strip(),
            "units": str(record.get("unit_of_measure", "")).strip(),
            "compliance_units": str(record.get("compliance_units", "")).strip(),
            "target_ci": str(record.get("target_ci", "")).strip(),
            "energy_density": str(record.get("energy_density", "")).strip(),
            "eer": str(record.get("eer", "")).strip(),
            "energy_content": str(record.get("energy_content", "")).strip(),
            # Include the full record for processing
            "_full_record": record,
        }

    def insert_fuel_supply_record(
        self,
        lcfs_cursor,
        record_data: Dict,
        compliance_report_id: int,
        group_uuid: str,
        version: int,
    ) -> bool:
        """Insert a fuel supply record into LCFS database with proper error handling"""
        try:
            # Get the full record data
            full_record = record_data.get("_full_record", record_data)

            # Process the record using existing logic
            return self.process_schedule_b_record(
                full_record,
                True,  # from_snapshot
                compliance_report_id,
                0,  # legacy_id (not used in new logic)
                group_uuid,
                version,
                "CREATE" if version == 1 else "UPDATE",
                lcfs_cursor,
            )
        except Exception as e:
            logger.error(f"Failed to insert fuel supply record: {e}")
            # Don't fail the entire migration for one record
            return False

    def migrate(self) -> Tuple[int, int]:
        """Migrate fuel supply data from TFRS to LCFS with proper independent record versioning"""
        # Initialize tracking variables
        logical_records = {}
        processed_count = 0
        total_count = 0
        total_reports_processed = 0
        total_records_found = 0
        total_records_processed = 0
        total_records_skipped = 0
        total_errors = 0
        reports_with_no_records = 0

        try:
            # Step 1: Setup - Clear existing data and load mappings
            self._setup_migration()

            # Step 2: Get compliance reports list
            compliance_reports = self._get_compliance_reports()
            logger.info(
                f"Found {len(compliance_reports)} compliance reports to process"
            )

            # Step 3: Process each compliance report
            for report_data in compliance_reports:
                compliance_report_id, legacy_id, org_id, period_id, version = (
                    report_data
                )
                total_reports_processed += 1

                logger.info(
                    f"Processing CR {compliance_report_id} (legacy {legacy_id}), org {org_id}, period {period_id}, version {version}"
                )

                try:
                    # Process this compliance report
                    report_stats = self._process_single_compliance_report(
                        compliance_report_id, legacy_id, logical_records
                    )

                    # Update counters
                    total_records_found += report_stats["records_found"]
                    total_count += report_stats["records_found"]
                    processed_count += report_stats["records_processed"]
                    total_records_processed += report_stats["records_processed"]
                    total_records_skipped += report_stats["records_skipped"]
                    total_errors += report_stats["errors"]

                    if report_stats["records_found"] == 0:
                        reports_with_no_records += 1

                except Exception as e:
                    total_errors += 1
                    logger.error(
                        f"Error processing compliance report {compliance_report_id}: {e}"
                    )
                    continue

            # Enhanced summary logging
            logger.info("=== MIGRATION SUMMARY ===")
            logger.info(f"Compliance Reports Found: {len(compliance_reports)}")
            logger.info(f"Compliance Reports Processed: {total_reports_processed}")
            logger.info(
                f"Compliance Reports with No Records: {reports_with_no_records}"
            )
            logger.info(f"Total TFRS Records Found: {total_records_found}")
            logger.info(f"Records Successfully Processed: {total_records_processed}")
            logger.info(f"Records Skipped: {total_records_skipped}")
            logger.info(f"Errors Encountered: {total_errors}")
            logger.info(f"Unique Logical Records Created: {len(logical_records)}")
            logger.info(f"LCFS Record Versions Created: {processed_count}")
            logger.info("=========================")

            return processed_count, total_count

        except Exception as e:
            logger.error(f"Migration failed: {e}")
            raise

    def _setup_migration(self):
        """Setup the migration by clearing existing data and loading mappings"""
        with get_destination_connection() as lcfs_conn:
            lcfs_cursor = lcfs_conn.cursor()
            try:
                # Load mappings first
                self.load_mappings(lcfs_cursor)
                # Clear existing fuel supply data
                logger.info("About to clear existing fuel supply data...")
                lcfs_cursor.execute("DELETE FROM fuel_supply")
                logger.info("Successfully cleared existing fuel supply data")
                lcfs_conn.commit()
                logger.info("Setup completed successfully")
            except Exception as e:
                logger.error(f"Failed during setup: {e}")
                lcfs_conn.rollback()
                raise
            finally:
                lcfs_cursor.close()

    def _get_compliance_reports(self):
        """Get the list of compliance reports to process"""
        with get_destination_connection() as lcfs_conn:
            lcfs_cursor = lcfs_conn.cursor()
            try:
                return self.get_compliance_reports_chronological(lcfs_cursor)
            finally:
                lcfs_cursor.close()

    def _process_single_compliance_report(
        self, compliance_report_id, legacy_id, logical_records
    ):
        """Process a single compliance report and return statistics"""
        stats = {
            "records_found": 0,
            "records_processed": 0,
            "records_skipped": 0,
            "errors": 0,
        }

        # Use separate connections for TFRS and LCFS
        with get_source_connection() as tfrs_conn, get_destination_connection() as lcfs_conn:
            tfrs_cursor = tfrs_conn.cursor()
            lcfs_cursor = lcfs_conn.cursor()

            try:
                # Get fuel supply records for this compliance report
                report_records = self.get_fuel_supply_records_for_report(
                    tfrs_cursor, legacy_id
                )
                stats["records_found"] = len(report_records)
                logger.info(
                    f"Successfully fetched {len(report_records)} records for legacy_id {legacy_id}"
                )

                # Process each fuel supply record
                for record in report_records:
                    try:
                        # Process individual record
                        if self._process_individual_record(
                            record, compliance_report_id, logical_records, lcfs_cursor
                        ):
                            stats["records_processed"] += 1
                        else:
                            stats["records_skipped"] += 1
                    except Exception as e:
                        stats["errors"] += 1
                        logger.error(f"Error processing individual record: {e}")
                        continue

                # Commit the transaction for this compliance report
                lcfs_conn.commit()

            except Exception as e:
                stats["errors"] += 1
                logger.error(f"Failed to process compliance report {legacy_id}: {e}")
                lcfs_conn.rollback()
                raise
            finally:
                tfrs_cursor.close()
                lcfs_cursor.close()

        return stats

    def _process_individual_record(
        self, record, compliance_report_id, logical_records, lcfs_cursor
    ):
        """Process an individual fuel supply record"""
        # Generate logical record key
        record_key = self.generate_logical_record_key(record)

        # Normalize record data
        normalized_data = self.normalize_tfrs_record(record)
        if not normalized_data:
            logger.debug("Skipped record due to normalization failure")
            return False

        if record_key not in logical_records:
            # First time seeing this logical record
            group_uuid = str(uuid.uuid4())
            version_num = 1
            logger.debug(f"Creating new logical record with key: {record_key}")

            # Insert version 1 of this logical record
            if self.insert_fuel_supply_record(
                lcfs_cursor,
                normalized_data,
                compliance_report_id,
                group_uuid,
                version_num,
            ):
                # Track this logical record
                logical_records[record_key] = {
                    "group_uuid": group_uuid,
                    "current_version": version_num,
                    "last_data": normalized_data,
                }
                return True
            else:
                return False
        else:
            # This logical record already exists
            logical_record = logical_records[record_key]
            logger.debug(f"Found existing logical record with key: {record_key}")

            # Compare with previous version
            if self.records_are_different(normalized_data, logical_record["last_data"]):
                # Record changed - create new version
                new_version = logical_record["current_version"] + 1
                logger.debug(
                    f"Creating new version {new_version} for logical record: {record_key}"
                )

                if self.insert_fuel_supply_record(
                    lcfs_cursor,
                    normalized_data,
                    compliance_report_id,
                    logical_record["group_uuid"],
                    new_version,
                ):
                    # Update tracking
                    logical_record["current_version"] = new_version
                    logical_record["last_data"] = normalized_data
                    return True
                else:
                    logger.debug(
                        f"Failed to insert new version for logical record: {record_key}"
                    )
                    return False
            else:
                # Record unchanged
                logger.debug(f"Record unchanged for logical record: {record_key}")
                return False

    def get_compliance_reports_chronological(self, lcfs_cursor) -> List[Tuple]:
        """Get compliance reports ordered chronologically (original first, supplementals in order)"""
        lcfs_cursor.execute(
            """
            SELECT 
                cr.compliance_report_id,
                cr.legacy_id,
                cr.organization_id,
                cr.compliance_period_id,
                cr.version
            FROM compliance_report cr
            WHERE cr.legacy_id IS NOT NULL
            ORDER BY cr.organization_id, cr.compliance_period_id, cr.version
        """
        )
        return lcfs_cursor.fetchall()

    def generate_logical_record_key(self, record: Dict) -> str:
        """Generate a stable key that identifies a logical fuel supply record across compliance reports

        This key represents the business identity of a fuel supply record, independent of
        which compliance report version it appears in.
        """
        # Use business identifiers that define a unique logical fuel supply record
        key_parts = [
            str(record.get("fuel_type", "")).strip(),
            str(record.get("fuel_category", "")).strip(),
            str(record.get("provision_act", "")).strip(),
            str(record.get("fuel_code_prefix", "")).strip(),
            str(record.get("fuel_code_suffix", "")).strip(),
            str(record.get("end_use", "")).strip(),
            # Add other business identifiers that make a record unique
            str(record.get("fuel_type_other", "")).strip(),
        ]
        return "|".join(key_parts)

    def records_are_different(self, new_data: Dict, old_data: Dict) -> bool:
        """Check if the data content of a logical record has changed"""
        # Compare the meaningful data fields (excluding metadata)
        data_fields = [
            "quantity",
            "units",
            "ci_of_fuel",
            "compliance_units",
            "target_ci",
            "energy_density",
            "eer",
            "energy_content",
        ]

        for field in data_fields:
            new_val = str(new_data.get(field, "")).strip()
            old_val = str(old_data.get(field, "")).strip()
            if new_val != old_val:
                return True

        return False

    def get_standardized_fuel_data(
        self,
        lcfs_cursor,
        fuel_type_id: int,
        fuel_category_id: int,
        end_use_id: int,
        compliance_period: str,
        fuel_code_id: Optional[int] = None,
        provision_id: Optional[int] = None,
    ) -> Dict[str, Optional[float]]:
        """
        Fetch standardized fuel data similar to LCFS backend logic.
        Returns calculated values for RCI, TCI, EER, energy_density, UCI.
        """
        result = {
            "effective_carbon_intensity": None,  # RCI
            "target_ci": None,  # TCI
            "eer": 1.0,  # EER (default to 1.0)
            "energy_density": None,  # Energy Density
            "uci": None,  # UCI
        }

        try:
            # Get compliance period ID
            lcfs_cursor.execute(
                "SELECT compliance_period_id FROM compliance_period WHERE description = %s",
                (compliance_period,),
            )
            compliance_period_row = lcfs_cursor.fetchone()
            if not compliance_period_row:
                logger.warning(f"No compliance period found for '{compliance_period}'")
                return result
            compliance_period_id = compliance_period_row[0]

            # Get fuel type details
            lcfs_cursor.execute(
                "SELECT unrecognized, default_carbon_intensity FROM fuel_type WHERE fuel_type_id = %s",
                (fuel_type_id,),
            )
            fuel_type_row = lcfs_cursor.fetchone()
            if not fuel_type_row:
                logger.warning(f"No fuel type found for ID {fuel_type_id}")
                return result
            is_unrecognized, default_ci = fuel_type_row

            # Get energy density for this fuel type and compliance period
            lcfs_cursor.execute(
                """
                SELECT density FROM energy_density 
                WHERE fuel_type_id = %s AND compliance_period_id <= %s 
                ORDER BY compliance_period_id DESC LIMIT 1
            """,
                (fuel_type_id, compliance_period_id),
            )
            energy_density_row = lcfs_cursor.fetchone()
            if energy_density_row:
                result["energy_density"] = float(energy_density_row[0])

            # Get effective carbon intensity (RCI)
            if fuel_code_id:
                # Use fuel code carbon intensity if available
                lcfs_cursor.execute(
                    "SELECT carbon_intensity FROM fuel_code WHERE fuel_code_id = %s",
                    (fuel_code_id,),
                )
                fuel_code_row = lcfs_cursor.fetchone()
                if fuel_code_row:
                    result["effective_carbon_intensity"] = float(fuel_code_row[0])

            if not result["effective_carbon_intensity"]:
                if is_unrecognized:
                    # Use category carbon intensity for unrecognized fuels
                    lcfs_cursor.execute(
                        """
                        SELECT cci.category_carbon_intensity 
                        FROM category_carbon_intensity cci
                        WHERE cci.fuel_category_id = %s AND cci.compliance_period_id = %s
                    """,
                        (fuel_category_id, compliance_period_id),
                    )
                    category_ci_row = lcfs_cursor.fetchone()
                    if category_ci_row:
                        result["effective_carbon_intensity"] = float(category_ci_row[0])
                else:
                    # Use default carbon intensity from fuel type
                    if default_ci:
                        result["effective_carbon_intensity"] = float(default_ci)

            # Get target carbon intensity (TCI)
            lcfs_cursor.execute(
                """
                SELECT target_carbon_intensity 
                FROM target_carbon_intensity 
                WHERE fuel_category_id = %s AND compliance_period_id = %s
            """,
                (fuel_category_id, compliance_period_id),
            )
            tci_row = lcfs_cursor.fetchone()
            if tci_row:
                result["target_ci"] = float(tci_row[0])

            # Get energy effectiveness ratio (EER)
            if end_use_id:
                lcfs_cursor.execute(
                    """
                    SELECT ratio FROM energy_effectiveness_ratio 
                    WHERE fuel_type_id = %s AND fuel_category_id = %s 
                    AND compliance_period_id = %s AND end_use_type_id = %s
                """,
                    (fuel_type_id, fuel_category_id, compliance_period_id, end_use_id),
                )
                eer_row = lcfs_cursor.fetchone()
                if eer_row:
                    result["eer"] = float(eer_row[0])

            # Get additional carbon intensity (UCI)
            if end_use_id:
                lcfs_cursor.execute(
                    """
                    SELECT intensity FROM additional_carbon_intensity 
                    WHERE fuel_type_id = %s AND end_use_type_id = %s 
                    AND compliance_period_id = %s
                """,
                    (fuel_type_id, end_use_id, compliance_period_id),
                )
                uci_row = lcfs_cursor.fetchone()
                if uci_row:
                    result["uci"] = float(uci_row[0])

        except Exception as e:
            logger.error(f"Error getting standardized fuel data: {e}")

        return result


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
