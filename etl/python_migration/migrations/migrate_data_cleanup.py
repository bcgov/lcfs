#!/usr/bin/env python3
"""
Data Cleanup Migration Script

Pre-migration script that prepares the LCFS database with necessary reference data
and fallback entries to handle all possible TFRS data scenarios. This script:

1. Creates missing fuel types and reference data in LCFS
2. Adds fallback/default entries for unmappable TFRS data
3. Ensures LCFS has all necessary lookup tables populated
4. DOES NOT modify any TFRS data (source data is sacrosanct)

This script should be run FIRST before all other migrations.
"""

import os
import sys

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import logging
from typing import Dict, List, Optional, Tuple

from core.database import get_source_connection, get_destination_connection
from core.utils import setup_logging

logger = logging.getLogger(__name__)


class DataCleanupMigrator:
    def __init__(self):
        self.cleanup_results = {
            "fuel_types_created": 0,
            "fallback_entries_created": 0,
            "reference_data_validated": 0,
            "total_preparations": 0,
        }

    def create_fallback_fuel_types(self, lcfs_cursor) -> int:
        """Create fallback fuel types in LCFS to handle unmappable TFRS data"""
        logger.info("🔧 Creating fallback fuel types in LCFS...")

        # Fallback fuel types for unmappable TFRS data
        fallback_fuel_types = [
            ("Unknown", "Fallback for unmappable TFRS fuel types", 0.0, "L", True),
            ("Legacy TFRS", "Legacy fuel type from TFRS migration", 0.0, "L", True),
            ("Unmapped", "TFRS fuel type with no LCFS equivalent", 0.0, "L", True),
        ]

        created_count = 0
        for fuel_type, description, ci, units, unrecognized in fallback_fuel_types:
            try:
                # Check if it already exists
                lcfs_cursor.execute(
                    "SELECT fuel_type_id FROM fuel_type WHERE fuel_type = %s",
                    (fuel_type,),
                )
                if not lcfs_cursor.fetchone():
                    # Create it using the actual LCFS schema
                    lcfs_cursor.execute(
                        """
                        INSERT INTO fuel_type 
                        (fuel_type, default_carbon_intensity, units, unrecognized, 
                         fossil_derived, other_uses_fossil_derived, renewable, is_legacy,
                         create_user, update_user)
                        VALUES (%s, %s, %s::quantityunitsenum, %s, FALSE, FALSE, FALSE, TRUE,
                                'ETL_CLEANUP', 'ETL_CLEANUP')
                        """,
                        (fuel_type, ci, units, unrecognized),
                    )
                    created_count += 1
                    logger.info(f"✅ Created fallback fuel type: {fuel_type}")
            except Exception as e:
                logger.warning(f"⚠️ Could not create fuel type {fuel_type}: {e}")

        return created_count

    def create_fallback_provisions(self, lcfs_cursor) -> int:
        """Create fallback provision entries for unmappable TFRS data"""
        logger.info("🔧 Creating fallback provisions in LCFS...")

        created_count = 0

        # Default provision for unmappable entries
        try:
            lcfs_cursor.execute(
                "SELECT provision_of_the_act_id FROM provision_of_the_act WHERE name = %s",
                ("Unknown/Legacy",),
            )
            if not lcfs_cursor.fetchone():
                lcfs_cursor.execute(
                    """
                    INSERT INTO provision_of_the_act (name, description, display_order, create_user, update_user)
                    VALUES (%s, %s, 999, 'ETL_CLEANUP', 'ETL_CLEANUP')
                    """,
                    (
                        "Unknown/Legacy",
                        "Fallback provision for unmappable TFRS entries",
                    ),
                )
                created_count += 1
                logger.info("✅ Created fallback provision")
        except Exception as e:
            logger.warning(f"⚠️ Could not create fallback provision: {e}")

        return created_count

    def ensure_default_fuel_categories(self, lcfs_cursor) -> int:
        """Ensure basic fuel categories exist for TFRS mapping"""
        logger.info("🔧 Validating fuel categories...")

        # Check that basic categories exist
        required_categories = ["Gasoline", "Diesel", "Jet fuel"]
        missing_count = 0

        for category in required_categories:
            try:
                lcfs_cursor.execute(
                    "SELECT fuel_category_id FROM fuel_category WHERE category = %s",
                    (category,),
                )
                if not lcfs_cursor.fetchone():
                    logger.warning(f"⚠️ Missing fuel category: {category}")
                    missing_count += 1
                else:
                    logger.info(f"✅ Found fuel category: {category}")
            except Exception as e:
                logger.error(f"❌ Error checking fuel category {category}: {e}")

        return len(required_categories) - missing_count

    def create_cleanup_log_table(self, lcfs_cursor):
        """Create a table to log cleanup activities"""
        try:
            lcfs_cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS migration_cleanup_log (
                    id SERIAL PRIMARY KEY,
                    cleanup_type VARCHAR(100),
                    description TEXT,
                    status VARCHAR(50),
                    details JSONB,
                    cleanup_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    create_user VARCHAR(100) DEFAULT 'ETL_CLEANUP'
                )
            """
            )
            logger.info("✅ Created cleanup log table")
        except Exception as e:
            logger.warning(f"⚠️ Could not create cleanup log table: {e}")

    def log_cleanup_action(
        self,
        lcfs_cursor,
        cleanup_type: str,
        description: str,
        status: str,
        details: Dict = None,
    ):
        """Log a cleanup action to the database"""
        try:
            # Use json.dumps() to convert dict to valid JSON string for JSONB column
            details_json = json.dumps(details) if details else None
            lcfs_cursor.execute(
                """
                INSERT INTO migration_cleanup_log
                (cleanup_type, description, status, details)
                VALUES (%s, %s, %s, %s)
            """,
                (cleanup_type, description, status, details_json),
            )
        except Exception as e:
            logger.warning(f"⚠️ Could not log cleanup action: {e}")

    def validate_lcfs_reference_data(self, lcfs_cursor) -> Dict:
        """Validate that essential reference data exists in LCFS"""
        logger.info("🔍 Validating LCFS reference data...")

        validation_results = {}

        # Check essential tables have data
        essential_tables = [
            ("fuel_type", "fuel_type_id"),
            ("fuel_category", "fuel_category_id"),
            ("provision_of_the_act", "provision_of_the_act_id"),
            ("compliance_period", "compliance_period_id"),
        ]

        for table, id_field in essential_tables:
            try:
                lcfs_cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = lcfs_cursor.fetchone()[0]
                validation_results[table] = count

                if count == 0:
                    logger.error(
                        f"❌ {table} is empty - this will cause migration failures"
                    )
                else:
                    logger.info(f"✅ {table}: {count} records")

            except Exception as e:
                logger.error(f"❌ Could not validate {table}: {e}")
                validation_results[table] = -1

        return validation_results

    def analyze_tfrs_data_patterns(self, tfrs_cursor) -> Dict:
        """Analyze TFRS data to understand what we need to support (READ ONLY)"""
        logger.info("🔍 Analyzing TFRS data patterns (read-only)...")

        analysis_results = {}

        try:
            # Check for problematic fuel types (but don't fix them)
            tfrs_cursor.execute(
                """
                SELECT COUNT(*) as total_records,
                       COUNT(CASE WHEN aft.name IS NULL OR aft.name = '' THEN 1 END) as null_names,
                       COUNT(DISTINCT aft.name) as unique_fuel_types
                FROM compliance_report_schedule_b_record crsbr
                LEFT JOIN approved_fuel_type aft ON aft.id = crsbr.fuel_type_id
            """
            )
            result = tfrs_cursor.fetchone()
            analysis_results["fuel_supply_records"] = {
                "total": result[0],
                "null_fuel_types": result[1],
                "unique_fuel_types": result[2],
            }

            # Check for null quantities (but don't fix them)
            tfrs_cursor.execute(
                """
                SELECT COUNT(*) as null_quantities
                FROM compliance_report_schedule_b_record 
                WHERE quantity IS NULL OR quantity = 0
            """
            )
            analysis_results["null_quantities"] = tfrs_cursor.fetchone()[0]

            # Get sample of unique fuel type names
            tfrs_cursor.execute(
                """
                SELECT DISTINCT aft.name 
                FROM approved_fuel_type aft
                WHERE aft.name IS NOT NULL AND aft.name != ''
                ORDER BY aft.name
                LIMIT 20
            """
            )
            fuel_types = [row[0] for row in tfrs_cursor.fetchall()]
            analysis_results["sample_fuel_types"] = fuel_types

            logger.info(f"📊 TFRS Analysis Results:")
            logger.info(
                f"   - Total fuel supply records: {analysis_results['fuel_supply_records']['total']}"
            )
            logger.info(
                f"   - Records with null fuel types: {analysis_results['fuel_supply_records']['null_fuel_types']}"
            )
            logger.info(
                f"   - Records with null quantities: {analysis_results['null_quantities']}"
            )
            logger.info(f"   - Sample fuel types: {', '.join(fuel_types[:10])}...")

        except Exception as e:
            logger.error(f"❌ Error analyzing TFRS data: {e}")

        return analysis_results

    def migrate(self) -> Tuple[int, int]:
        """Run the complete data cleanup process (main interface for migration runner)"""
        total_preparations, _ = self.run_cleanup()
        return (
            total_preparations,
            0,
        )  # Return (processed, total) format expected by runner

    def run_cleanup(self) -> Tuple[int, Dict]:
        """Run the complete data cleanup process"""
        logger.info("🧹 Starting LCFS database preparation for TFRS migration")
        logger.info(
            "📋 NOTE: TFRS data will NOT be modified (source data is sacrosanct)"
        )
        logger.info("=" * 70)

        total_preparations = 0

        try:
            with get_source_connection() as tfrs_conn:
                with get_destination_connection() as lcfs_conn:
                    tfrs_cursor = tfrs_conn.cursor()
                    lcfs_cursor = lcfs_conn.cursor()

                    # Step 1: Create cleanup log table
                    self.create_cleanup_log_table(lcfs_cursor)

                    # Step 2: Validate LCFS reference data
                    validation_results = self.validate_lcfs_reference_data(lcfs_cursor)
                    self.cleanup_results["reference_data_validated"] = len(
                        [v for v in validation_results.values() if v > 0]
                    )

                    # Step 3: Analyze TFRS data patterns (read-only)
                    tfrs_analysis = self.analyze_tfrs_data_patterns(tfrs_cursor)
                    self.log_cleanup_action(
                        lcfs_cursor,
                        "TFRS_ANALYSIS",
                        "Analyzed TFRS data patterns",
                        "COMPLETED",
                        tfrs_analysis,
                    )

                    # Step 4: Create fallback fuel types in LCFS
                    fuel_types_created = self.create_fallback_fuel_types(lcfs_cursor)
                    self.cleanup_results["fuel_types_created"] = fuel_types_created
                    total_preparations += fuel_types_created

                    # Step 5: Create fallback provisions in LCFS
                    provisions_created = self.create_fallback_provisions(lcfs_cursor)
                    fallback_categories = self.ensure_default_fuel_categories(
                        lcfs_cursor
                    )
                    fallback_total = provisions_created + fallback_categories
                    self.cleanup_results["fallback_entries_created"] = fallback_total
                    total_preparations += fallback_total

                    # Step 6: Log final summary
                    self.cleanup_results["total_preparations"] = total_preparations
                    self.log_cleanup_action(
                        lcfs_cursor,
                        "PREPARATION_COMPLETE",
                        "LCFS database prepared for migration",
                        "SUCCESS",
                        self.cleanup_results,
                    )

                    # Commit LCFS changes only (TFRS is read-only)
                    lcfs_conn.commit()

                    logger.info("=" * 70)
                    logger.info(f"🎉 LCFS database preparation completed!")
                    logger.info(f"📊 Total preparations made: {total_preparations}")
                    logger.info(f"📋 Summary:")
                    for key, value in self.cleanup_results.items():
                        logger.info(f"   - {key}: {value}")

                    if tfrs_analysis.get("null_quantities", 0) > 0:
                        logger.warning(
                            f"⚠️ TFRS has {tfrs_analysis['null_quantities']} records with null quantities"
                        )
                        logger.warning(
                            "   Migration scripts will handle these with fallback values"
                        )

                    tfrs_cursor.close()
                    lcfs_cursor.close()

        except Exception as e:
            logger.error(f"❌ LCFS database preparation failed: {e}")
            raise

        return total_preparations, self.cleanup_results


def main():
    """Main function to run data cleanup"""
    setup_logging()

    migrator = DataCleanupMigrator()

    try:
        total_preparations, results = migrator.run_cleanup()

        if total_preparations > 0:
            print(f"\n✅ LCFS database preparation completed successfully!")
            print(f"📊 Made {total_preparations} preparations")
            print("🚀 Ready to run main migrations")
            return 0
        else:
            print("\n✅ LCFS database already prepared - ready for migration!")
            return 0

    except Exception as e:
        print(f"\n❌ LCFS database preparation failed: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
