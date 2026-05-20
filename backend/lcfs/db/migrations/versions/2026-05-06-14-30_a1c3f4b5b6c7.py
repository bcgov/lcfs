"""Create vw_fse_base for year over year FSE comparison

Revision ID: a1c3f4b5b6c7
Revises: e7c2b9a4d018
Create Date: 2026-05-06 14:30:00.000000
"""

from lcfs.db.dependencies import (
    execute_sql_sections,
    find_and_read_sql_file,
    parse_sql_sections,
)

# revision identifiers, used by Alembic.
revision = "a1c3f4b5b6c7"
down_revision = "e7c2b9a4d018"
branch_labels = None
depends_on = None

SECTIONS_TO_EXECUTE = [
    "FSE Base View YoY",
]


def upgrade() -> None:
    """Recreate vw_fse_base with the additional year/identifier fields."""
    content = find_and_read_sql_file(sqlFile="metabase.sql")
    sections = parse_sql_sections(content)
    execute_sql_sections(sections, SECTIONS_TO_EXECUTE)


def downgrade() -> None:
    """Drop the view; it will be recreated from the SQL file on next deploy."""
    from alembic import op

    op.execute("DROP VIEW IF EXISTS vw_fse_base CASCADE;")
