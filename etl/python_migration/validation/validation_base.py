"""
Base validator class for TFRS to LCFS migration validation.
"""

import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Tuple
import sys
import os

# Add parent directory to path to import config and database modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import get_source_connection, get_destination_connection


class BaseValidator(ABC):
    """Base class for migration validation scripts."""

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        self.validation_results = {}

    def setup_logging(self):
        """Set up logging configuration."""
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        )

    @abstractmethod
    def get_validation_name(self) -> str:
        """Return the name of this validation."""
        pass

    @abstractmethod
    def validate(self) -> Dict[str, Any]:
        """Run the validation and return results."""
        pass

    def compare_record_counts(
        self,
        source_query: str,
        dest_query: str,
        source_params: List = None,
        dest_params: List = None,
    ) -> Dict[str, int]:
        """Compare record counts between source and destination."""
        with get_source_connection() as source_conn:
            with source_conn.cursor() as cursor:
                cursor.execute(source_query, source_params or [])
                source_count = cursor.fetchone()[0]

        with get_destination_connection() as dest_conn:
            with dest_conn.cursor() as cursor:
                cursor.execute(dest_query, dest_params or [])
                dest_count = cursor.fetchone()[0]

        return {
            "source_count": source_count,
            "dest_count": dest_count,
            "difference": dest_count - source_count,
        }

    def check_null_values(
        self, table_name: str, fields: List[str], where_clause: str = ""
    ) -> Dict[str, int]:
        """Check for NULL values in key fields."""
        null_checks = []
        for field in fields:
            null_checks.append(
                f"SUM(CASE WHEN {field} IS NULL THEN 1 ELSE 0 END) as null_{field.replace('.', '_')}"
            )

        query = f"""
            SELECT {', '.join(null_checks)}
            FROM {table_name}
            {where_clause}
        """

        with get_destination_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                result = cursor.fetchone()

                null_counts = {}
                for i, field in enumerate(fields):
                    field_key = field.replace(".", "_")
                    null_counts[f"null_{field_key}"] = result[i]

                return null_counts

    def validate_version_chains(
        self, table_name: str, where_clause: str = ""
    ) -> List[Dict[str, Any]]:
        """Validate version chain integrity."""
        query = f"""
            SELECT group_uuid, COUNT(*) as version_count, 
                   MIN(version) as min_version, MAX(version) as max_version
            FROM {table_name}
            {where_clause}
            GROUP BY group_uuid
            HAVING COUNT(*) > 1
            ORDER BY version_count DESC
            LIMIT 10
        """

        version_chains = []
        with get_destination_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                results = cursor.fetchall()

                for row in results:
                    group_uuid, version_count, min_version, max_version = row

                    # Check if versions are sequential
                    version_query = f"""
                        SELECT version FROM {table_name} 
                        WHERE group_uuid = %s 
                        ORDER BY version
                    """
                    cursor.execute(version_query, (group_uuid,))
                    versions = [r[0] for r in cursor.fetchall()]

                    is_sequential = len(versions) == (versions[-1] - versions[0] + 1)

                    version_chains.append(
                        {
                            "group_uuid": group_uuid,
                            "version_count": version_count,
                            "min_version": min_version,
                            "max_version": max_version,
                            "versions": versions,
                            "is_sequential": is_sequential,
                        }
                    )

        return version_chains

    def check_new_period_impact(self, table_name: str, user_filter: str) -> int:
        """Check if any new-period records were impacted by ETL."""
        query = f"""
            SELECT COUNT(*) as count
            FROM {table_name}
            WHERE create_user != 'ETL'
            AND update_user = 'ETL'
            {user_filter}
        """

        with get_destination_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                return cursor.fetchone()[0]

    def log_validation_results(self, results: Dict[str, Any]):
        """Log validation results in a formatted way."""
        validation_name = self.get_validation_name()
        self.logger.info(f"**** BEGIN {validation_name.upper()} VALIDATION ****")

        # Record counts
        if "record_counts" in results:
            counts = results["record_counts"]
            self.logger.info(f"Source record count: {counts['source_count']}")
            self.logger.info(f"Destination record count: {counts['dest_count']}")
            self.logger.info(f"Difference: {counts['difference']}")

        # Sample validation
        if "sample_validation" in results:
            sample = results["sample_validation"]
            self.logger.info(
                f"Found {sample['matches']}/{sample['total']} matching records"
            )

        # NULL value checks
        if "null_checks" in results:
            self.logger.info("\nData anomalies check:")
            for field, count in results["null_checks"].items():
                self.logger.info(f"Records with {field}: {count}")

        # Version chains
        if "version_chains" in results:
            chains = results["version_chains"]
            self.logger.info(f"\nVersion chain validation:")
            if chains:
                for chain in chains:
                    self.logger.info(
                        f"Group {chain['group_uuid']}: {chain['version_count']} versions "
                        f"({chain['min_version']} to {chain['max_version']})"
                    )
                    seq_status = (
                        "sequential" if chain["is_sequential"] else "non-sequential"
                    )
                    self.logger.info(
                        f"  Versions are {seq_status}: {', '.join(map(str, chain['versions']))}"
                    )
            else:
                self.logger.info("No version chains found")

        # New period impact
        if "new_period_impact" in results:
            impact = results["new_period_impact"]
            self.logger.info(f"\nNew period records impacted: {impact}")
            if impact > 0:
                self.logger.error(
                    f"WARNING: {impact} records from the latest reporting period were modified by ETL process"
                )
            else:
                self.logger.info("✓ No latest reporting period records were modified")

        self.logger.info(f"**** END {validation_name.upper()} VALIDATION ****")

    def run_validation(self) -> Dict[str, Any]:
        """Run the complete validation process."""
        try:
            self.setup_logging()
            results = self.validate()
            self.log_validation_results(results)
            return results
        except Exception as e:
            self.logger.error(f"Error in {self.get_validation_name()} validation: {e}")
            raise
