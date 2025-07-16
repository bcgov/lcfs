"""Update metabase views to use organization_early_issuance_by_year table

Revision ID: c3d4e5f6g7h8
Revises: a1b2c3d4e5f7
Create Date: 2025-07-10 10:30:00.000000

"""

from lcfs.db.dependencies import (
    create_role_if_not_exists,
    execute_sql_sections,
    find_and_read_sql_file,
    parse_sql_sections,
)
from alembic import op

# revision identifiers, used by Alembic.
revision = "c3d4e5f6g7h8"
down_revision = "a1b2c3d4e5f7"
branch_labels = None
depends_on = None

# Specify which sections to execute from the SQL file
SECTIONS_TO_EXECUTE = [
    "Compliance Report Base View With Early Issuance By Year",
    "Allocation Agreement Base View With Early Issuance By Year",
]


def upgrade() -> None:
    """Execute SQL sections to update views with organization_early_issuance_by_year table"""
    # Create role if it doesn't exist
    create_role_if_not_exists()

    # Read and parse the SQL file
    content = find_and_read_sql_file(sqlFile="metabase.sql")
    sections = parse_sql_sections(content)

    # Execute the metabase view updates
    execute_sql_sections(sections, SECTIONS_TO_EXECUTE)


def downgrade() -> None:
    """Revert views to use original sections"""
    # Create role if it doesn't exist
    create_role_if_not_exists()

    # Read and parse the SQL file
    content = find_and_read_sql_file(sqlFile="metabase.sql")
    sections = parse_sql_sections(content)

    # Execute the original view sections
    execute_sql_sections(
        sections, ["Compliance Report Base View", "Allocation Agreement Base View"]
    )
