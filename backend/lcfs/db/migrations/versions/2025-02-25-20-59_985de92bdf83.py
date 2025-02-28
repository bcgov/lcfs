"""Re-calculate Summaries

Revision ID: 985de92bdf83
Revises: 16e4ebc2d6a5
Create Date: 2025-02-25 20:59:28.890262

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "985de92bdf83"
down_revision = "16e4ebc2d6a5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_compliance_report_id_status_id",
        "compliance_report_history",
        ["compliance_report_id", "status_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_compliance_report_id_status_id", "compliance_report_history", type_="unique"
    )
