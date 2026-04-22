"""Add Exempted compliance report status and exemption flag columns.

Revision ID: f5a8c3d7e2b4
Revises: f4c8a1b2d3e5
Create Date: 2026-03-01 13:03:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect


def column_exists(table_name, column_name):
    """Check if a column exists in a table"""
    bind = op.get_bind()
    columns = [col["name"] for col in inspect(bind).get_columns(table_name)]
    return column_name in columns

# revision identifiers, used by Alembic.
revision = "f5a8c3d7e2b4"
down_revision = "f4c8a1b2d3e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 1: Add the new enum value (must be in autocommit block)
    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE compliancereportstatusenum ADD VALUE IF NOT EXISTS 'Exempted'"
        )

    # Step 2: Insert into compliance_report_status lookup table (skip if exists)
    op.execute(
        sa.text(
            "INSERT INTO compliance_report_status "
            "(compliance_report_status_id, status, effective_status) "
            "VALUES (12, 'Exempted'::compliancereportstatusenum, true) "
            "ON CONFLICT (compliance_report_status_id) DO NOTHING"
        )
    )

    # Step 3: Add exemption flag columns to compliance_report table
    if not column_exists("compliance_report", "is_renewable_fuel_exempted"):
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
    if not column_exists("compliance_report", "is_low_carbon_fuel_exempted"):
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
