"""
Fuel Supply validation script for TFRS to LCFS migration.
"""

from typing import Dict, Any, List
from .validation_base import BaseValidator
from core.database import get_source_connection, get_destination_connection


class FuelSupplyValidator(BaseValidator):
    """Validator for fuel supply migration."""

    def get_validation_name(self) -> str:
        return "Fuel Supply"

    def validate(self) -> Dict[str, Any]:
        """Run fuel supply validation."""
        results = {}

        # 1. Validate source database structure
        self.validate_source_structure()

        # 2. Compare record counts (including GHGenius)
        results["record_counts"] = self.compare_record_counts_with_ghgenius()

        # 3. Sample validation
        results["sample_validation"] = self.validate_sample_records()

        # 4. NULL value checks
        results["null_checks"] = self.check_null_values(
            table_name="fuel_supply",
            fields=[
                "fuel_category_id",
                "fuel_type_id",
                "provision_of_the_act_id",
                "quantity",
            ],
            where_clause="WHERE create_user = 'ETL'",
        )

        # 5. Calculation consistency check
        results["calculation_validation"] = self.validate_calculations()

        # 6. GHGenius record validation
        results["ghgenius_validation"] = self.validate_ghgenius_records()

        # 7. Duplicate record check
        results["duplicate_check"] = self.check_duplicate_records()

        # 8. New period impact check
        results["new_period_impact"] = self.check_new_period_impact(
            table_name="fuel_supply fs JOIN compliance_report cr ON cr.compliance_report_id = fs.compliance_report_id",
            user_filter="",
            table_prefix="fs.",
        )

        return results

    def validate_source_structure(self):
        """Validate that required source tables exist."""
        query = """
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'compliance_report_schedule_b_record'
            ) AS table_exists
        """

        with get_source_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                table_exists = cursor.fetchone()[0]

                if not table_exists:
                    raise Exception(
                        "Table 'compliance_report_schedule_b_record' does not exist in source database"
                    )

    def compare_record_counts_with_ghgenius(self) -> Dict[str, Any]:
        """Compare record counts including GHGenius specific records."""
        # Standard record count comparison
        standard_counts = self.compare_record_counts(
            source_query="""
                SELECT COUNT(*) 
                FROM compliance_report_schedule_b_record crsbr
                JOIN compliance_report cr ON cr.schedule_b_id = crsbr.schedule_id
            """,
            dest_query="SELECT COUNT(*) FROM fuel_supply WHERE create_user = 'ETL'",
        )

        # GHGenius record count comparison
        ghgenius_source_query = """
            SELECT COUNT(*) 
            FROM compliance_report_schedule_b_record crsbr
            JOIN carbon_intensity_fuel_determination cifd 
                ON cifd.fuel_id = crsbr.fuel_type_id 
                AND cifd.provision_act_id = crsbr.provision_of_the_act_id
            JOIN determination_type dt ON dt.id = cifd.determination_type_id
            WHERE dt.the_type = 'GHGenius'
        """

        ghgenius_dest_query = """
            SELECT COUNT(*) 
            FROM fuel_supply fs
            JOIN provision_of_the_act pota ON pota.provision_of_the_act_id = fs.provision_of_the_act_id
            WHERE fs.create_user = 'ETL' 
            AND pota.name = 'GHGenius modelled - Section 6 (5) (d) (ii) (A)'
        """

        ghgenius_counts = self.compare_record_counts(
            source_query=ghgenius_source_query, dest_query=ghgenius_dest_query
        )

        self.logger.info(f"\nGHGenius specific records:")
        self.logger.info(f"GHGenius source count: {ghgenius_counts['source_count']}")
        self.logger.info(f"GHGenius destination count: {ghgenius_counts['dest_count']}")
        self.logger.info(f"GHGenius difference: {ghgenius_counts['difference']}")

        return {"standard": standard_counts, "ghgenius": ghgenius_counts}

    def validate_sample_records(self) -> Dict[str, int]:
        """Validate a sample of records for data integrity."""
        sample_size = 10

        source_query = """
            WITH schedule_b AS (
                SELECT crsbr.id as fuel_supply_id,
                    cr.id as cr_legacy_id,
                    crsbr.quantity,
                    uom.name as unit_of_measure,
                    fc.fuel_class as fuel_category,
                    fc1.fuel_code as fuel_code_prefix,
                    aft.name as fuel_type,
                    CONCAT(TRIM(pa.description), ' - ', TRIM(pa.provision)) as provision_act
                FROM compliance_report_schedule_b_record crsbr
                INNER JOIN fuel_class fc ON fc.id = crsbr.fuel_class_id
                INNER JOIN approved_fuel_type aft ON aft.id = crsbr.fuel_type_id
                INNER JOIN provision_act pa ON pa.id = crsbr.provision_of_the_act_id
                INNER JOIN compliance_report cr ON cr.schedule_b_id = crsbr.schedule_id
                LEFT JOIN unit_of_measure uom ON uom.id = aft.unit_of_measure_id
                LEFT JOIN fuel_code fc1 ON fc1.id = crsbr.fuel_code_id
                ORDER BY cr.id
                LIMIT %s
            )
            SELECT * FROM schedule_b
        """

        match_count = 0
        total_count = 0

        with get_source_connection() as source_conn:
            with source_conn.cursor() as source_cursor:
                source_cursor.execute(source_query, (sample_size,))
                source_records = source_cursor.fetchall()

                with get_destination_connection() as dest_conn:
                    with dest_conn.cursor() as dest_cursor:
                        for record in source_records:
                            total_count += 1
                            _, legacy_id, quantity, _, _, _, fuel_type, _ = record

                            dest_query = """
                                SELECT fs.*, cr.legacy_id
                                FROM fuel_supply fs
                                JOIN compliance_report cr ON cr.compliance_report_id = fs.compliance_report_id
                                JOIN fuel_type ft ON ft.fuel_type_id = fs.fuel_type_id
                                WHERE cr.legacy_id = %s
                                AND ft.fuel_type = %s
                                AND ABS(fs.quantity - %s) < 0.01
                                AND fs.create_user = 'ETL'
                                LIMIT 1
                            """

                            dest_cursor.execute(
                                dest_query, (legacy_id, fuel_type, quantity)
                            )
                            if dest_cursor.fetchone():
                                match_count += 1
                                self.logger.info(
                                    f"✓ Record for compliance report {legacy_id}, fuel type {fuel_type} matches"
                                )
                            else:
                                self.logger.info(
                                    f"✗ No match found for compliance report {legacy_id}, fuel type {fuel_type}"
                                )

        return {"matches": match_count, "total": total_count}

    def validate_calculations(self) -> Dict[str, Any]:
        """Validate calculation consistency."""
        query = """
            SELECT 
                compliance_report_id,
                quantity,
                energy_density,
                energy,
                ci_of_fuel,
                target_ci,
                eer,
                compliance_units,
                ABS(energy - (quantity * energy_density)) > 0.01 as energy_calc_error,
                ABS(compliance_units - ((((target_ci * eer) - ci_of_fuel) * (energy_density * quantity)) / 1000000)) > 0.1 as compliance_unit_calc_error
            FROM fuel_supply
            WHERE create_user = 'ETL'
            LIMIT 20
        """

        energy_errors = 0
        cu_errors = 0
        total_checked = 0

        with get_destination_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                results = cursor.fetchall()

                for result in results:
                    total_checked += 1
                    energy_error = result[8]  # energy_calc_error
                    cu_error = result[9]  # compliance_unit_calc_error

                    if energy_error:
                        energy_errors += 1
                    if cu_error:
                        cu_errors += 1

        self.logger.info(f"\nCalculation validation (from 20 sample records):")
        self.logger.info(f"Energy calculation errors: {energy_errors}/{total_checked}")
        self.logger.info(
            f"Compliance units calculation errors: {cu_errors}/{total_checked}"
        )

        return {
            "energy_errors": energy_errors,
            "cu_errors": cu_errors,
            "total_checked": total_checked,
        }

    def validate_ghgenius_records(self) -> Dict[str, Any]:
        """Validate GHGenius records specifically."""
        query = """
            SELECT fs.*, pota.name AS provision_name
            FROM fuel_supply fs
            JOIN provision_of_the_act pota ON pota.provision_of_the_act_id = fs.provision_of_the_act_id
            WHERE pota.name = 'GHGenius modelled - Section 6 (5) (d) (ii) (A)'
            AND fs.create_user = 'ETL'
            LIMIT 10
        """

        ghgenius_count = 0
        ghgenius_with_ci_count = 0

        with get_destination_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                results = cursor.fetchall()

                self.logger.info(f"\nGHGenius record validation:")
                for result in results:
                    ghgenius_count += 1
                    report_id = result[1]  # compliance_report_id
                    ci_of_fuel = result[10]  # ci_of_fuel (approximate position)

                    if ci_of_fuel is not None and ci_of_fuel != 0:
                        ghgenius_with_ci_count += 1
                        self.logger.info(
                            f"✓ GHGenius record for compliance report {report_id} has CI: {ci_of_fuel}"
                        )
                    else:
                        self.logger.info(
                            f"✗ GHGenius record for compliance report {report_id} missing CI value"
                        )

        self.logger.info(
            f"Found {ghgenius_with_ci_count}/{ghgenius_count} GHGenius records with correct CI values"
        )

        return {"total_ghgenius": ghgenius_count, "with_ci": ghgenius_with_ci_count}

    def check_duplicate_records(self) -> int:
        """Check for duplicate records."""
        query = """
            SELECT compliance_report_id, fuel_type_id, quantity, COUNT(*) as count
            FROM fuel_supply
            WHERE create_user = 'ETL'
            GROUP BY compliance_report_id, fuel_type_id, quantity
            HAVING COUNT(*) > 1
            LIMIT 10
        """

        duplicate_count = 0
        with get_destination_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                results = cursor.fetchall()

                for result in results:
                    duplicate_count += 1
                    cr_id, fuel_type_id, quantity, count = result
                    self.logger.info(
                        f"Duplicate found: CR:{cr_id}, fuel_type:{fuel_type_id}, "
                        f"quantity:{quantity}, count:{count}"
                    )

        status = (
            f"{duplicate_count} duplicates found"
            if duplicate_count > 0
            else "No duplicates found"
        )
        self.logger.info(f"\nDuplicate records check: {status}")

        return duplicate_count

    def log_validation_results(self, results: Dict[str, Any]):
        """Override to handle nested record_counts structure."""
        validation_name = self.get_validation_name()
        self.logger.info(f"**** BEGIN {validation_name.upper()} VALIDATION ****")

        # Handle nested record counts structure (standard + ghgenius)
        if "record_counts" in results:
            counts = results["record_counts"]
            if "standard" in counts:
                std = counts["standard"]
                self.logger.info(f"Source record count: {std['source_count']}")
                self.logger.info(f"Destination record count: {std['dest_count']}")
                self.logger.info(f"Difference: {std['difference']}")
            else:
                # Fallback to flat structure
                self.logger.info(f"Source record count: {counts['source_count']}")
                self.logger.info(f"Destination record count: {counts['dest_count']}")
                self.logger.info(f"Difference: {counts['difference']}")

        # Sample validation
        if "sample_validation" in results:
            sample = results["sample_validation"]
            self.logger.info(
                f"Found {sample['matches']}/{sample['total']} matching records"
            )

        # NULL value checks
        if "null_checks" in results:
            self.logger.info("\nData anomalies check:")
            for field, count in results["null_checks"].items():
                self.logger.info(f"Records with {field}: {count}")

        # Version chains
        if "version_chains" in results:
            chains = results["version_chains"]
            self.logger.info(f"\nVersion chain validation:")
            if chains:
                for chain in chains:
                    self.logger.info(
                        f"Group {chain['group_uuid']}: {chain['version_count']} versions "
                        f"({chain['min_version']} to {chain['max_version']})"
                    )
            else:
                self.logger.info("No version chains found")

        # New period impact
        if "new_period_impact" in results:
            impact = results["new_period_impact"]
            self.logger.info(f"\nNew period records impacted: {impact}")
            if impact > 0:
                self.logger.error(
                    f"WARNING: {impact} records from the latest reporting period were modified by ETL process"
                )
            else:
                self.logger.info("✓ No latest reporting period records were modified")

        self.logger.info(f"**** END {validation_name.upper()} VALIDATION ****")


if __name__ == "__main__":
    validator = FuelSupplyValidator()
    results = validator.run_validation()
