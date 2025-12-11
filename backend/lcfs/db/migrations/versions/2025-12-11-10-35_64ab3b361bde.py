"""Modify constraint on compliance report charging equipment

Revision ID: 64ab3b361bde
Revises: b8c9d0e1f2a3
Create Date: 2025-12-11 10:35:57.365155

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "64ab3b361bde"
down_revision = "b8c9d0e1f2a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        "uix_compliance_reporting_equipment_dates",
        "compliance_report_charging_equipment",
        type_="unique",
    )
    op.create_unique_constraint(
        "uix_compliance_reporting_equipment_dates",
        "compliance_report_charging_equipment",
        [
            "compliance_report_group_uuid",
            "charging_equipment_id",
            "charging_equipment_version",
            "supply_from_date",
            "supply_to_date",
        ],
    )

def downgrade() -> None:
    pass
