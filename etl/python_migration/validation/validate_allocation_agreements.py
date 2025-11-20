"""
Allocation Agreement validation script for TFRS to LCFS migration.
"""

from typing import Dict, Any, List
from .validation_base import BaseValidator
from core.database import get_source_connection, get_destination_connection


class AllocationAgreementValidator(BaseValidator):
    """Validator for allocation agreement migration."""

    def get_validation_name(self) -> str:
        return "Allocation Agreement"

    def validate(self) -> Dict[str, Any]:
        """Run allocation agreement validation."""
        results = {}

        # 1. Compare record counts
        results["record_counts"] = self.compare_record_counts(
            source_query="SELECT COUNT(*) FROM compliance_report_exclusion_agreement_record",
            dest_query="SELECT COUNT(*) FROM allocation_agreement WHERE create_user = 'ETL'",
        )

        # 2. Sample validation
        results["sample_validation"] = self.validate_sample_records()

        # 3. Transaction type mapping validation
        results["transaction_type_distribution"] = self.check_transaction_type_mapping()

        # 4. NULL value checks
        results["null_checks"] = self.check_null_values(
            table_name="allocation_agreement",
            fields=[
                "fuel_type_id",
                "allocation_transaction_type_id",
                "transaction_partner",
                "quantity",
                "quantity_not_sold",
            ],
            where_clause="WHERE create_user = 'ETL'",
        )

        # 5. Version chain validation
        results["version_chains"] = self.validate_version_chains(
            table_name="allocation_agreement",
            where_clause="WHERE create_user = 'ETL'",
        )

        # 6. Action type distribution
        results["action_type_distribution"] = self.check_action_type_distribution()

        # 7. New period impact check
        results["new_period_impact"] = self.check_new_period_allocation_impact()

        return results

    def validate_sample_records(self) -> Dict[str, int]:
        """Validate a sample of records for data integrity."""
        sample_size = 10

        source_query = """
            SELECT 
                crear.id AS agreement_record_id,
                cr.id AS cr_legacy_id,
                CASE WHEN tt.the_type = 'Purchased' THEN 'Allocated from' ELSE 'Allocated to' END AS responsibility,
                aft.name AS fuel_type,
                crear.transaction_partner,
                crear.postal_address,
                crear.quantity,
                crear.quantity_not_sold
            FROM compliance_report cr
            JOIN compliance_report_exclusion_agreement crea ON cr.exclusion_agreement_id = crea.id
            JOIN compliance_report_exclusion_agreement_record crear ON crear.exclusion_agreement_id = crea.id
            JOIN transaction_type tt ON crear.transaction_type_id = tt.id
            JOIN approved_fuel_type aft ON crear.fuel_type_id = aft.id
            WHERE cr.exclusion_agreement_id IS NOT NULL
            ORDER BY cr.id
            LIMIT %s
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
                            _, legacy_id, _, fuel_type, partner, _, quantity, _ = record

                            dest_query = """
                                SELECT aa.*, cr.legacy_id, ft.fuel_type, att.type AS allocation_type
                                FROM allocation_agreement aa
                                JOIN compliance_report cr ON cr.compliance_report_id = aa.compliance_report_id
                                JOIN fuel_type ft ON ft.fuel_type_id = aa.fuel_type_id
                                JOIN allocation_transaction_type att ON att.allocation_transaction_type_id = aa.allocation_transaction_type_id
                                WHERE cr.legacy_id = %s
                                AND aa.transaction_partner = %s
                                AND ABS(aa.quantity - %s) < 0.01
                                AND ft.fuel_type = %s
                                LIMIT 1
                            """

                            dest_cursor.execute(
                                dest_query, (legacy_id, partner, quantity, fuel_type)
                            )
                            if dest_cursor.fetchone():
                                match_count += 1
                                self.logger.info(
                                    f"✓ Record for compliance report {legacy_id}, partner {partner} matches"
                                )
                            else:
                                self.logger.info(
                                    f"✗ No match found for compliance report {legacy_id}, partner {partner}"
                                )

        return {"matches": match_count, "total": total_count}

    def check_transaction_type_mapping(self) -> List[Dict[str, Any]]:
        """Check allocation transaction type mapping integrity."""
        query = """
            SELECT att.type, COUNT(*) AS count
            FROM allocation_agreement aa
            JOIN allocation_transaction_type att ON att.allocation_transaction_type_id = aa.allocation_transaction_type_id
            WHERE aa.create_user = 'ETL'
            GROUP BY att.type
            ORDER BY count DESC
        """

        distribution = []
        with get_destination_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                results = cursor.fetchall()

                self.logger.info("\nAllocation transaction type distribution:")
                for type_name, count in results:
                    self.logger.info(f"{type_name}: {count} records")
                    distribution.append({"type": type_name, "count": count})

        return distribution

    def check_action_type_distribution(self) -> List[Dict[str, Any]]:
        """Check action type distribution."""
        query = """
            SELECT action_type, COUNT(*) as count
            FROM allocation_agreement
            WHERE create_user = 'ETL'
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

    def check_new_period_allocation_impact(self) -> int:
        """Check if new-period allocation agreement records were impacted."""
        query = """
            SELECT COUNT(*) as count
            FROM allocation_agreement aa
            JOIN compliance_report cr ON cr.compliance_report_id = aa.compliance_report_id
            WHERE aa.create_user != 'ETL'
            AND EXISTS (
                SELECT 1 FROM allocation_agreement aa2
                WHERE aa2.group_uuid = aa.group_uuid
                AND aa2.create_user = 'ETL'
            )
        """

        with get_destination_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                return cursor.fetchone()[0]


if __name__ == "__main__":
    validator = AllocationAgreementValidator()
    results = validator.run_validation()
