"""
Complete migration orchestrator that sets up databases, runs migrations, and validates results.
"""

import sys
import os
import logging
import argparse
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from setup.database_manager import DatabaseSetup, Environment, Application
from setup.docker_manager import DockerManager
from migrations.run_all_migrations import MigrationRunner
from setup.validation_runner import run_all_validations, save_results_to_file


class MigrationOrchestrator:
    """Orchestrates the complete migration process from setup to validation."""

    def __init__(self):
        self.setup_logging()
        self.logger = logging.getLogger(__name__)
        self.db_setup = DatabaseSetup()
        self.docker_manager = DockerManager()

    def setup_logging(self):
        """Set up logging configuration."""
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        )

    def run_complete_migration(
        self,
        tfrs_container: str = None,
        lcfs_container: str = None,
        env: Environment = Environment.DEV,
        skip_setup: bool = False,
        skip_validation: bool = False,
    ) -> bool:
        """
        Run the complete migration process:
        1. Set up databases (optional)
        2. Verify migration readiness
        3. Run migrations
        4. Run validations
        """
        start_time = datetime.now()

        self.logger.info("=" * 80)
        self.logger.info("TFRS TO LCFS COMPLETE MIGRATION PROCESS")
        self.logger.info(f"Started: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        self.logger.info("=" * 80)

        try:
            # Step 1: Database Setup (optional)
            if not skip_setup and tfrs_container and lcfs_container:
                self.logger.info("\n🔄 STEP 1: Setting up test databases")
                if not self.db_setup.setup_test_environment(
                    tfrs_container, lcfs_container, env
                ):
                    self.logger.error("❌ Database setup failed")
                    return False
                self.logger.info("✅ Database setup completed")
            else:
                self.logger.info("\n⏭️  STEP 1: Skipping database setup")

            # Step 2: Migration Readiness Check
            self.logger.info("\n🔍 STEP 2: Checking migration readiness")
            is_ready, issues = self.db_setup.check_migration_readiness()

            if not is_ready:
                self.logger.error("❌ Migration readiness check failed:")
                for issue in issues:
                    self.logger.error(f"  - {issue}")
                return False

            self.logger.info("✅ Migration readiness check passed")

            # Step 3: Run Migrations
            self.logger.info("\n🚀 STEP 3: Running data migrations")
            migration_success = self._run_migrations()

            if not migration_success:
                self.logger.error("❌ Migration process failed")
                return False

            self.logger.info("✅ Migration process completed")

            # Step 4: Run Validations (optional)
            if not skip_validation:
                self.logger.info("\n🔎 STEP 4: Running validation scripts")
                validation_success = self._run_validations()

                if not validation_success:
                    self.logger.error("❌ Validation process failed")
                    return False

                self.logger.info("✅ Validation process completed")
            else:
                self.logger.info("\n⏭️  STEP 4: Skipping validation")

            # Success Summary
            end_time = datetime.now()
            duration = end_time - start_time

            self.logger.info("\n" + "=" * 80)
            self.logger.info("🎉 COMPLETE MIGRATION PROCESS SUCCESSFUL!")
            self.logger.info(f"Duration: {duration}")
            self.logger.info(f"Completed: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
            self.logger.info("=" * 80)

            return True

        except Exception as e:
            self.logger.error(f"❌ Migration process failed with error: {e}")
            return False

    def _run_migrations(self) -> bool:
        """Run all migration scripts."""
        try:
            runner = MigrationRunner()

            # Import and run migrations
            migration_results = runner.run_all_migrations()

            # Check for any failures
            failed_migrations = [
                name
                for name, result in migration_results.items()
                if not result.get("success", False)
            ]

            if failed_migrations:
                self.logger.error(f"Failed migrations: {failed_migrations}")
                return False

            # Log summary
            total_migrations = len(migration_results)
            self.logger.info(
                f"All {total_migrations} migrations completed successfully"
            )

            # Log record counts
            for migration_name, result in migration_results.items():
                if "records_processed" in result:
                    self.logger.info(
                        f"  - {migration_name}: {result['records_processed']} records"
                    )

            return True

        except Exception as e:
            self.logger.error(f"Migration execution failed: {e}")
            return False

    def _run_validations(self) -> bool:
        """Run all validation scripts."""
        try:
            # Run validations
            validation_results = run_all_validations()

            # Save detailed results
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"complete_migration_validation_{timestamp}.json"
            save_results_to_file(validation_results, filename)

            # Check for any failures
            failed_validations = [
                name
                for name, result in validation_results.items()
                if result.get("status") == "failed"
            ]

            if failed_validations:
                self.logger.error(f"Failed validations: {failed_validations}")
                return False

            # Log summary
            total_validations = len(validation_results)
            self.logger.info(
                f"All {total_validations} validations completed successfully"
            )

            # Log key metrics
            for validation_name, result in validation_results.items():
                if result.get("status") == "success" and "results" in result:
                    results = result["results"]
                    if "record_counts" in results:
                        counts = results["record_counts"]
                        if isinstance(counts, dict) and "source_count" in counts:
                            self.logger.info(
                                f"  - {validation_name}: {counts['source_count']} → {counts['dest_count']} records"
                            )

            return True

        except Exception as e:
            self.logger.error(f"Validation execution failed: {e}")
            return False

    def run_database_setup_only(
        self,
        tfrs_container: str,
        lcfs_container: str,
        env: Environment = Environment.DEV,
    ) -> bool:
        """Run only the database setup portion."""
        self.logger.info("🔄 Running database setup only")
        return self.db_setup.setup_test_environment(tfrs_container, lcfs_container, env)

    def run_prod_database_setup_only(
        self, tfrs_container: str, lcfs_container: str
    ) -> bool:
        """Run only the database setup portion using production data."""
        self.logger.info("🔄 Running production database setup only")
        self.logger.warning("⚠️  This will import PRODUCTION data to local containers")
        return self.db_setup.setup_prod_environment(tfrs_container, lcfs_container)

    def run_migration_only(self) -> bool:
        """Run only the migration portion (assumes databases are already set up)."""
        self.logger.info("🚀 Running migration only")

        # Check readiness first
        is_ready, issues = self.db_setup.check_migration_readiness()
        if not is_ready:
            self.logger.error("Migration readiness check failed:")
            for issue in issues:
                self.logger.error(f"  - {issue}")
            return False

        return self._run_migrations()

    def run_validation_only(self) -> bool:
        """Run only the validation portion (assumes migration is complete)."""
        self.logger.info("🔎 Running validation only")
        return self._run_validations()

    def run_auto_environment_setup(
        self, env: Environment = Environment.DEV, start_lcfs: bool = True
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Automatically set up migration environment with Docker containers.

        Returns:
            Tuple of (tfrs_container_id, lcfs_container_id)
        """
        self.logger.info("🐳 Setting up automatic Docker environment")

        tfrs_id, lcfs_id = self.docker_manager.setup_migration_environment(
            env, start_lcfs
        )

        if tfrs_id:
            self.logger.info(f"✅ TFRS container ready: {tfrs_id}")
        else:
            self.logger.error("❌ Failed to set up TFRS container")

        if start_lcfs:
            if lcfs_id:
                self.logger.info(f"✅ LCFS container ready: {lcfs_id}")
            else:
                self.logger.warning("⚠️  LCFS container not automatically identified")

        return tfrs_id, lcfs_id

    def run_complete_migration_auto(
        self, env: Environment = Environment.DEV, skip_validation: bool = False
    ) -> bool:
        """
        Run complete migration with automatic Docker environment setup.
        """
        start_time = datetime.now()

        self.logger.info("=" * 80)
        self.logger.info("TFRS TO LCFS COMPLETE MIGRATION PROCESS (AUTO DOCKER)")
        self.logger.info(f"Started: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        self.logger.info("=" * 80)

        try:
            # Step 1: Auto Docker Environment Setup
            self.logger.info("\n🐳 STEP 1: Setting up Docker environment automatically")
            tfrs_id, lcfs_id = self.run_auto_environment_setup(env, start_lcfs=True)

            if not tfrs_id:
                self.logger.error("❌ Auto environment setup failed")
                return False

            self.logger.info("✅ Auto environment setup completed")

            # Step 2: Migration Readiness Check
            self.logger.info("\n🔍 STEP 2: Checking migration readiness")
            is_ready, issues = self.db_setup.check_migration_readiness()

            if not is_ready:
                self.logger.error("❌ Migration readiness check failed:")
                for issue in issues:
                    self.logger.error(f"  - {issue}")
                return False

            self.logger.info("✅ Migration readiness check passed")

            # Step 3: Run Migrations
            self.logger.info("\n🚀 STEP 3: Running data migrations")
            migration_success = self._run_migrations()

            if not migration_success:
                self.logger.error("❌ Migration process failed")
                return False

            self.logger.info("✅ Migration process completed")

            # Step 4: Run Validations (optional)
            if not skip_validation:
                self.logger.info("\n🔎 STEP 4: Running validation scripts")
                validation_success = self._run_validations()

                if not validation_success:
                    self.logger.error("❌ Validation process failed")
                    return False

                self.logger.info("✅ Validation process completed")
            else:
                self.logger.info("\n⏭️  STEP 4: Skipping validation")

            # Success Summary
            end_time = datetime.now()
            duration = end_time - start_time

            self.logger.info("\n" + "=" * 80)
            self.logger.info("🎉 COMPLETE AUTO MIGRATION PROCESS SUCCESSFUL!")
            self.logger.info(f"TFRS Container: {tfrs_id}")
            if lcfs_id:
                self.logger.info(f"LCFS Container: {lcfs_id}")
            self.logger.info(f"Duration: {duration}")
            self.logger.info(f"Completed: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
            self.logger.info("=" * 80)

            return True

        except Exception as e:
            self.logger.error(f"❌ Auto migration process failed with error: {e}")
            return False


def main():
    """Main CLI interface."""
    parser = argparse.ArgumentParser(
        description="TFRS to LCFS Complete Migration Orchestrator"
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Complete migration command
    complete_parser = subparsers.add_parser(
        "complete", help="Run complete migration process"
    )
    complete_parser.add_argument("--tfrs-container", help="TFRS Docker container name")
    complete_parser.add_argument("--lcfs-container", help="LCFS Docker container name")
    complete_parser.add_argument(
        "--env",
        choices=["dev", "test", "prod"],
        default="dev",
        help="Environment to use for data transfer",
    )
    complete_parser.add_argument(
        "--skip-setup",
        action="store_true",
        help="Skip database setup (use existing data)",
    )
    complete_parser.add_argument(
        "--skip-validation", action="store_true", help="Skip validation after migration"
    )

    # Setup only command
    setup_parser = subparsers.add_parser("setup", help="Setup databases only")
    setup_parser.add_argument("tfrs_container", help="TFRS Docker container name")
    setup_parser.add_argument("lcfs_container", help="LCFS Docker container name")
    setup_parser.add_argument(
        "--env",
        choices=["dev", "test", "prod"],
        default="dev",
        help="Environment to use for data transfer",
    )

    # Production setup command
    setup_prod_parser = subparsers.add_parser(
        "setup-prod", help="Setup databases with production data"
    )
    setup_prod_parser.add_argument("tfrs_container", help="TFRS Docker container name")
    setup_prod_parser.add_argument("lcfs_container", help="LCFS Docker container name")

    # Auto setup command (Docker containers managed automatically)
    auto_setup_parser = subparsers.add_parser(
        "auto-setup", help="Automatically setup Docker environment"
    )
    auto_setup_parser.add_argument(
        "--env",
        choices=["dev", "test", "prod"],
        default="dev",
        help="Environment to use for data transfer",
    )
    auto_setup_parser.add_argument(
        "--no-lcfs", action="store_true", help="Skip LCFS environment setup"
    )

    # Complete auto migration command
    auto_complete_parser = subparsers.add_parser(
        "auto-complete", help="Complete migration with auto Docker setup"
    )
    auto_complete_parser.add_argument(
        "--env",
        choices=["dev", "test", "prod"],
        default="dev",
        help="Environment to use for data transfer",
    )
    auto_complete_parser.add_argument(
        "--skip-validation", action="store_true", help="Skip validation after migration"
    )

    # Migration only command
    subparsers.add_parser("migrate", help="Run migration only (assumes setup complete)")

    # Validation only command
    subparsers.add_parser(
        "validate", help="Run validation only (assumes migration complete)"
    )

    # Readiness check command
    subparsers.add_parser("check", help="Check migration readiness")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    orchestrator = MigrationOrchestrator()

    if args.command == "complete":
        success = orchestrator.run_complete_migration(
            tfrs_container=args.tfrs_container,
            lcfs_container=args.lcfs_container,
            env=Environment(args.env),
            skip_setup=args.skip_setup,
            skip_validation=args.skip_validation,
        )

    elif args.command == "setup":
        success = orchestrator.run_database_setup_only(
            args.tfrs_container, args.lcfs_container, Environment(args.env)
        )

    elif args.command == "setup-prod":
        # Confirm production data import
        print("⚠️  WARNING: This will import PRODUCTION data to your local containers!")
        print("This may take significant time and will overwrite existing data.")
        confirmation = input("Are you sure you want to proceed? (yes/no): ")

        if confirmation.lower() != "yes":
            print("Production setup cancelled.")
            sys.exit(0)

        success = orchestrator.run_prod_database_setup_only(
            args.tfrs_container, args.lcfs_container
        )

    elif args.command == "auto-setup":
        tfrs_id, lcfs_id = orchestrator.run_auto_environment_setup(
            Environment(args.env), start_lcfs=not args.no_lcfs
        )

        success = tfrs_id is not None
        if success:
            print(f"✅ Auto setup completed")
            print(f"TFRS Container ID: {tfrs_id}")
            if lcfs_id:
                print(f"LCFS Container ID: {lcfs_id}")

    elif args.command == "auto-complete":
        success = orchestrator.run_complete_migration_auto(
            Environment(args.env), skip_validation=args.skip_validation
        )

    elif args.command == "migrate":
        success = orchestrator.run_migration_only()

    elif args.command == "validate":
        success = orchestrator.run_validation_only()

    elif args.command == "check":
        success, issues = orchestrator.db_setup.check_migration_readiness()
        if not success:
            print("Migration readiness issues:")
            for issue in issues:
                print(f"  - {issue}")

    else:
        parser.print_help()
        sys.exit(1)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
