"""Create Notional Transfer Base View for Metabase

Revision ID: 3f5a7b9c1d2e
Revises: 9f640abe256d
Create Date: 2025-08-13 12:42:00.000000

"""

from alembic import op
from lcfs.db.dependencies import (
    execute_sql_sections,
    find_and_read_sql_file,
    parse_sql_sections,
)

# revision identifiers, used by Alembic.
revision = "3f5a7b9c1d2e"
down_revision = "9f640abe256d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    try:
        # Read the metabase.sql file
        content = find_and_read_sql_file(sqlFile="metabase.sql")
        sections = parse_sql_sections(content)

        # Execute Notional Transfer Base View section
        execute_sql_sections(
            sections,
            [
                "Notional Transfer Base View",
            ],
        )

    except Exception as e:
        print(f"Error creating notional transfer base view: {e}")
        raise


def downgrade() -> None:
    try:
        # Drop the view if it exists
        op.execute("DROP VIEW IF EXISTS vw_notional_transfer_base CASCADE;")
    except Exception as e:
        print(f"Error dropping notional transfer base view: {e}")
        raise
