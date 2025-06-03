"""metabase base models

Revision ID: 06fdd006426e
Revises: ac2cb0248135
Create Date: 2025-06-02 21:45:53.799212

"""

import logging
from alembic import op
from lcfs.db.utils import get_sql_content, split_and_execute

# revision identifiers, used by Alembic.
revision = "06fdd006426e"
down_revision = "ac2cb0248135"
branch_labels = None
depends_on = None

# Set up logging
logger = logging.getLogger("alembic.runtime.migration")

# Define the order of SQL operations
sql_paths = [
    "metabase/models/transfer_base",
    "metabase/models/compliance_report_fuel_supply_data",
    "metabase/models/fuel_supply",
    "metabase/models/fuel_supply_fuel_code",
    "metabase/models/compliance_report_base",
    "metabase/models/transaction_base",
    "metabase/models/allocation_agreement_base",
    "metabase/models/allocation_agreement_chained",
    "metabase/models/compliance_report_chained",
]


def upgrade() -> None:
    try:
        for path in sql_paths:
            split_and_execute(get_sql_content(f"{path}/upgrade.sql"))
    except Exception as e:
        logger.error(f"Migration upgrade failed: {e}", exc_info=True)
        raise


def downgrade() -> None:
    try:
        # Execute in reverse order for downgrade
        for path in reversed(sql_paths):
            split_and_execute(get_sql_content(f"{path}/downgrade.sql"))
    except Exception as e:
        logger.error(f"Migration downgrade failed: {e}", exc_info=True)
        raise
