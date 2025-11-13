"""
Other Uses validation script for TFRS to LCFS migration.
"""

from typing import Dict, Any, List
from .validation_base import BaseValidator
from core.database import get_source_connection, get_destination_connection


class OtherUsesValidator(BaseValidator):
    """Validator for other uses migration."""

    def get_validation_name(self) -> str:
        return "Other Uses (Schedule C)"

    def validate(self) -> Dict[str, Any]:
        """Run other uses validation."""
        results = {}

        # 1. Validate source database structure
        self.validate_source_structure()

        # 2. Compare record counts
        results["record_counts"] = self.compare_record_counts(
            source_query="SELECT COUNT(*) FROM compliance_report_schedule_c_record",
            dest_query="SELECT COUNT(*) FROM other_uses WHERE create_user::text = 'ETL'",
        )

        # Skip further validation if no destination records
        if results["record_counts"]["dest_count"] == 0:
            self.logger.info(
                "\nNo other_uses records found in destination - skipping validation checks"
            )
            return results

        # 3. Sample validation
        results["sample_validation"] = self.validate_sample_records()

        # 4. Expected use mapping validation
        results["expected_use_distribution"] = self.check_expected_use_mapping()

        # 5. NULL value checks
        results["null_checks"] = self.check_null_values(
            table_name="other_uses",
            fields=[
                "fuel_category_id",
                "fuel_type_id",
                "expected_use_id",
                "quantity_supplied",
            ],
            where_clause="WHERE create_user::text = 'ETL'",
        )

        # 6. Version chain validation
        results["version_chains"] = self.validate_version_chains(
            table_name="other_uses", where_clause="WHERE create_user::text = 'ETL'"
        )

        # 7. Action type distribution
        results["action_type_distribution"] = self.check_action_type_distribution()

        # 8. New period impact check
        results["new_period_impact"] = self.check_new_period_impact(
            table_name="other_uses ou JOIN compliance_report cr ON cr.compliance_report_id = ou.compliance_report_id",
            user_filter="",
        )

        return results

    def validate_source_structure(self):
        """Validate that required source tables exist."""
        # Check main table
        query = """
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'compliance_report_schedule_c_record'
            ) AS table_exists
        """

        with get_source_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                table_exists = cursor.fetchone()[0]

                if not table_exists:
                    raise Exception(
                        "Table 'compliance_report_schedule_c_record' does not exist in source database"
                    )

        # Check expected_use table existence
        expected_use_query = """
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'expected_use'
            ) AS table_exists
        """

        with get_source_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(expected_use_query)
                self.expected_use_table_exists = cursor.fetchone()[0]

    def validate_sample_records(self) -> Dict[str, int]:
        """Validate a sample of records for data integrity."""
        sample_size = 10

        # Build source query based on whether expected_use table exists
        base_query = """
            SELECT 
                scr.id AS schedule_c_record_id,
                cr.id AS cr_legacy_id,
                scr.quantity,
                aft.name AS fuel_type,
                fc.fuel_class AS fuel_category
        """

        if self.expected_use_table_exists:
            base_query += """,
                eu.description AS expected_use,
                scr.rationale"""
        else:
            base_query += """,
                'Other' AS expected_use,
                scr.rationale"""

        base_query += """
            FROM compliance_report_schedule_c_record scr
            JOIN compliance_report_schedule_c sc ON sc.id = scr.schedule_id
            JOIN compliance_report cr ON cr.schedule_c_id = sc.id
            JOIN approved_fuel_type aft ON aft.id = scr.fuel_type_id
            JOIN fuel_class fc ON fc.id = scr.fuel_class_id
        """

        if self.expected_use_table_exists:
            base_query += "JOIN expected_use eu ON eu.id = scr.expected_use_id"

        source_query = (
            base_query
            + """
            ORDER BY cr.id
            LIMIT %s
        """
        )

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
                            _, legacy_id, quantity, fuel_type, _, _, _ = record

                            dest_query = """
                                SELECT ou.*, cr.legacy_id, ft.fuel_type, et.name AS expected_use_type
                                FROM other_uses ou
                                JOIN compliance_report cr ON cr.compliance_report_id = ou.compliance_report_id
                                JOIN fuel_type ft ON ft.fuel_type_id = ou.fuel_type_id
                                JOIN expected_use_type et ON et.expected_use_type_id = ou.expected_use_id
                                WHERE cr.legacy_id = %s
                                AND ft.fuel_type = %s
                                AND ABS(ou.quantity_supplied - %s) < 0.01
                                AND ou.create_user::text = 'ETL'
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

    def check_expected_use_mapping(self) -> List[Dict[str, Any]]:
        """Check expected use type mapping distribution."""
        query = """
            SELECT et.name, COUNT(*) AS count
            FROM other_uses ou
            JOIN expected_use_type et ON et.expected_use_type_id = ou.expected_use_id
            WHERE ou.create_user::text = 'ETL'
            GROUP BY et.name
            ORDER BY count DESC
        """

        distribution = []
        with get_destination_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                results = cursor.fetchall()

                self.logger.info("\nExpected use mapping distribution:")
                for use_type, count in results:
                    self.logger.info(f"{use_type}: {count} records")
                    distribution.append({"expected_use": use_type, "count": count})

        return distribution

    def check_action_type_distribution(self) -> List[Dict[str, Any]]:
        """Check action type distribution."""
        query = """
            SELECT action_type::text, COUNT(*) as count
            FROM other_uses
            WHERE create_user::text = 'ETL'
            GROUP BY action_type
        """

        distribution = []
        with get_destination_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                results = cursor.fetchall()

                self.logger.info("\nAction type distribution:")
                for action_type, count in results:
                    self.logger.info(f"{action_type}: {count} records")
                    distribution.append({"action_type": action_type, "count": count})

        return distribution


if __name__ == "__main__":
    validator = OtherUsesValidator()
    results = validator.run_validation()
