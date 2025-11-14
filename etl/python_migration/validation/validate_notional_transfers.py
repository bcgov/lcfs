"""
Notional Transfer validation script for TFRS to LCFS migration.
"""

from typing import Dict, Any, List
from .validation_base import BaseValidator
from core.database import get_source_connection, get_destination_connection


class NotionalTransferValidator(BaseValidator):
    """Validator for notional transfer migration."""

    def get_validation_name(self) -> str:
        return "Notional Transfer"

    def validate(self) -> Dict[str, Any]:
        """Run notional transfer validation."""
        results = {}

        # 1. Compare record counts
        results["record_counts"] = self.compare_record_counts(
            source_query="SELECT COUNT(*) FROM compliance_report_schedule_a_record",
            dest_query="SELECT COUNT(*) FROM notional_transfer WHERE user_type::text = 'SUPPLIER'",
        )

        # 2. Sample validation
        results["sample_validation"] = self.validate_sample_records()

        # 3. NULL value checks
        results["null_checks"] = self.check_null_values(
            table_name="notional_transfer",
            fields=[
                "fuel_category_id",
                "legal_name",
                "received_or_transferred",
                "quantity",
            ],
            where_clause="WHERE user_type::text = 'SUPPLIER'",
        )

        # 4. Transfer type mapping validation
        results["transfer_type_distribution"] = self.check_transfer_type_mapping()

        # 5. Version chain validation
        results["version_chains"] = self.validate_version_chains(
            table_name="notional_transfer",
            where_clause="WHERE user_type::text = 'SUPPLIER'",
        )

        # 6. Duplicate record check
        results["duplicate_check"] = self.check_duplicate_records()

        # 7. New period impact check
        results["new_period_impact"] = self.check_new_period_notional_impact()

        return results

    def validate_sample_records(self) -> Dict[str, int]:
        """Validate a sample of records for data integrity."""
        sample_size = 10

        source_query = """
            SELECT 
                sar.id AS schedule_a_record_id,
                cr.id AS cr_legacy_id,
                sar.quantity,
                sar.trading_partner,
                sar.postal_address,
                fc.fuel_class AS fuel_category,
                CASE 
                    WHEN sar.transfer_type_id = 1 THEN 'Received'
                    ELSE 'Transferred' 
                END AS transfer_type
            FROM compliance_report_schedule_a_record sar
            JOIN compliance_report_schedule_a sa ON sa.id = sar.schedule_id
            JOIN compliance_report cr ON cr.schedule_a_id = sa.id
            JOIN fuel_class fc ON fc.id = sar.fuel_class_id
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
                            (
                                _,
                                legacy_id,
                                quantity,
                                trading_partner,
                                _,
                                _,
                                transfer_type,
                            ) = record

                            dest_query = """
                                SELECT nt.*, cr.legacy_id
                                FROM notional_transfer nt
                                JOIN compliance_report cr ON cr.compliance_report_id = nt.compliance_report_id
                                WHERE cr.legacy_id = %s
                                AND nt.legal_name = %s
                                AND ABS(nt.quantity - %s) < 0.01
                                AND nt.received_or_transferred::text = %s
                                LIMIT 1
                            """

                            dest_cursor.execute(
                                dest_query,
                                (legacy_id, trading_partner, quantity, transfer_type),
                            )
                            if dest_cursor.fetchone():
                                match_count += 1
                                self.logger.info(
                                    f"✓ Record for compliance report {legacy_id}, partner {trading_partner} matches"
                                )
                            else:
                                self.logger.info(
                                    f"✗ No match found for compliance report {legacy_id}, partner {trading_partner}"
                                )

        return {"matches": match_count, "total": total_count}

    def check_transfer_type_mapping(self) -> List[Dict[str, Any]]:
        """Verify transfer type mapping."""
        query = """
            SELECT received_or_transferred::text, COUNT(*) as count
            FROM notional_transfer
            WHERE user_type::text = 'SUPPLIER'
            GROUP BY received_or_transferred
        """

        distribution = []
        with get_destination_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                results = cursor.fetchall()

                self.logger.info("\nTransfer type distribution:")
                for transfer_type, count in results:
                    self.logger.info(f"{transfer_type}: {count} records")
                    distribution.append(
                        {"transfer_type": transfer_type, "count": count}
                    )

        return distribution

    def check_duplicate_records(self) -> int:
        """Check for duplicate records within same compliance report."""
        query = """
            SELECT compliance_report_id, legal_name, quantity, received_or_transferred::text, 
                   COUNT(*) as count
            FROM notional_transfer
            WHERE version = 0 AND user_type::text = 'SUPPLIER'
            GROUP BY compliance_report_id, legal_name, quantity, received_or_transferred
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
                    cr_id, partner, quantity, transfer_type, count = result
                    self.logger.info(
                        f"Duplicate found: CR:{cr_id}, partner:{partner}, "
                        f"type:{transfer_type}, count:{count}"
                    )

        status = (
            f"{duplicate_count} duplicates found"
            if duplicate_count > 0
            else "No duplicates found"
        )
        self.logger.info(f"\nDuplicate records check: {status}")

        return duplicate_count

    def check_new_period_notional_impact(self) -> int:
        """Check if new-period notional transfer records were impacted."""
        query = """
            SELECT COUNT(*) as count
            FROM notional_transfer nt
            JOIN compliance_report cr ON cr.compliance_report_id = nt.compliance_report_id
            WHERE nt.user_type::text != 'SUPPLIER'
            AND EXISTS (
                SELECT 1 FROM notional_transfer nt2 
                WHERE nt2.group_uuid = nt.group_uuid 
                AND nt2.user_type::text = 'SUPPLIER'
            )
        """

        with get_destination_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                return cursor.fetchone()[0]


if __name__ == "__main__":
    validator = NotionalTransferValidator()
    results = validator.run_validation()
