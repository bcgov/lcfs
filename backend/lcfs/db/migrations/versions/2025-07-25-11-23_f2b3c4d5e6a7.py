"""Create Allocation Agreement 2024 View

Revision ID: f2b3c4d5e6a7
Revises: ae2306fa8d72
Create Date: 2025-07-25 11:23:15.000000

"""

from lcfs.db.dependencies import (
    execute_sql_sections,
    find_and_read_sql_file,
    parse_sql_sections,
)

# revision identifiers, used by Alembic.
revision = "f2b3c4d5e6a7"
down_revision = "ae2306fa8d72"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Execute the Allocation Agreement 2024 View section from metabase.sql"""
    try:
        content = find_and_read_sql_file(sqlFile="metabase.sql")
        sections = parse_sql_sections(content)
        execute_sql_sections(sections, ["Allocation Agreement 2024 View"])
    except Exception as e:
        print(f"Error creating vw_allocation_agreement_2024 view: {e}")


def downgrade() -> None:
    pass
