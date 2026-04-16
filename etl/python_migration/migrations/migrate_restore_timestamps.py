#!/usr/bin/env python3
"""
Restore Original Timestamps Migration Script

This script restores the original create_date and update_date timestamps from TFRS
for all migrated records. The SQLAlchemy onupdate=func.now() automatically updates
the update_date field on any UPDATE operation, so we need to restore the original
values after migration.

This script should be run LAST after all other migrations.
"""

import os
import sys

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
from typing import Dict, Tuple

from core.database import get_source_connection, get_destination_connection
from core.utils import setup_logging

logger = logging.getLogger(__name__)


class TimestampRestoreMigrator:
    def __init__(self):
        self.restore_results = {
            "compliance_reports_restored": 0,
            "fuel_supply_restored": 0,
            "notional_transfers_restored": 0,
            "allocation_agreements_restored": 0,
            "other_uses_restored": 0,
            "total_restored": 0,
        }

    def restore_compliance_report_timestamps(self, tfrs_cursor, lcfs_cursor) -> int:
        """Restore compliance_report timestamps from TFRS"""
        logger.info("⏰ Restoring compliance_report timestamps...")

        try:
            # Disable triggers that refresh materialized views to avoid "out of shared memory" errors
            logger.info("   Temporarily disabling materialized view refresh triggers...")
            lcfs_cursor.execute(
                "ALTER TABLE compliance_report DISABLE TRIGGER refresh_mv_org_compliance_report_count_after_compliance_report"
            )

            # Use a batch update with a temporary table for better performance
            logger.info("   Creating temporary table for timestamp mapping...")
            lcfs_cursor.execute(
                """
                CREATE TEMPORARY TABLE temp_cr_timestamps (
                    legacy_id INTEGER,
                    create_date TIMESTAMP WITH TIME ZONE,
                    update_date TIMESTAMP WITH TIME ZONE
                )
                """
            )

            # Get all migrated compliance reports with their original timestamps
            tfrs_cursor.execute(
                """
                SELECT
                    cr.id as legacy_id,
                    cr.create_timestamp as create_date,
                    cr.update_timestamp as update_date
                FROM compliance_report cr
                WHERE cr.id IS NOT NULL
                """
            )
            tfrs_records = tfrs_cursor.fetchall()

            # Insert into temp table
            logger.info(f"   Loading {len(tfrs_records)} timestamp records...")
            for legacy_id, create_date, update_date in tfrs_records:
                lcfs_cursor.execute(
                    "INSERT INTO temp_cr_timestamps VALUES (%s, %s, %s)",
                    (legacy_id, create_date, update_date),
                )

            # Batch update from temp table
            logger.info("   Performing batch timestamp update...")
            lcfs_cursor.execute(
                """
                UPDATE compliance_report cr
                SET
                    create_date = t.create_date,
                    update_date = t.update_date
                FROM temp_cr_timestamps t
                WHERE cr.legacy_id = t.legacy_id
                AND cr.create_user = 'ETL'
                """
            )
            restored_count = lcfs_cursor.rowcount

            # Clean up temp table
            lcfs_cursor.execute("DROP TABLE temp_cr_timestamps")

            # Re-enable the trigger
            logger.info("   Re-enabling materialized view refresh triggers...")
            lcfs_cursor.execute(
                "ALTER TABLE compliance_report ENABLE TRIGGER refresh_mv_org_compliance_report_count_after_compliance_report"
            )

            # Manually refresh the materialized view once
            logger.info("   Refreshing materialized view...")
            lcfs_cursor.execute(
                "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_org_compliance_report_count"
            )

            logger.info(f"✅ Restored {restored_count} compliance_report timestamps")
            return restored_count

        except Exception as e:
            # Make sure to re-enable trigger even if there's an error
            try:
                lcfs_cursor.execute(
                    "ALTER TABLE compliance_report ENABLE TRIGGER refresh_mv_org_compliance_report_count_after_compliance_report"
                )
            except:
                pass
            logger.error(f"❌ Error restoring compliance_report timestamps: {e}")
            raise

    def restore_fuel_supply_timestamps(self, tfrs_cursor, lcfs_cursor) -> int:
        """Restore fuel_supply timestamps from TFRS (using parent compliance_report timestamps)"""
        logger.info("⏰ Restoring fuel_supply timestamps...")

        try:
            # TFRS schedule_b_record doesn't have timestamp columns,
            # so we use the parent compliance_report's timestamps
            logger.info("   Creating temporary table...")
            lcfs_cursor.execute(
                """
                CREATE TEMPORARY TABLE temp_fs_timestamps (
                    legacy_id INTEGER,
                    create_date TIMESTAMP WITH TIME ZONE,
                    update_date TIMESTAMP WITH TIME ZONE
                )
                """
            )

            # Get timestamps from parent compliance_report in TFRS
            tfrs_cursor.execute(
                """
                SELECT
                    crsbr.id as legacy_id,
                    cr.create_timestamp as create_date,
                    cr.update_timestamp as update_date
                FROM compliance_report_schedule_b_record crsbr
                JOIN compliance_report cr ON cr.schedule_b_id = crsbr.schedule_id
                WHERE crsbr.id IS NOT NULL
                """
            )
            tfrs_records = tfrs_cursor.fetchall()

            # Insert into temp table
            logger.info(f"   Loading {len(tfrs_records)} timestamp records...")
            for legacy_id, create_date, update_date in tfrs_records:
                lcfs_cursor.execute(
                    "INSERT INTO temp_fs_timestamps VALUES (%s, %s, %s)",
                    (legacy_id, create_date, update_date),
                )

            # Batch update
            logger.info("   Performing batch timestamp update...")
            lcfs_cursor.execute(
                """
                UPDATE fuel_supply fs
                SET
                    create_date = t.create_date,
                    update_date = t.update_date
                FROM temp_fs_timestamps t
                WHERE fs.fuel_supply_id = t.legacy_id
                AND fs.create_user = 'ETL'
                """
            )
            restored_count = lcfs_cursor.rowcount

            # Clean up
            lcfs_cursor.execute("DROP TABLE temp_fs_timestamps")

            logger.info(f"✅ Restored {restored_count} fuel_supply timestamps")
            return restored_count

        except Exception as e:
            logger.error(f"❌ Error restoring fuel_supply timestamps: {e}")
            raise

    def restore_notional_transfer_timestamps(self, tfrs_cursor, lcfs_cursor) -> int:
        """Restore notional_transfer timestamps from TFRS (using parent compliance_report timestamps)"""
        logger.info("⏰ Restoring notional_transfer timestamps...")

        try:
            # TFRS schedule_a_record doesn't have timestamp columns,
            # so we use the parent compliance_report's timestamps
            lcfs_cursor.execute(
                """
                CREATE TEMPORARY TABLE temp_nt_timestamps (
                    legacy_id INTEGER,
                    create_date TIMESTAMP WITH TIME ZONE,
                    update_date TIMESTAMP WITH TIME ZONE
                )
                """
            )

            # Get timestamps from parent compliance_report in TFRS
            tfrs_cursor.execute(
                """
                SELECT
                    crsar.id as legacy_id,
                    cr.create_timestamp as create_date,
                    cr.update_timestamp as update_date
                FROM compliance_report_schedule_a_record crsar
                JOIN compliance_report cr ON cr.schedule_a_id = crsar.schedule_id
                WHERE crsar.id IS NOT NULL
                """
            )
            tfrs_records = tfrs_cursor.fetchall()

            # Insert into temp table
            for legacy_id, create_date, update_date in tfrs_records:
                lcfs_cursor.execute(
                    "INSERT INTO temp_nt_timestamps VALUES (%s, %s, %s)",
                    (legacy_id, create_date, update_date),
                )

            # Batch update
            lcfs_cursor.execute(
                """
                UPDATE notional_transfer nt
                SET
                    create_date = t.create_date,
                    update_date = t.update_date
                FROM temp_nt_timestamps t
                WHERE nt.notional_transfer_id = t.legacy_id
                AND nt.create_user = 'ETL'
                """
            )
            restored_count = lcfs_cursor.rowcount

            # Clean up
            lcfs_cursor.execute("DROP TABLE temp_nt_timestamps")

            logger.info(f"✅ Restored {restored_count} notional_transfer timestamps")
            return restored_count

        except Exception as e:
            logger.error(f"❌ Error restoring notional_transfer timestamps: {e}")
            raise

    def restore_allocation_agreement_timestamps(
        self, tfrs_cursor, lcfs_cursor
    ) -> int:
        """Restore allocation_agreement timestamps from TFRS (using parent compliance_report timestamps)"""
        logger.info("⏰ Restoring allocation_agreement timestamps...")

        try:
            # TFRS exclusion_agreement_record doesn't have timestamp columns,
            # so we use the parent compliance_report's timestamps
            lcfs_cursor.execute(
                """
                CREATE TEMPORARY TABLE temp_aa_timestamps (
                    legacy_id INTEGER,
                    create_date TIMESTAMP WITH TIME ZONE,
                    update_date TIMESTAMP WITH TIME ZONE
                )
                """
            )

            # Get timestamps from parent compliance_report in TFRS
            tfrs_cursor.execute(
                """
                SELECT
                    crear.id as legacy_id,
                    cr.create_timestamp as create_date,
                    cr.update_timestamp as update_date
                FROM compliance_report_exclusion_agreement_record crear
                JOIN compliance_report_exclusion_agreement crea ON crea.id = crear.exclusion_agreement_id
                JOIN compliance_report cr ON cr.exclusion_agreement_id = crea.id
                WHERE crear.id IS NOT NULL
                """
            )
            tfrs_records = tfrs_cursor.fetchall()

            # Insert into temp table
            for legacy_id, create_date, update_date in tfrs_records:
                lcfs_cursor.execute(
                    "INSERT INTO temp_aa_timestamps VALUES (%s, %s, %s)",
                    (legacy_id, create_date, update_date),
                )

            # Batch update
            lcfs_cursor.execute(
                """
                UPDATE allocation_agreement aa
                SET
                    create_date = t.create_date,
                    update_date = t.update_date
                FROM temp_aa_timestamps t
                WHERE aa.allocation_agreement_id = t.legacy_id
                AND aa.create_user = 'ETL'
                """
            )
            restored_count = lcfs_cursor.rowcount

            # Clean up
            lcfs_cursor.execute("DROP TABLE temp_aa_timestamps")

            logger.info(
                f"✅ Restored {restored_count} allocation_agreement timestamps"
            )
            return restored_count

        except Exception as e:
            logger.error(f"❌ Error restoring allocation_agreement timestamps: {e}")
            raise

    def restore_other_uses_timestamps(self, tfrs_cursor, lcfs_cursor) -> int:
        """Restore other_uses timestamps from TFRS (using parent compliance_report timestamps)"""
        logger.info("⏰ Restoring other_uses timestamps...")

        try:
            # TFRS schedule_c_record doesn't have timestamp columns,
            # so we use the parent compliance_report's timestamps
            lcfs_cursor.execute(
                """
                CREATE TEMPORARY TABLE temp_ou_timestamps (
                    legacy_id INTEGER,
                    create_date TIMESTAMP WITH TIME ZONE,
                    update_date TIMESTAMP WITH TIME ZONE
                )
                """
            )

            # Get timestamps from parent compliance_report in TFRS
            tfrs_cursor.execute(
                """
                SELECT
                    crscr.id as legacy_id,
                    cr.create_timestamp as create_date,
                    cr.update_timestamp as update_date
                FROM compliance_report_schedule_c_record crscr
                JOIN compliance_report cr ON cr.schedule_c_id = crscr.schedule_id
                WHERE crscr.id IS NOT NULL
                """
            )
            tfrs_records = tfrs_cursor.fetchall()

            # Insert into temp table
            for legacy_id, create_date, update_date in tfrs_records:
                lcfs_cursor.execute(
                    "INSERT INTO temp_ou_timestamps VALUES (%s, %s, %s)",
                    (legacy_id, create_date, update_date),
                )

            # Batch update
            lcfs_cursor.execute(
                """
                UPDATE other_uses ou
                SET
                    create_date = t.create_date,
                    update_date = t.update_date
                FROM temp_ou_timestamps t
                WHERE ou.other_uses_id = t.legacy_id
                AND ou.create_user = 'ETL'
                """
            )
            restored_count = lcfs_cursor.rowcount

            # Clean up
            lcfs_cursor.execute("DROP TABLE temp_ou_timestamps")

            logger.info(f"✅ Restored {restored_count} other_uses timestamps")
            return restored_count

        except Exception as e:
            logger.error(f"❌ Error restoring other_uses timestamps: {e}")
            raise

    def migrate(self) -> Tuple[int, int]:
        """Run the complete timestamp restoration process (main interface for migration runner)"""
        total_restored = self.run_restoration()
        return (
            total_restored,
            0,
        )  # Return (processed, total) format expected by runner

    def run_restoration(self) -> int:
        """Run the complete timestamp restoration process"""
        logger.info("⏰ Starting timestamp restoration from TFRS")
        logger.info("=" * 70)

        total_restored = 0

        try:
            with get_source_connection() as tfrs_conn:
                with get_destination_connection() as lcfs_conn:
                    tfrs_cursor = tfrs_conn.cursor()
                    lcfs_cursor = lcfs_conn.cursor()

                    # Restore timestamps for each table
                    self.restore_results["compliance_reports_restored"] = (
                        self.restore_compliance_report_timestamps(
                            tfrs_cursor, lcfs_cursor
                        )
                    )
                    self.restore_results["fuel_supply_restored"] = (
                        self.restore_fuel_supply_timestamps(tfrs_cursor, lcfs_cursor)
                    )
                    self.restore_results["notional_transfers_restored"] = (
                        self.restore_notional_transfer_timestamps(
                            tfrs_cursor, lcfs_cursor
                        )
                    )
                    self.restore_results["allocation_agreements_restored"] = (
                        self.restore_allocation_agreement_timestamps(
                            tfrs_cursor, lcfs_cursor
                        )
                    )
                    self.restore_results["other_uses_restored"] = (
                        self.restore_other_uses_timestamps(tfrs_cursor, lcfs_cursor)
                    )

                    # Calculate total
                    total_restored = sum(self.restore_results.values())
                    self.restore_results["total_restored"] = total_restored

                    # Commit changes
                    lcfs_conn.commit()

                    logger.info("=" * 70)
                    logger.info(f"🎉 Timestamp restoration completed!")
                    logger.info(f"📊 Total timestamps restored: {total_restored}")
                    logger.info(f"📋 Summary:")
                    for key, value in self.restore_results.items():
                        if key != "total_restored":
                            logger.info(f"   - {key}: {value}")

                    tfrs_cursor.close()
                    lcfs_cursor.close()

        except Exception as e:
            logger.error(f"❌ Timestamp restoration failed: {e}")
            raise

        return total_restored


def main():
    """Main function to run timestamp restoration"""
    setup_logging()

    migrator = TimestampRestoreMigrator()

    try:
        total_restored = migrator.run_restoration()

        if total_restored > 0:
            print(f"\n✅ Timestamp restoration completed successfully!")
            print(f"📊 Restored {total_restored} timestamps")
            return 0
        else:
            print("\n⚠️ No timestamps were restored")
            return 1

    except Exception as e:
        print(f"\n❌ Timestamp restoration failed: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
