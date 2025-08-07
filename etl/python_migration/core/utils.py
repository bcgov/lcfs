import logging
from datetime import datetime
from decimal import Decimal
from typing import Dict, Any, Optional

def setup_logging(log_level=logging.INFO):
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler(f'migration_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log')
        ]
    )

def safe_decimal(value: Any, default: Decimal = Decimal('0.0')) -> Decimal:
    if value is None:
        return default
    try:
        return Decimal(str(value))
    except (ValueError, TypeError):
        return default

def safe_int(value: Any, default: int = 0) -> int:
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default

def safe_str(value: Any, default: str = '') -> str:
    if value is None:
        return default
    return str(value)

def execute_query_with_retry(cursor, query: str, params: tuple = None, max_retries: int = 3) -> bool:
    for attempt in range(max_retries):
        try:
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            return True
        except Exception as e:
            logging.warning(f"Query attempt {attempt + 1} failed: {e}")
            if attempt == max_retries - 1:
                logging.error(f"Query failed after {max_retries} attempts: {e}")
                raise
    return False

def build_legacy_mapping(cursor, table_name: str = "compliance_report") -> Dict[int, int]:
    query = f"SELECT compliance_report_id, legacy_id FROM {table_name} WHERE legacy_id IS NOT NULL"
    cursor.execute(query)
    mapping = {}
    for row in cursor.fetchall():
        lcfs_id, legacy_id = row
        mapping[legacy_id] = lcfs_id
    return mapping