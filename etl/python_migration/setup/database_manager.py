"""
Database setup and verification utilities for TFRS to LCFS migration.
Python equivalent of data-transfer.sh with additional validation capabilities.
"""

import os
import sys
import logging
import subprocess
import tempfile
import shutil
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import time

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.database import get_source_connection, get_destination_connection


class Environment(Enum):
    DEV = "dev"
    TEST = "test"
    PROD = "prod"


class Application(Enum):
    TFRS = "tfrs"
    LCFS = "lcfs"


class Direction(Enum):
    IMPORT = "import"
    EXPORT = "export"


@dataclass
class DatabaseConfig:
    project_name: str
    app_label: str
    db_name: str
    remote_db_user: str
    local_db_user: str


class DatabaseSetup:
    """Handle database setup and data transfer operations."""

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.setup_logging()

    def setup_logging(self):
        """Set up logging configuration."""
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        )

    def get_database_config(self, app: Application, env: Environment) -> DatabaseConfig:
        """Get database configuration for the specified application and environment."""
        if app == Application.TFRS:
            project_name = f"0ab226-{env.value}"
            app_label = (
                "tfrs-crunchy-prod-tfrs" if env == Environment.PROD else "tfrs-spilo"
            )
            return DatabaseConfig(
                project_name=project_name,
                app_label=app_label,
                db_name="tfrs",
                remote_db_user="postgres",
                local_db_user="tfrs",
            )
        elif app == Application.LCFS:
            project_name = f"d2bd59-{env.value}"
            app_label = f"lcfs-crunchy-{env.value}-lcfs"
            return DatabaseConfig(
                project_name=project_name,
                app_label=app_label,
                db_name="lcfs",
                remote_db_user="postgres",
                local_db_user="lcfs",
            )
        else:
            raise ValueError(f"Invalid application: {app}")

    def check_openshift_login(self) -> bool:
        """Check if user is logged into OpenShift."""
        try:
            result = subprocess.run(
                ["oc", "whoami"], capture_output=True, text=True, check=True
            )
            self.logger.info(f"OpenShift user: {result.stdout.strip()}")
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            self.logger.error("Not logged into OpenShift or 'oc' command not found")
            return False

    def check_docker_container(self, container_name: str) -> bool:
        """Check if Docker container exists and is running."""
        try:
            result = subprocess.run(
                ["docker", "inspect", container_name, "--format={{.State.Running}}"],
                capture_output=True,
                text=True,
                check=True,
            )
            is_running = result.stdout.strip() == "true"
            if is_running:
                self.logger.info(f"Docker container {container_name} is running")
            else:
                self.logger.error(f"Docker container {container_name} is not running")
            return is_running
        except (subprocess.CalledProcessError, FileNotFoundError):
            self.logger.error(
                f"Docker container {container_name} not found or Docker not available"
            )
            return False

    def set_oc_project(self, db_config: DatabaseConfig) -> Optional[str]:
        # Set the OpenShift project
        subprocess.run(
            ["oc", "project", db_config.project_name],
            capture_output=True,
            text=True,
            check=True,
        )

    def get_leader_pod(self, db_config: DatabaseConfig) -> Optional[str]:
        """Find the leader pod in the PostgreSQL cluster."""
        try:
            # Set the OpenShift project
            self.set_oc_project(db_config)

            # Get all pods with the app label
            result = subprocess.run(
                ["oc", "get", "pods", "-o", "name"],
                capture_output=True,
                text=True,
                check=True,
            )

            pods = [
                pod.strip()
                for pod in result.stdout.split("\n")
                if db_config.app_label in pod
            ]

            # Find the leader pod
            for pod in pods:
                try:
                    cmd = [
                        "oc",
                        "exec",
                        pod,
                        "--",
                        "bash",
                        "-c",
                        f'psql -U {db_config.remote_db_user} -tAc "SELECT pg_is_in_recovery()"',
                    ]
                    result = subprocess.run(
                        cmd, capture_output=True, text=True, check=True
                    )

                    if result.stdout.strip() == "f":
                        self.logger.info(f"Leader pod identified: {pod}")
                        return pod
                except subprocess.CalledProcessError:
                    continue

            self.logger.error("No leader pod found")
            return None

        except subprocess.CalledProcessError as e:
            self.logger.error(f"Error finding leader pod: {e}")
            return None

    def transfer_data(
        self,
        app: Application,
        env: Environment,
        direction: Direction,
        container_name: str,
        table_name: Optional[str] = None,
    ) -> bool:
        """Transfer data between OpenShift and local container."""

        # Validation - NO EXPORTS TO PRODUCTION ALLOWED
        if app == Application.TFRS and direction == Direction.EXPORT:
            self.logger.error("Export operation is not supported for TFRS application")
            return False

        if direction == Direction.EXPORT and env == Environment.PROD:
            self.logger.error(
                "SECURITY: Export to production environment is strictly prohibited"
            )
            return False

        if not self.check_openshift_login():
            return False

        if not self.check_docker_container(container_name):
            return False

        db_config = self.get_database_config(app, env)

        # pod_name = self.get_leader_pod(db_config)
        # manually set pod name because getting leader pod is challenging
        if app == Application.TFRS:
            pod_name = "tfrs-crunchy-prod-tfrs-n4pf-0"
        elif app == Application.LCFS:
            pod_name = "lcfs-crunchy-prod-lcfs-2znf-0"

        if not pod_name:
            return False

        # Set the OpenShift project
        self.set_oc_project(db_config)

        # Set up file naming
        table_option = f"-t {table_name}" if table_name else ""
        file_suffix = (
            f"{db_config.db_name}_{table_name}" if table_name else db_config.db_name
        )
        dump_file = f"{file_suffix}.tar"

        try:
            if direction == Direction.IMPORT:
                return self._import_data(
                    pod_name, db_config, container_name, table_option, dump_file
                )
            # else:
            #     return self._export_data(
            #         pod_name, db_config, container_name, table_option, dump_file
            #     )
        except Exception as e:
            self.logger.error(f"Data transfer failed: {e}")
            return False

    def _get_dump_dir(self) -> str:
        """Get the directory for storing database dumps."""
        # Create a dumps directory relative to the script location
        script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        dump_dir = os.path.join(script_dir, "dumps")
        if not os.path.exists(dump_dir):
            os.makedirs(dump_dir)
        return dump_dir

    def _import_data(
        self,
        pod_name: str,
        db_config: DatabaseConfig,
        container_name: str,
        table_option: str,
        dump_file: str,
    ) -> bool:
        """Import data from OpenShift to local container."""
        dump_dir = self._get_dump_dir()
        local_dump_path = os.path.join(dump_dir, dump_file)
        
        # Check if .tar file already exists
        if os.path.exists(local_dump_path):
            self.logger.info(f"Dump file {dump_file} already exists, skipping download from OpenShift")
        else:
            self.logger.info("Selecting openshift namespace")

            self.logger.info("Starting pg_dump on OpenShift pod")
            cmd = [
                "oc",
                "exec",
                pod_name,
                "--",
                "bash",
                "-c",
                f"pg_dump -U {db_config.remote_db_user} {table_option} -F t --no-privileges --no-owner -c -d {db_config.db_name} > /tmp/{dump_file}",
            ]
            subprocess.run(cmd, check=True)

            self.logger.info("Downloading dump file from OpenShift pod")
            subprocess.run(
                ["oc", "rsync", f"{pod_name}:/tmp/{dump_file}", dump_dir + "/"],
                check=True,
            )

            # Cleanup OpenShift pod dump file
            self.logger.info("Cleaning up dump file from OpenShift pod")
            subprocess.run(
                ["oc", "exec", pod_name, "--", "rm", f"/tmp/{dump_file}"], check=False
            )
        
        try:
            self.logger.info(f"Copying dump file to local container {container_name}")
            subprocess.run(
                ["docker", "cp", local_dump_path, f"{container_name}:/tmp/{dump_file}"],
                check=True,
            )

            self.logger.info("Restoring local database")
            cmd = [
                "docker",
                "exec",
                container_name,
                "bash",
                "-c",
                f"pg_restore -U {db_config.local_db_user} --dbname={db_config.db_name} --no-owner --clean --if-exists --verbose /tmp/{dump_file}",
            ]
            subprocess.run(cmd, check=False)  # Allow some errors in restore

            # Cleanup only Docker container dump file
            self.logger.info("Cleaning up dump file from Docker container")
            subprocess.run(
                ["docker", "exec", container_name, "rm", f"/tmp/{dump_file}"],
                check=False,
            )

            return True

        except subprocess.CalledProcessError as e:
            self.logger.error(f"Import failed: {e}")
            return False

    # def _export_data(
    #     self,
    #     pod_name: str,
    #     db_config: DatabaseConfig,
    #     container_name: str,
    #     table_option: str,
    #     dump_file: str,
    # ) -> bool:
    #     """Export data from local container to OpenShift."""
    #     temp_dir = None
    #     try:
    #         temp_dir = tempfile.mkdtemp()
    #         local_dump_path = os.path.join(temp_dir, dump_file)

    #         self.logger.info("Starting pg_dump on local container")
    #         cmd = [
    #             "docker",
    #             "exec",
    #             container_name,
    #             "bash",
    #             "-c",
    #             f"pg_dump -U {db_config.local_db_user} {table_option} -F t --no-privileges --no-owner -c -d {db_config.db_name} > /tmp/{dump_file}",
    #         ]
    #         subprocess.run(cmd, check=True)

    #         self.logger.info("Copying dump file from local container")
    #         subprocess.run(
    #             ["docker", "cp", f"{container_name}:/tmp/{dump_file}", local_dump_path],
    #             check=True,
    #         )

    #         # Create transfer directory structure
    #         transfer_dir = os.path.join(temp_dir, "tmp_transfer")
    #         os.makedirs(transfer_dir)
    #         shutil.move(local_dump_path, os.path.join(transfer_dir, dump_file))

    #         self.logger.info("Uploading dump file to OpenShift pod")
    #         subprocess.run(
    #             ["oc", "rsync", transfer_dir, f"{pod_name}:/tmp/"], check=True
    #         )

    #         self.logger.info("Restoring database on OpenShift pod")
    #         cmd = [
    #             "oc",
    #             "exec",
    #             pod_name,
    #             "--",
    #             "bash",
    #             "-c",
    #             f"pg_restore -U {db_config.remote_db_user} --dbname={db_config.db_name} --no-owner --clean --if-exists --verbose /tmp/tmp_transfer/{dump_file}",
    #         ]
    #         subprocess.run(cmd, check=False)  # Allow some errors in restore

    #         # Cleanup
    #         self.logger.info("Cleaning up temporary files")
    #         subprocess.run(
    #             ["oc", "exec", pod_name, "--", "rm", "-rf", "/tmp/tmp_transfer"],
    #             check=False,
    #         )
    #         subprocess.run(
    #             ["docker", "exec", container_name, "rm", f"/tmp/{dump_file}"],
    #             check=False,
    #         )

    #         return True

    #     except subprocess.CalledProcessError as e:
    #         self.logger.error(f"Export failed: {e}")
    #         return False
    #     finally:
    #         if temp_dir and os.path.exists(temp_dir):
    #             shutil.rmtree(temp_dir)

    def verify_database_population(self, app: Application) -> Dict[str, int]:
        """Verify that databases are properly populated with data."""
        self.logger.info(f"Verifying {app.value} database population")

        if app == Application.TFRS:
            return self._verify_tfrs_population()
        else:
            return self._verify_lcfs_population()

    def _verify_tfrs_population(self) -> Dict[str, int]:
        """Verify TFRS database has required tables and data."""
        required_tables = {
            "compliance_report": "SELECT COUNT(*) FROM compliance_report",
            "compliance_report_schedule_b_record": "SELECT COUNT(*) FROM compliance_report_schedule_b_record",
            "compliance_report_schedule_a_record": "SELECT COUNT(*) FROM compliance_report_schedule_a_record",
            "compliance_report_schedule_c_record": "SELECT COUNT(*) FROM compliance_report_schedule_c_record",
            "compliance_report_exclusion_agreement_record": "SELECT COUNT(*) FROM compliance_report_exclusion_agreement_record",
        }

        results = {}
        try:
            with get_source_connection() as conn:
                with conn.cursor() as cursor:
                    for table, query in required_tables.items():
                        try:
                            cursor.execute(query)
                            count = cursor.fetchone()[0]
                            results[table] = count
                            self.logger.info(f"TFRS {table}: {count} records")
                        except Exception as e:
                            self.logger.warning(f"Could not query {table}: {e}")
                            results[table] = -1
        except Exception as e:
            self.logger.error(f"Could not connect to TFRS database: {e}")

        return results

    def _verify_lcfs_population(self) -> Dict[str, int]:
        """Verify LCFS database has required tables and structure."""
        required_tables = {
            "compliance_report": "SELECT COUNT(*) FROM compliance_report",
            "fuel_supply": "SELECT COUNT(*) FROM fuel_supply",
            "notional_transfer": "SELECT COUNT(*) FROM notional_transfer",
            "other_uses": "SELECT COUNT(*) FROM other_uses",
            "allocation_agreement": "SELECT COUNT(*) FROM allocation_agreement",
        }

        results = {}
        try:
            with get_destination_connection() as conn:
                with conn.cursor() as cursor:
                    for table, query in required_tables.items():
                        try:
                            cursor.execute(query)
                            count = cursor.fetchone()[0]
                            results[table] = count
                            self.logger.info(f"LCFS {table}: {count} records")
                        except Exception as e:
                            self.logger.warning(f"Could not query {table}: {e}")
                            results[table] = -1
        except Exception as e:
            self.logger.error(f"Could not connect to LCFS database: {e}")

        return results

    def setup_test_environment(
        self,
        tfrs_container: str,
        lcfs_container: str,
        env: Environment = Environment.DEV,
    ) -> bool:
        """Automatically set up both databases for testing."""
        self.logger.info("Setting up test environment...")

        # Import TFRS data
        self.logger.info("Setting up TFRS database...")
        tfrs_success = self.transfer_data(
            Application.TFRS, env, Direction.IMPORT, tfrs_container
        )

        if not tfrs_success:
            self.logger.error("Failed to set up TFRS database")
            return False

        # Import LCFS data
        self.logger.info("Setting up LCFS database...")
        lcfs_success = self.transfer_data(
            Application.LCFS, env, Direction.IMPORT, lcfs_container
        )

        if not lcfs_success:
            self.logger.error("Failed to set up LCFS database")
            return False

        # Verify both databases
        tfrs_data = self.verify_database_population(Application.TFRS)
        lcfs_data = self.verify_database_population(Application.LCFS)

        # Check if we have sufficient data for migration testing
        min_required_records = 10  # Minimum records needed for meaningful testing

        tfrs_ready = (
            tfrs_data.get("compliance_report", 0) >= min_required_records
            and tfrs_data.get("compliance_report_schedule_b_record", 0)
            >= min_required_records
        )

        lcfs_ready = (
            lcfs_data.get("compliance_report", 0) >= 0  # LCFS can be empty initially
        )

        if tfrs_ready and lcfs_ready:
            self.logger.info("✅ Test environment setup completed successfully")
            self.logger.info("Databases are ready for migration testing")
            return True
        else:
            self.logger.error("❌ Test environment setup incomplete")
            self.logger.error("Insufficient data for migration testing")
            return False

    def setup_prod_environment(self, tfrs_container: str, lcfs_container: str) -> bool:
        """Set up both databases using production data for testing."""
        self.logger.info("Setting up production environment...")
        self.logger.warning("⚠️  This will import PRODUCTION data to local containers")

        # Import TFRS production data
        self.logger.info("Setting up TFRS database with production data...")
        tfrs_success = self.transfer_data(
            Application.TFRS, Environment.PROD, Direction.IMPORT, tfrs_container
        )

        if not tfrs_success:
            self.logger.error("Failed to set up TFRS database with production data")
            return False

        # Import LCFS production data
        self.logger.info("Setting up LCFS database with production data...")
        lcfs_success = self.transfer_data(
            Application.LCFS, Environment.PROD, Direction.IMPORT, lcfs_container
        )

        if not lcfs_success:
            self.logger.error("Failed to set up LCFS database with production data")
            return False

        # Verify both databases
        tfrs_data = self.verify_database_population(Application.TFRS)
        lcfs_data = self.verify_database_population(Application.LCFS)

        # For production data, we expect substantial amounts of data
        min_prod_records = 100  # Minimum records expected in production

        tfrs_ready = (
            tfrs_data.get("compliance_report", 0) >= min_prod_records
            and tfrs_data.get("compliance_report_schedule_b_record", 0)
            >= min_prod_records
        )

        lcfs_ready = (
            lcfs_data.get("compliance_report", 0) >= 0  # LCFS can have existing data
        )

        if tfrs_ready and lcfs_ready:
            self.logger.info("✅ Production environment setup completed successfully")
            self.logger.info("Databases are loaded with production data")
            self.logger.info(
                f"TFRS compliance reports: {tfrs_data.get('compliance_report', 0)}"
            )
            self.logger.info(
                f"TFRS fuel supply records: {tfrs_data.get('compliance_report_schedule_b_record', 0)}"
            )
            self.logger.info(
                f"LCFS compliance reports: {lcfs_data.get('compliance_report', 0)}"
            )
            return True
        else:
            self.logger.error("❌ Production environment setup incomplete")
            self.logger.error("Insufficient production data loaded")
            if not tfrs_ready:
                self.logger.error(
                    f"TFRS data insufficient - need at least {min_prod_records} records"
                )
            return False

    def check_migration_readiness(self) -> Tuple[bool, List[str]]:
        """Check if databases are ready for migration."""
        issues = []

        # Verify TFRS source data
        tfrs_data = self.verify_database_population(Application.TFRS)
        if tfrs_data.get("compliance_report", 0) == 0:
            issues.append("No compliance reports found in TFRS database")

        # Verify LCFS destination is accessible
        lcfs_data = self.verify_database_population(Application.LCFS)
        if not lcfs_data:  # Empty dict means connection failed
            issues.append("Cannot connect to LCFS database")

        # Check for required TFRS tables
        required_tfrs_tables = [
            "compliance_report_schedule_b_record",
            "compliance_report_schedule_a_record",
            "compliance_report_schedule_c_record",
            "compliance_report_exclusion_agreement_record",
        ]

        for table in required_tfrs_tables:
            if tfrs_data.get(table, -1) == -1:
                issues.append(f"Cannot access TFRS table: {table}")

        is_ready = len(issues) == 0

        if is_ready:
            self.logger.info("✅ Databases are ready for migration")
        else:
            self.logger.error("❌ Migration readiness check failed")
            for issue in issues:
                self.logger.error(f"  - {issue}")

        return is_ready, issues

    def reset_database(self, app: Application, container_name: str, env: Environment = Environment.DEV) -> bool:
        """Reset database from existing .tar file."""
        db_config = self.get_database_config(app, env)
        dump_file = f"{db_config.db_name}.tar"
        dump_dir = self._get_dump_dir()
        local_dump_path = os.path.join(dump_dir, dump_file)
        
        # Check if dump file exists
        if not os.path.exists(local_dump_path):
            self.logger.error(f"Dump file {dump_file} not found in {dump_dir}")
            self.logger.error(f"Please run 'make setup-{env.value}' first to download the dump file")
            return False
        
        # Check if Docker container is running
        if not self.check_docker_container(container_name):
            return False
        
        self.logger.info(f"Resetting {app.value} database from {dump_file}")
        
        try:
            # Copy dump file to container
            self.logger.info(f"Copying dump file to local container {container_name}")
            subprocess.run(
                ["docker", "cp", local_dump_path, f"{container_name}:/tmp/{dump_file}"],
                check=True,
            )
            
            # Restore database
            self.logger.info("Restoring database")
            cmd = [
                "docker",
                "exec",
                container_name,
                "bash",
                "-c",
                f"pg_restore -U {db_config.local_db_user} --dbname={db_config.db_name} --no-owner --clean --if-exists --verbose /tmp/{dump_file}",
            ]
            subprocess.run(cmd, check=False)  # Allow some errors in restore
            
            # Cleanup container dump file
            self.logger.info("Cleaning up dump file from Docker container")
            subprocess.run(
                ["docker", "exec", container_name, "rm", f"/tmp/{dump_file}"],
                check=False,
            )
            
            self.logger.info(f"✅ {app.value} database reset successfully")
            return True
            
        except subprocess.CalledProcessError as e:
            self.logger.error(f"Reset failed: {e}")
            return False


