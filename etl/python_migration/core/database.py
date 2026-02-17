import psycopg2
import logging
from contextlib import contextmanager
from .config import db_config

logger = logging.getLogger(__name__)


class DatabaseConnection:
    def __init__(self, config):
        self.config = config

    @contextmanager
    def get_connection(self):
        conn = None
        try:
            conn = psycopg2.connect(**self.config)
            conn.autocommit = False
            yield conn
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Database connection error: {e}")
            raise
        finally:
            if conn:
                conn.close()

    def test_connection(self):
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT 1")
                result = cursor.fetchone()
                cursor.close()
                return result[0] == 1
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return False


# Database connection instances
tfrs_db = DatabaseConnection(db_config.tfrs_config)
lcfs_db = DatabaseConnection(db_config.lcfs_config)

# Connection instances
get_source_connection = DatabaseConnection(db_config.tfrs_config).get_connection
get_destination_connection = DatabaseConnection(db_config.lcfs_config).get_connection
