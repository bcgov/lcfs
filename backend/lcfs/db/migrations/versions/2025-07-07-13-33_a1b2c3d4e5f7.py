"""Add assigned_analyst_id field to compliance_report table

Revision ID: a1b2c3d4e5f7
Revises: 413eef467edd
Create Date: 2025-07-07 13:33:00.000000

"""

import sqlalchemy as sa
from alembic import op
from lcfs.db.dependencies import (
    execute_sql_sections,
    find_and_read_sql_file,
    parse_sql_sections,
)

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f7"
down_revision = "413eef467edd"
branch_labels = None
depends_on = None


def recreate_compliance_reports_view():
    """Recreate the v_compliance_report view from metabase.sql"""
    try:
        # Read the metabase.sql file
        content = find_and_read_sql_file(sqlFile="metabase.sql")
        sections = parse_sql_sections(content)

        # Execute only the "Compliance Reports List View" section
        execute_sql_sections(sections, ["Compliance Reports List View"])

    except Exception as e:
        print(f"Error recreating v_compliance_report view: {e}")


def upgrade() -> None:
    # Add assigned_analyst_id column to compliance_report table
    op.add_column(
        "compliance_report",
        sa.Column(
            "assigned_analyst_id",
            sa.Integer,
            sa.ForeignKey("user_profile.user_profile_id"),
            nullable=True,
            comment="Foreign key to user_profile for assigned analyst",
        ),
    )

    # Add index for better query performance
    op.create_index(
        "idx_compliance_report_assigned_analyst_id",
        "compliance_report",
        ["assigned_analyst_id"],
    )

    # Recreate the view to include the new analyst columns
    recreate_compliance_reports_view()


def downgrade() -> None:
    # First recreate the view without the analyst columns
    # This would need to be done by dropping and recreating without the new fields
    op.execute("DROP VIEW IF EXISTS v_compliance_report")
    
    # Remove the index first
    op.drop_index("idx_compliance_report_assigned_analyst_id", table_name="compliance_report")
    
    # Remove the column
    op.drop_column("compliance_report", "assigned_analyst_id")
    
    # Recreate the view (the previous version)
    recreate_compliance_reports_view()