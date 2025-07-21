"""Fuel Export Metabase view

Revision ID: 18ca5084ea87
Revises: a1b2c3d4e5f7
Create Date: 2025-07-15 08:24:13.197219

"""

from lcfs.db.dependencies import (
    execute_sql_sections,
    find_and_read_sql_file,
    parse_sql_sections,
)

# revision identifiers, used by Alembic.
revision = "18ca5084ea87"
down_revision = "a1b2c3d4e5f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    try:
        # Read the metabase.sql file
        content = find_and_read_sql_file(sqlFile="metabase.sql")
        sections = parse_sql_sections(content)

        # Execute only the "Fuel Export Analytics Base View" section
        execute_sql_sections(sections, ["Fuel Export Analytics Base View"])

    except Exception as e:
        print(f"Error creating vw_fuel_export_analytics_base view: {e}")


def downgrade() -> None:
    pass
