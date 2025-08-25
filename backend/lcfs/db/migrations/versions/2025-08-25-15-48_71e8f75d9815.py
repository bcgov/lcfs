"""Add Metabase view for Fuels for Other Use Data

Revision ID: 71e8f75d9815
Revises: 32a1f93375bd
Create Date: 2025-08-25 15:48:00.000000

"""

from alembic import op
from lcfs.db.dependencies import (
    execute_sql_sections,
    find_and_read_sql_file,
    parse_sql_sections,
)

# revision identifiers, used by Alembic.
revision = "71e8f75d9815"
down_revision = "32a1f93375bd"
branch_labels = None
depends_on = None


def upgrade() -> None:
    try:
        # Read the metabase.sql file
        content = find_and_read_sql_file(sqlFile="metabase.sql")
        sections = parse_sql_sections(content)

        # Execute Fuels for Other Use Data Model section
        execute_sql_sections(
            sections,
            [
                "Fuels for Other Use Data Model",
            ],
        )

    except Exception as e:
        print(f"Error creating fuels for other use base view: {e}")
        raise


def downgrade() -> None:
    try:
        # Drop the view if it exists
        op.execute("DROP VIEW IF EXISTS vw_fuels_other_use_base CASCADE;")
    except Exception as e:
        print(f"Error dropping fuels for other use base view: {e}")
        raise
