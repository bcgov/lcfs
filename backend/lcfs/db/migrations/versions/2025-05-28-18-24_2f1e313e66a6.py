"""metabase fuelcode base

Revision ID: 2f1e313e66a6
Revises: 72a3e3f6ac9a
Create Date: 2025-05-28 18:24:13.657636

"""

import logging
from alembic import op
from lcfs.db.utils import get_sql_content

# revision identifiers, used by Alembic.
revision = "2f1e313e66a6"
down_revision = "72a3e3f6ac9a"
branch_labels = None
depends_on = None

# Set up logging
logger = logging.getLogger("alembic.runtime.migration")


def upgrade() -> None:
    try:
        op.execute(get_sql_content("metabase/models/fuel_code_base_model/upgrade.sql"))
    except Exception as e:
        logger.error(f"Migration upgrade failed: {e}", exc_info=True)
        raise


def downgrade() -> None:
    try:
        op.execute(
            get_sql_content("metabase/models/fuel_code_base_model/downgrade.sql")
        )
    except Exception as e:
        logger.error(f"Migration downgrade failed: {e}", exc_info=True)
        raise
