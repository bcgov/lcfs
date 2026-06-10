"""Optimise vw_fse_base for performance with large FSE datasets

Replaces the v_fse_reporting_base_pref chain with a flat CTE query to fix
a 163M-row Nested Loop caused by double-evaluation of v_fse_reporting_base
and a correlated MAX(version) subquery on charging_site per row.

Revision ID: a1a2b3c4d5e1
Revises: d2e4f6a8b0c1
Create Date: 2026-06-10 10:00:00.000000
"""

from lcfs.db.dependencies import (
    execute_sql_sections,
    find_and_read_sql_file,
    parse_sql_sections,
)

# revision identifiers, used by Alembic.
revision = "a1a2b3c4d5e1"
down_revision = "d2e4f6a8b0c1"
branch_labels = None
depends_on = None

SECTIONS_TO_EXECUTE = [
    "FSE Base View YoY Optimised",
]


def upgrade() -> None:
    """Recreate vw_fse_base with the optimised flat-CTE query."""
    content = find_and_read_sql_file(sqlFile="metabase.sql")
    sections = parse_sql_sections(content)
    execute_sql_sections(sections, SECTIONS_TO_EXECUTE)


def downgrade() -> None:
    """Drop the view; it will be recreated from the SQL file on next deploy."""
    from alembic import op

    op.execute("DROP VIEW IF EXISTS vw_fse_base CASCADE;")
