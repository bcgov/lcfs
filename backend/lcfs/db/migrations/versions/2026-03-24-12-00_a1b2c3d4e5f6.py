"""Fix FSE pref view to match compliance records by group UUID

Revision ID: a1b2c3d4e5f6
Revises: c7e4d9a1b2f6
Create Date: 2026-03-24 12:00:00.000000
"""

from lcfs.db.dependencies import (
    execute_sql_sections,
    find_and_read_sql_file,
    parse_sql_sections,
)

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "c7e4d9a1b2f6"
branch_labels = None
depends_on = None

SECTIONS_TO_EXECUTE = [
    "FSE Reporting Base Preferred View",
]


def upgrade() -> None:
    """
    Recreate v_fse_reporting_base_pref to match compliance records by
    compliance_report_group_uuid instead of compliance_report_id.

    This fixes supplemental reports not showing kWh data that was uploaded
    against the original report in the same compliance report group.
    """
    content = find_and_read_sql_file(sqlFile="metabase.sql")
    sections = parse_sql_sections(content)
    execute_sql_sections(sections, SECTIONS_TO_EXECUTE)


def downgrade() -> None:
    """Drop and recreate with original logic."""
    from alembic import op

    op.execute("DROP VIEW IF EXISTS v_fse_reporting_base_pref;")
