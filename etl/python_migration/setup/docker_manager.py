"""
Docker management utilities for TFRS to LCFS migration.
Handles automatic container startup and container ID retrieval.
"""

import os
import sys
import logging
import subprocess
import time
from typing import Dict, List, Optional, Tuple
from pathlib import Path

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database_manager import DatabaseSetup, Environment, Application


class DockerManager:
    """Manages Docker containers for migration testing."""

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.setup_logging()
        self.migration_compose_path = (
            Path(__file__).parent.parent / "docker-compose.yml"
        )
        self.lcfs_compose_path = (
            Path(__file__).parent.parent / "../../docker-compose.yml"
        )

    def setup_logging(self):
        """Set up logging configuration."""
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        )

    def check_docker_available(self) -> bool:
        """Check if Docker is available and running."""
        try:
            result = subprocess.run(
                ["docker", "--version"], capture_output=True, text=True, check=True
            )
            self.logger.info(f"Docker available: {result.stdout.strip()}")

            # Check if Docker daemon is running
            subprocess.run(["docker", "ps"], capture_output=True, text=True, check=True)
            return True

        except (subprocess.CalledProcessError, FileNotFoundError):
            self.logger.error("Docker is not available or not running")
            return False

    def check_docker_compose_available(self) -> bool:
        """Check if Docker Compose is available."""
        try:
            result = subprocess.run(
                ["docker", "compose", "version"],
                capture_output=True,
                text=True,
                check=True,
            )
            self.logger.info(f"Docker Compose available: {result.stdout.strip()}")
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            # Try legacy docker-compose command
            try:
                result = subprocess.run(
                    ["docker-compose", "--version"],
                    capture_output=True,
                    text=True,
                    check=True,
                )
                self.logger.info(
                    f"Docker Compose (legacy) available: {result.stdout.strip()}"
                )
                return True
            except (subprocess.CalledProcessError, FileNotFoundError):
                self.logger.error("Docker Compose is not available")
                return False

    def get_compose_command(self) -> List[str]:
        """Get the appropriate docker compose command."""
        try:
            subprocess.run(
                ["docker", "compose", "version"],
                capture_output=True,
                text=True,
                check=True,
            )
            return ["docker", "compose"]
        except (subprocess.CalledProcessError, FileNotFoundError):
            return ["docker-compose"]

    def start_tfrs_container(self) -> Optional[str]:
        """Start TFRS container using docker-compose and return container ID."""
        if not self.migration_compose_path.exists():
            self.logger.error(
                f"Docker compose file not found: {self.migration_compose_path}"
            )
            return None

        try:
            compose_cmd = self.get_compose_command()

            self.logger.info("Starting TFRS container...")

            # Start the TFRS service
            cmd = compose_cmd + [
                "-f",
                str(self.migration_compose_path),
                "up",
                "-d",
                "tfrs",
            ]
            subprocess.run(cmd, check=True, cwd=self.migration_compose_path.parent)

            # Wait for container to be healthy
            self.logger.info("Waiting for TFRS container to be ready...")
            if self.wait_for_container_healthy("tfrs-migration", timeout=60):
                container_id = self.get_container_id("tfrs-migration")
                if container_id:
                    self.logger.info(f"✅ TFRS container ready: {container_id}")
                    return container_id
                else:
                    self.logger.error("Could not get TFRS container ID")
                    return None
            else:
                self.logger.error("TFRS container failed to become healthy")
                return None

        except subprocess.CalledProcessError as e:
            self.logger.error(f"Failed to start TFRS container: {e}")
            return None

    def start_lcfs_environment(self) -> Optional[str]:
        """Start LCFS environment and return LCFS database container ID."""
        if not self.lcfs_compose_path.exists():
            self.logger.error(
                f"LCFS docker compose file not found: {self.lcfs_compose_path}"
            )
            return None

        try:
            compose_cmd = self.get_compose_command()

            self.logger.info("Starting LCFS environment...")

            # Start the LCFS environment
            cmd = compose_cmd + ["-f", str(self.lcfs_compose_path), "up", "-d"]
            subprocess.run(cmd, check=True, cwd=self.lcfs_compose_path.parent)

            # Wait for database to be ready
            self.logger.info("Waiting for LCFS database to be ready...")

            # Try common LCFS database container names
            possible_names = [
                "lcfs-crunchy-postgres-primary",
                "lcfs-postgres",
                "postgres",
                "lcfs-db",
                "db",
            ]

            for container_name in possible_names:
                if self.container_exists(container_name):
                    if self.wait_for_container_healthy(container_name, timeout=120):
                        container_id = self.get_container_id(container_name)
                        if container_id:
                            self.logger.info(
                                f"✅ LCFS database ready: {container_id} ({container_name})"
                            )
                            return container_id

            # If no specific container found, list all containers and let user choose
            self.logger.warning(
                "Could not automatically identify LCFS database container"
            )
            self.list_running_containers()
            return None

        except subprocess.CalledProcessError as e:
            self.logger.error(f"Failed to start LCFS environment: {e}")
            return None

    def get_container_id(self, container_name: str) -> Optional[str]:
        """Get container ID by container name."""
        try:
            result = subprocess.run(
                ["docker", "ps", "-q", "-f", f"name={container_name}"],
                capture_output=True,
                text=True,
                check=True,
            )
            container_id = result.stdout.strip()
            return container_id if container_id else None
        except subprocess.CalledProcessError:
            return None

    def container_exists(self, container_name: str) -> bool:
        """Check if a container exists and is running."""
        try:
            result = subprocess.run(
                [
                    "docker",
                    "ps",
                    "-f",
                    f"name={container_name}",
                    "--format",
                    "{{.Names}}",
                ],
                capture_output=True,
                text=True,
                check=True,
            )
            return container_name in result.stdout
        except subprocess.CalledProcessError:
            return False

    def wait_for_container_healthy(
        self, container_name: str, timeout: int = 60
    ) -> bool:
        """Wait for container to become healthy or ready."""
        start_time = time.time()

        while time.time() - start_time < timeout:
            try:
                # Check if container is running
                result = subprocess.run(
                    [
                        "docker",
                        "ps",
                        "-f",
                        f"name={container_name}",
                        "--format",
                        "{{.Status}}",
                    ],
                    capture_output=True,
                    text=True,
                    check=True,
                )

                if not result.stdout.strip():
                    self.logger.warning(f"Container {container_name} not found")
                    time.sleep(2)
                    continue

                # Check health status
                health_result = subprocess.run(
                    [
                        "docker",
                        "inspect",
                        container_name,
                        "--format",
                        "{{.State.Health.Status}}",
                    ],
                    capture_output=True,
                    text=True,
                    check=False,
                )

                if health_result.returncode == 0:
                    health_status = health_result.stdout.strip()
                    if health_status == "healthy":
                        return True
                    elif health_status == "unhealthy":
                        self.logger.warning(f"Container {container_name} is unhealthy")
                        return False
                    else:
                        self.logger.debug(
                            f"Container {container_name} health status: {health_status}"
                        )
                else:
                    # No health check defined, check if container is running
                    status_result = subprocess.run(
                        [
                            "docker",
                            "inspect",
                            container_name,
                            "--format",
                            "{{.State.Status}}",
                        ],
                        capture_output=True,
                        text=True,
                        check=True,
                    )

                    if status_result.stdout.strip() == "running":
                        # Additional check for PostgreSQL containers
                        if self.check_postgres_ready(container_name):
                            return True

                time.sleep(2)

            except subprocess.CalledProcessError as e:
                self.logger.debug(f"Error checking container {container_name}: {e}")
                time.sleep(2)

        return False

    def check_postgres_ready(self, container_name: str) -> bool:
        """Check if PostgreSQL is ready to accept connections."""
        try:
            # Try to connect to PostgreSQL
            result = subprocess.run(
                ["docker", "exec", container_name, "pg_isready"],
                capture_output=True,
                text=True,
                check=False,
            )
            return result.returncode == 0
        except subprocess.CalledProcessError:
            return False

    def list_running_containers(self):
        """List all running containers for user reference."""
        try:
            result = subprocess.run(
                [
                    "docker",
                    "ps",
                    "--format",
                    "table {{.ID}}\\t{{.Names}}\\t{{.Status}}",
                ],
                capture_output=True,
                text=True,
                check=True,
            )
            self.logger.info("Running containers:")
            self.logger.info(result.stdout)
        except subprocess.CalledProcessError:
            self.logger.error("Could not list running containers")

    def stop_containers(self):
        """Stop migration-related containers."""
        try:
            compose_cmd = self.get_compose_command()

            # Stop TFRS container
            if self.migration_compose_path.exists():
                self.logger.info("Stopping TFRS container...")
                cmd = compose_cmd + ["-f", str(self.migration_compose_path), "down"]
                subprocess.run(cmd, check=True, cwd=self.migration_compose_path.parent)

        except subprocess.CalledProcessError as e:
            self.logger.error(f"Failed to stop containers: {e}")

    def setup_migration_environment(
        self, env: Environment = Environment.DEV, start_lcfs: bool = True
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Set up complete migration environment with automatic container management.

        Returns:
            Tuple of (tfrs_container_id, lcfs_container_id)
        """
        if (
            not self.check_docker_available()
            or not self.check_docker_compose_available()
        ):
            return None, None

        self.logger.info("🚀 Setting up migration environment...")

        # Start TFRS container
        tfrs_container_id = self.start_tfrs_container()
        if not tfrs_container_id:
            self.logger.error("Failed to start TFRS container")
            return None, None

        # Start LCFS environment if requested
        lcfs_container_id = None
        if start_lcfs:
            lcfs_container_id = self.start_lcfs_environment()
            if not lcfs_container_id:
                self.logger.warning("Could not automatically identify LCFS container")
                self.logger.info("Please identify the LCFS database container manually")

        # Now set up databases with data
        db_setup = DatabaseSetup()

        # Setup TFRS database
        self.logger.info("Setting up TFRS database with data...")
        from database_manager import Direction

        tfrs_success = db_setup.transfer_data(
            Application.TFRS, env, Direction.IMPORT, tfrs_container_id
        )

        if not tfrs_success:
            self.logger.error("Failed to setup TFRS database")
            return tfrs_container_id, lcfs_container_id

        # Setup LCFS database if container available
        if lcfs_container_id:
            self.logger.info("Setting up LCFS database with data...")
            lcfs_success = db_setup.transfer_data(
                Application.LCFS, env, Direction.IMPORT, lcfs_container_id
            )

            if not lcfs_success:
                self.logger.warning("Failed to setup LCFS database")

        self.logger.info("✅ Migration environment setup complete")
        self.logger.info(f"TFRS Container ID: {tfrs_container_id}")
        if lcfs_container_id:
            self.logger.info(f"LCFS Container ID: {lcfs_container_id}")

        return tfrs_container_id, lcfs_container_id


def main():
    """Main CLI interface."""
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python docker_manager.py setup [env] [--no-lcfs]")
        print("  python docker_manager.py start-tfrs")
        print("  python docker_manager.py start-lcfs")
        print("  python docker_manager.py stop")
        print("  python docker_manager.py list")
        sys.exit(1)

    manager = DockerManager()
    command = sys.argv[1]

    if command == "setup":
        env = (
            Environment(sys.argv[2])
            if len(sys.argv) > 2 and sys.argv[2] in ["dev", "test", "prod"]
            else Environment.DEV
        )
        start_lcfs = "--no-lcfs" not in sys.argv

        tfrs_id, lcfs_id = manager.setup_migration_environment(env, start_lcfs)

        if tfrs_id:
            print(f"TFRS_CONTAINER_ID={tfrs_id}")
        if lcfs_id:
            print(f"LCFS_CONTAINER_ID={lcfs_id}")

        sys.exit(0 if tfrs_id else 1)

    elif command == "start-tfrs":
        container_id = manager.start_tfrs_container()
        if container_id:
            print(f"TFRS_CONTAINER_ID={container_id}")
            sys.exit(0)
        else:
            sys.exit(1)

    elif command == "start-lcfs":
        container_id = manager.start_lcfs_environment()
        if container_id:
            print(f"LCFS_CONTAINER_ID={container_id}")
            sys.exit(0)
        else:
            sys.exit(1)

    elif command == "stop":
        manager.stop_containers()

    elif command == "list":
        manager.list_running_containers()

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
