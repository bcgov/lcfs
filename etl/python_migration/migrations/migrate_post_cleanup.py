#!/usr/bin/env python3
"""
Post-Migration Cleanup Script

This script contains manual data fixes that need to run after all other
TFRS to LCFS migrations complete. These fixes address data quality issues
that cannot be automatically resolved during the main migration process.

Run this as the final step after all other migrations.
"""

import logging
import sys
import os
from typing import Tuple

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import get_destination_connection
from core.utils import setup_logging

logger = logging.getLogger(__name__)


class PostMigrationCleanup:
    """Handles post-migration data cleanup tasks."""

    def __init__(self):
        self.fixes_applied = []
        self.fixes_failed = []

    def fix_allocation_agreement_fuel_categories(self, cursor) -> Tuple[int, bool]:
        """
        Fix: Clear fuel_category_id for pre-2024 allocation agreements.

        In TFRS, exclusion reports (now allocation agreements) only had fuel_type,
        not fuel_category. The fuel_category was incorrectly populated during
        migration for some records.
        """
        logger.info("Fixing allocation agreement fuel categories for pre-2024...")

        try:
            # Count records to fix
            cursor.execute("""
                SELECT COUNT(*)
                FROM allocation_agreement aa
                JOIN compliance_report cr ON aa.compliance_report_id = cr.compliance_report_id
                JOIN compliance_period cp ON cr.compliance_period_id = cp.compliance_period_id
                WHERE cp.description < '2024'
                AND aa.fuel_category_id IS NOT NULL
            """)
            count_before = cursor.fetchone()[0]

            if count_before == 0:
                logger.info("  No allocation agreements need fuel_category fix")
                return 0, True

            # Apply the fix
            cursor.execute("""
                UPDATE allocation_agreement aa
                SET fuel_category_id = NULL,
                    update_date = NOW(),
                    update_user = 'ETL_POST_CLEANUP'
                FROM compliance_report cr
                JOIN compliance_period cp ON cr.compliance_period_id = cp.compliance_period_id
                WHERE aa.compliance_report_id = cr.compliance_report_id
                AND cp.description < '2024'
                AND aa.fuel_category_id IS NOT NULL
            """)

            logger.info(f"  Fixed {count_before} allocation agreements (set fuel_category_id to NULL)")
            return count_before, True

        except Exception as e:
            logger.error(f"  Failed to fix allocation agreement fuel categories: {e}")
            return 0, False

    def fix_duplicate_fuel_supply_records(self, cursor) -> Tuple[int, bool]:
        """
        Fix: Remove duplicate fuel_supply records within the same compliance report.

        Some reports have duplicate fuel_supply entries with identical data
        (same quantity, fuel_type, category, CI values).
        """
        logger.info("Checking for duplicate fuel_supply records...")

        try:
            # Find duplicates (keep the one with lowest ID)
            cursor.execute("""
                WITH duplicates AS (
                    SELECT fs.fuel_supply_id,
                           ROW_NUMBER() OVER (
                               PARTITION BY fs.compliance_report_id, fs.quantity,
                                            fs.fuel_type_id, fs.fuel_category_id,
                                            fs.ci_of_fuel
                               ORDER BY fs.fuel_supply_id
                           ) as rn
                    FROM fuel_supply fs
                    JOIN compliance_report cr ON fs.compliance_report_id = cr.compliance_report_id
                    JOIN compliance_period cp ON cr.compliance_period_id = cp.compliance_period_id
                    WHERE cp.description < '2024'
                )
                SELECT COUNT(*) FROM duplicates WHERE rn > 1
            """)
            dup_count = cursor.fetchone()[0]

            if dup_count == 0:
                logger.info("  No duplicate fuel_supply records found")
                return 0, True

            # Delete duplicates (keep lowest ID)
            cursor.execute("""
                WITH duplicates AS (
                    SELECT fs.fuel_supply_id,
                           ROW_NUMBER() OVER (
                               PARTITION BY fs.compliance_report_id, fs.quantity,
                                            fs.fuel_type_id, fs.fuel_category_id,
                                            fs.ci_of_fuel
                               ORDER BY fs.fuel_supply_id
                           ) as rn
                    FROM fuel_supply fs
                    JOIN compliance_report cr ON fs.compliance_report_id = cr.compliance_report_id
                    JOIN compliance_period cp ON cr.compliance_period_id = cp.compliance_period_id
                    WHERE cp.description < '2024'
                )
                DELETE FROM fuel_supply
                WHERE fuel_supply_id IN (
                    SELECT fuel_supply_id FROM duplicates WHERE rn > 1
                )
            """)

            logger.info(f"  Removed {dup_count} duplicate fuel_supply records")
            return dup_count, True

        except Exception as e:
            logger.error(f"  Failed to fix duplicate fuel_supply records: {e}")
            return 0, False

    def fix_zero_quantity_fuel_supply(self, cursor) -> Tuple[int, bool]:
        """
        Fix: Remove fuel_supply records with quantity = 0.

        Some supplemental reports have placeholder records with 0 quantity
        that should be removed.
        """
        logger.info("Checking for zero-quantity fuel_supply records...")

        try:
            cursor.execute("""
                SELECT COUNT(*)
                FROM fuel_supply fs
                JOIN compliance_report cr ON fs.compliance_report_id = cr.compliance_report_id
                JOIN compliance_period cp ON cr.compliance_period_id = cp.compliance_period_id
                WHERE cp.description < '2024'
                AND fs.quantity = 0
            """)
            zero_count = cursor.fetchone()[0]

            if zero_count == 0:
                logger.info("  No zero-quantity fuel_supply records found")
                return 0, True

            # Delete zero-quantity records
            cursor.execute("""
                DELETE FROM fuel_supply
                WHERE fuel_supply_id IN (
                    SELECT fs.fuel_supply_id
                    FROM fuel_supply fs
                    JOIN compliance_report cr ON fs.compliance_report_id = cr.compliance_report_id
                    JOIN compliance_period cp ON cr.compliance_period_id = cp.compliance_period_id
                    WHERE cp.description < '2024'
                    AND fs.quantity = 0
                )
            """)

            logger.info(f"  Removed {zero_count} zero-quantity fuel_supply records")
            return zero_count, True

        except Exception as e:
            logger.error(f"  Failed to fix zero-quantity fuel_supply records: {e}")
            return 0, False

    def migrate(self) -> Tuple[int, int]:
        """
        Run all post-migration cleanup tasks.
        Returns (total_fixes_applied, total_fixes_failed).
        """
        total_fixed = 0
        total_failed = 0

        try:
            with get_destination_connection() as conn:
                cursor = conn.cursor()

                # Run all cleanup tasks
                cleanup_tasks = [
                    ("Allocation Agreement Fuel Categories", self.fix_allocation_agreement_fuel_categories),
                    ("Duplicate Fuel Supply Records", self.fix_duplicate_fuel_supply_records),
                    ("Zero-Quantity Fuel Supply Records", self.fix_zero_quantity_fuel_supply),
                ]

                for task_name, task_func in cleanup_tasks:
                    logger.info(f"\n{'='*60}")
                    logger.info(f"Running: {task_name}")
                    logger.info(f"{'='*60}")

                    count, success = task_func(cursor)

                    if success:
                        total_fixed += count
                        self.fixes_applied.append(f"{task_name}: {count} records")
                    else:
                        total_failed += 1
                        self.fixes_failed.append(task_name)

                # Commit all changes
                conn.commit()
                cursor.close()

                # Print summary
                logger.info(f"\n{'='*60}")
                logger.info("POST-MIGRATION CLEANUP SUMMARY")
                logger.info(f"{'='*60}")
                logger.info(f"Total records fixed: {total_fixed}")
                logger.info(f"Tasks completed: {len(self.fixes_applied)}")
                if self.fixes_failed:
                    logger.error(f"Tasks failed: {len(self.fixes_failed)}")
                    for task in self.fixes_failed:
                        logger.error(f"  - {task}")

        except Exception as e:
            logger.error(f"Post-migration cleanup failed: {e}")
            raise

        return total_fixed, total_failed


def main():
    """Main entry point."""
    setup_logging()
    logger.info("Starting Post-Migration Cleanup")

    cleanup = PostMigrationCleanup()

    try:
        fixed, failed = cleanup.migrate()

        if failed > 0:
            logger.error(f"Post-migration cleanup completed with {failed} failures")
            sys.exit(1)
        else:
            logger.info(f"Post-migration cleanup completed successfully. Fixed {fixed} records.")
            sys.exit(0)

    except Exception as e:
        logger.error(f"Post-migration cleanup failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
