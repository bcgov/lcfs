"""Allocation Agreement and FSE Address Duplicate Check Views

Revision ID: dc03b0eabbf5
Revises: b1c2d3e4f5g6
Create Date: 2025-07-30 20:15:42.707972

"""

from lcfs.db.dependencies import (
    execute_sql_sections,
    find_and_read_sql_file,
    parse_sql_sections,
)

# revision identifiers, used by Alembic.
revision = "dc03b0eabbf5"
down_revision = "b1c2d3e4f5g6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    try:
        # Read the metabase.sql file
        content = find_and_read_sql_file(sqlFile="metabase.sql")
        sections = parse_sql_sections(content)

        # Execute both duplicate check views sections
        execute_sql_sections(
            sections,
            [
                "Allocation Agreement Duplicate Check",
                "Final Supply Equipment Duplicate Check",
            ],
        )

    except Exception as e:
        print(f"Error creating duplicate check views: {e}")


def downgrade() -> None:
    pass
