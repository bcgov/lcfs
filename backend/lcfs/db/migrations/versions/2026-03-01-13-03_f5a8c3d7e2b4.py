"""Add Exempted compliance report status and exemption flag columns.

Revision ID: f5a8c3d7e2b4
Revises: 8e9f1a2b3c4d
Create Date: 2026-02-23 10:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "f5a8c3d7e2b4"
down_revision = "8e9f1a2b3c4d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 1: Add the new enum value (must be in autocommit block)
    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE compliancereportstatusenum ADD VALUE IF NOT EXISTS 'Exempted'"
        )

    # Step 2: Insert into compliance_report_status lookup table
    op.execute(
        sa.text(
            "INSERT INTO compliance_report_status "
            "(compliance_report_status_id, status, effective_status) "
            "VALUES (12, 'Exempted'::compliancereportstatusenum, true)"
        )
    )

    # Step 3: Add exemption flag columns to compliance_report table
    op.add_column(
        "compliance_report",
        sa.Column(
            "is_renewable_fuel_exempted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="Flag indicating exemption from the renewable fuel requirement",
        ),
    )
    op.add_column(
        "compliance_report",
        sa.Column(
            "is_low_carbon_fuel_exempted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="Flag indicating exemption from the low carbon fuel requirement",
        ),
    )


def downgrade() -> None:
    # Remove the exemption flag columns
    op.drop_column("compliance_report", "is_low_carbon_fuel_exempted")
    op.drop_column("compliance_report", "is_renewable_fuel_exempted")

    # Remove the row from the lookup table
    op.execute(
        sa.text(
            "DELETE FROM compliance_report_status WHERE status = 'Exempted'::compliancereportstatusenum"
        )
    )
    # PostgreSQL does not support removing enum values in-place.
