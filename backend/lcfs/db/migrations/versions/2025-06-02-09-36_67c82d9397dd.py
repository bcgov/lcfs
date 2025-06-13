"""Metabase views

Revision ID: 67c82d9397dd
Revises: ac2cb0248135
Create Date: 2025-06-02 09:36:04.425278

"""

from lcfs.db.dependencies import (
    create_role_if_not_exists,
    execute_sql_sections,
    find_and_read_sql_file,
    parse_sql_sections,
)
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "67c82d9397dd"
down_revision = "ac2cb0248135"
branch_labels = None
depends_on = None

# Specify which sections to execute from the SQL file
SECTIONS_TO_EXECUTE = [
    "Compliance Reports Analytics View",
    "Compliance Reports Waiting review",
    "Compliance reports time per status",
    "Transfer base Analytics View",
    "User Login Analytics Base View",
    "BCeID Daily Login Summary View",
    "BCeID User Statistics View",
    "Login Failures Analysis View",
    "Fuel Supply Analytics Base View",
    "Transaction Base View",
    "Fuel Supply Fuel Code Base View",
    "Fuel Supply Base View",
    "Compliance Report Fuel Supply Base View",
    "Compliance Report Chained View",
    "Compliance Report Base View",
    "Allocation Agreement Chained View",
    "Allocation Agreement Base View",
    "Fuel Code Base View"
]


def upgrade():
    """Execute entire SQL file"""
    try:
        # First, ensure the role and user exist
        create_role_if_not_exists()

        # Read SQL file
        content = find_and_read_sql_file(sqlFile="metabase.sql")
        sections = parse_sql_sections(content)

        # Execute sections based on SECTIONS_TO_EXECUTE configuration
        execute_sql_sections(sections, SECTIONS_TO_EXECUTE)

        print("All SQL statements executed successfully!")

    except FileNotFoundError as e:
        print(f"SQL file not found: {e}")
        raise
    except Exception as e:
        print(f"Error executing SQL: {e}")
        raise


def downgrade():
    """Drop created views and objects"""
    try:
        # Drop views in reverse order
        views_to_drop = [
            "vw_fuel_code_base",
            "vw_allocation_agreement_base",
            "vw_allocation_agreement_chained",
            "vw_compliance_report_base",
            "vw_compliance_report_chained"
            "vw_compliance_report_fuel_supply_base",
            "vw_fuel_supply_base",
            "vw_fuel_supply_fuel_code_base",
            "vw_transaction_base",
            "vw_fuel_supply_analytics_base",
            "vw_login_failures_analysis",
            "vw_bceid_user_statistics",
            "vw_bceid_daily_login_summary",
            "vw_user_login_analytics_base",
            "vw_transfer_base",
            "vw_compliance_reports_time_per_status",
            "vw_reports_waiting_review",
            "vw_compliance_report_analytics_base",
        ]

        for view in views_to_drop:
            try:
                print(f"Dropping view: {view}")
                op.execute(sa.text(f"DROP VIEW IF EXISTS {view}"))
            except Exception as e:
                print(f"Warning: Could not drop {view}: {e}")

    except Exception as e:
        print(f"Error during downgrade: {e}")
