#!/usr/bin/env python3
"""
Run All Migrations Script

Executes all TFRS to LCFS migration scripts in the correct order.
This script provides a centralized way to run the complete migration process.
"""

import logging
import sys
import time
import os
from typing import List, Tuple

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.utils import setup_logging
from core.database import tfrs_db, lcfs_db

# Import all migration modules
from .migrate_compliance_summaries import ComplianceSummaryMigrator
from .migrate_compliance_summary_updates import ComplianceSummaryUpdater
from .migrate_compliance_report_history import ComplianceReportHistoryMigrator
from .migrate_allocation_agreements import AllocationAgreementMigrator
from .migrate_other_uses import OtherUsesMigrator
from .migrate_notional_transfers import NotionalTransferMigrator
from .migrate_fuel_supply import FuelSupplyMigrator
from .migrate_orphaned_allocation_agreements import OrphanedAllocationAgreementMigrator

logger = logging.getLogger(__name__)


class MigrationRunner:
    def __init__(self):
        self.results = []

    def test_connections(self) -> bool:
        """Test database connections before starting migrations"""
        logger.info("Testing database connections...")

        tfrs_ok = tfrs_db.test_connection()
        lcfs_ok = lcfs_db.test_connection()

        if tfrs_ok:
            logger.info("✅ TFRS database connection successful")
        else:
            logger.error("❌ TFRS database connection failed")

        if lcfs_ok:
            logger.info("✅ LCFS database connection successful")
        else:
            logger.error("❌ LCFS database connection failed")

        return tfrs_ok and lcfs_ok

    def run_migration(self, migrator_class, name: str) -> Tuple[bool, str, int, int]:
        """Run a single migration and return results"""
        logger.info(f"\n{'='*60}")
        logger.info(f"Starting {name}")
        logger.info(f"{'='*60}")

        start_time = time.time()

        try:
            migrator = migrator_class()

            # Run the migration - handle different return signatures
            if hasattr(migrator, "migrate"):
                result = migrator.migrate()

                # Handle different return types
                if isinstance(result, tuple) and len(result) == 2:
                    processed, skipped_or_failed = result
                    total = processed + skipped_or_failed
                elif isinstance(result, tuple) and len(result) == 3:
                    # For orphaned_allocation_agreement which returns (orphaned, processed, skipped)
                    orphaned, processed, skipped = result
                    total = processed + skipped
                else:
                    processed = result if isinstance(result, int) else 0
                    total = processed

            elif hasattr(migrator, "update_summaries"):
                # For compliance_summary_update
                processed, skipped = migrator.update_summaries()
                total = processed + skipped
            else:
                raise Exception(
                    f"Migrator {migrator_class.__name__} has no migrate method"
                )

            end_time = time.time()
            duration = end_time - start_time

            logger.info(f"✅ {name} completed successfully")
            logger.info(f"   📊 Processed: {processed}")
            logger.info(f"   ⏱️  Duration: {duration:.2f} seconds")

            return True, f"Success - Processed: {processed}", processed, total

        except Exception as e:
            end_time = time.time()
            duration = end_time - start_time

            logger.error(f"❌ {name} failed after {duration:.2f} seconds")
            logger.error(f"   Error: {e}")

            return False, f"Failed: {e}", 0, 0

    def run_all_migrations(self) -> bool:
        """Run all migrations in the correct order"""

        # Define migration order and configurations
        migrations = [
            (ComplianceSummaryMigrator, "Compliance Summary Migration"),
            (ComplianceSummaryUpdater, "Compliance Summary Update"),
            (ComplianceReportHistoryMigrator, "Compliance Report History Migration"),
            (AllocationAgreementMigrator, "Allocation Agreement Migration"),
            (OtherUsesMigrator, "Other Uses (Schedule C) Migration"),
            (NotionalTransferMigrator, "Notional Transfer (Schedule A) Migration"),
            (FuelSupplyMigrator, "Fuel Supply (Schedule B) Migration"),
            (
                OrphanedAllocationAgreementMigrator,
                "Orphaned Allocation Agreement Migration",
            ),
        ]

        logger.info("🚀 Starting complete TFRS to LCFS migration process")
        logger.info(f"📋 Total migrations to run: {len(migrations)}")

        overall_start_time = time.time()
        total_processed = 0
        total_records = 0
        failed_migrations = []

        # Run each migration
        for migrator_class, name in migrations:
            success, message, processed, total = self.run_migration(
                migrator_class, name
            )

            self.results.append(
                {
                    "name": name,
                    "success": success,
                    "message": message,
                    "processed": processed,
                    "total": total,
                }
            )

            if success:
                total_processed += processed
                total_records += total
            else:
                failed_migrations.append(name)
                # Continue with other migrations even if one fails
                logger.warning(
                    f"⚠️  Continuing with remaining migrations despite {name} failure"
                )

        overall_end_time = time.time()
        overall_duration = overall_end_time - overall_start_time

        # Print summary
        self.print_summary(
            overall_duration, total_processed, total_records, failed_migrations
        )

        return len(failed_migrations) == 0

    def print_summary(
        self,
        duration: float,
        total_processed: int,
        total_records: int,
        failed_migrations: List[str],
    ):
        """Print migration summary"""
        logger.info(f"\n{'='*80}")
        logger.info("📋 MIGRATION SUMMARY")
        logger.info(f"{'='*80}")

        logger.info(
            f"⏱️  Total Duration: {duration:.2f} seconds ({duration/60:.1f} minutes)"
        )
        logger.info(f"📊 Total Records Processed: {total_processed:,}")
        logger.info(f"📈 Total Records Encountered: {total_records:,}")

        # Print individual results
        logger.info(f"\n📝 Individual Migration Results:")
        for result in self.results:
            status = "✅" if result["success"] else "❌"
            logger.info(f"   {status} {result['name']}: {result['message']}")

        # Print failures if any
        if failed_migrations:
            logger.error(f"\n❌ Failed Migrations ({len(failed_migrations)}):")
            for migration in failed_migrations:
                logger.error(f"   • {migration}")
        else:
            logger.info(f"\n🎉 All migrations completed successfully!")

        logger.info(f"{'='*80}")


def main():
    """Main entry point"""
    setup_logging()

    runner = MigrationRunner()

    # Test connections first
    if not runner.test_connections():
        logger.error("❌ Database connection tests failed. Aborting migrations.")
        sys.exit(1)

    # Run all migrations
    success = runner.run_all_migrations()

    if success:
        logger.info("🎉 All migrations completed successfully!")
        sys.exit(0)
    else:
        logger.error("❌ Some migrations failed. Check logs for details.")
        sys.exit(1)


if __name__ == "__main__":
    main()
