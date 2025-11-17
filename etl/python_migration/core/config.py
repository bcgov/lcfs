import os
from dotenv import load_dotenv

load_dotenv()

class DatabaseConfig:
    def __init__(self):
        # TFRS (source) database configuration
        self.tfrs_config = {
            'host': os.getenv('TFRS_DB_HOST', 'localhost'),
            'port': int(os.getenv('TFRS_DB_PORT', 5432)),
            'database': os.getenv('TFRS_DB_NAME', 'tfrs'),
            'user': os.getenv('TFRS_DB_USER', 'tfrs_user'),
            'password': os.getenv('TFRS_DB_PASSWORD', 'tfrs_password')
        }
        
        # LCFS (destination) database configuration
        self.lcfs_config = {
            'host': os.getenv('LCFS_DB_HOST', 'localhost'),
            'port': int(os.getenv('LCFS_DB_PORT', 5432)),
            'database': os.getenv('LCFS_DB_NAME', 'lcfs'),
            'user': os.getenv('LCFS_DB_USER', 'lcfs_user'),
            'password': os.getenv('LCFS_DB_PASSWORD', 'lcfs_password')
        }

db_config = DatabaseConfig()