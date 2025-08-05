"""Create FSE Base View and Electricity Allocation FSE Match Query

Revision ID: 7a2c0f91a992
Revises: dc03b0eabbf5
Create Date: 2025-07-31 00:30:29.254103

"""

from lcfs.db.dependencies import (
    execute_sql_sections,
    find_and_read_sql_file,
    parse_sql_sections,
)

# revision identifiers, used by Alembic.
revision = "7a2c0f91a992"
down_revision = "dc03b0eabbf5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    try:
        # Read the metabase.sql file
        content = find_and_read_sql_file(sqlFile="metabase.sql")
        sections = parse_sql_sections(content)

        # Execute FSE Base View and Electricity Allocation FSE Match Query sections
        execute_sql_sections(
            sections,
            [
                "Final Supply Equipment Base View",
                "Electricity Allocation FSE Match Query",
            ],
        )

    except Exception as e:
        print(f"Error creating views: {e}")


def downgrade() -> None:
    pass