def main():
    """Main CLI interface."""
    if len(sys.argv) < 2:
        print("Usage:")
        print(
            "  python database_manager.py setup <tfrs_container> <lcfs_container> [env]"
        )
        print(
            "  python database_manager.py setup-prod <tfrs_container> <lcfs_container>"
        )
        print("  python database_manager.py verify-tfrs")
        print("  python database_manager.py verify-lcfs")
        print("  python database_manager.py check-readiness")
        print("  python database_manager.py reset <app> <container> [env]")
        print(
            "  python database_manager.py transfer <app> <env> <direction> <container> [table]"
        )
        sys.exit(1)

    setup = DatabaseSetup()
    command = sys.argv[1]

    if command == "setup":
        if len(sys.argv) < 4:
            print(
                "Usage: python database_manager.py setup <tfrs_container> <lcfs_container> [env]"
            )
            sys.exit(1)

        tfrs_container = sys.argv[2]
        lcfs_container = sys.argv[3]
        env = Environment(sys.argv[4]) if len(sys.argv) > 4 else Environment.DEV

        success = setup.setup_test_environment(tfrs_container, lcfs_container, env)
        sys.exit(0 if success else 1)

    elif command == "setup-prod":
        if len(sys.argv) < 4:
            print(
                "Usage: python database_manager.py setup-prod <tfrs_container> <lcfs_container>"
            )
            sys.exit(1)

        tfrs_container = sys.argv[2]
        lcfs_container = sys.argv[3]

        # Confirm production data import
        print("⚠️  WARNING: This will import PRODUCTION data to your local containers!")
        print("This may take significant time and will overwrite existing data.")
        confirmation = input("Are you sure you want to proceed? (yes/no): ")

        if confirmation.lower() != "yes":
            print("Production setup cancelled.")
            sys.exit(0)

        success = setup.setup_prod_environment(tfrs_container, lcfs_container)
        sys.exit(0 if success else 1)

    elif command == "verify-tfrs":
        setup.verify_database_population(Application.TFRS)

    elif command == "verify-lcfs":
        setup.verify_database_population(Application.LCFS)

    elif command == "check-readiness":
        is_ready, issues = setup.check_migration_readiness()
        sys.exit(0 if is_ready else 1)

    elif command == "reset":
        if len(sys.argv) < 4:
            print("Usage: python database_manager.py reset <app> <container> [env]")
            sys.exit(1)
        
        app = Application(sys.argv[2])
        container = sys.argv[3]
        env = Environment(sys.argv[4]) if len(sys.argv) > 4 else Environment.DEV
        
        success = setup.reset_database(app, container, env)
        sys.exit(0 if success else 1)

    elif command == "transfer":
        if len(sys.argv) < 6:
            print(
                "Usage: python database_setup.py transfer <app> <env> <direction> <container> [table]"
            )
            sys.exit(1)

        app = Application(sys.argv[2])
        env = Environment(sys.argv[3])
        direction = Direction(sys.argv[4])
        container = sys.argv[5]
        table = sys.argv[6] if len(sys.argv) > 6 else None

        success = setup.transfer_data(app, env, direction, container, table)
        sys.exit(0 if success else 1)

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
