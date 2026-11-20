"""Number LCJFIP applications JF-<id> in the reporting views (#5541).

The applications index shows application numbers as JF-<id> (for example
JF-123), so the two LCJFIP Metabase views, which showed LCJFIP-<id>, are
recreated from metabase.sql with the new prefix. Their columns do not change,
so CREATE OR REPLACE keeps the views' grants and anything built on them.

Revision ID: f29bf127e5a5
Revises: b7a04f59fdf3
Create Date: 2026-11-20 10:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

from lcfs.db.dependencies import (
    create_role_if_not_exists,
    execute_sql_sections,
    find_and_read_sql_file,
    parse_sql_sections,
)

revision = "f29bf127e5a5"
down_revision = "b7a04f59fdf3"
branch_labels = None
depends_on = None

VIEW_SECTIONS = [
    "LCJFIP Application Base View",
    "LCJFIP Purchase Detail Base View",
]
NEW_PREFIX = "'JF-' ||"
OLD_PREFIX = "'LCJFIP-' ||"


def _recreate_views(old: str, new: str) -> None:
    """Run the LCJFIP view sections with one application-number prefix."""
    create_role_if_not_exists()
    sql = find_and_read_sql_file(sqlFile="metabase.sql")
    sections = parse_sql_sections(sql)
    missing = [name for name in VIEW_SECTIONS if name not in sections]
    if missing:
        raise RuntimeError(f"metabase.sql is missing sections: {missing}")
    for name in VIEW_SECTIONS:
        sections[name] = sections[name].replace(old, new)
        if new not in sections[name]:
            raise RuntimeError(f"{name} does not number applications with {new}")
    execute_sql_sections(sections, VIEW_SECTIONS)


def _comment_id_column(prefix: str) -> None:
    op.alter_column(
        "lcjfip_application",
        "lcjfip_application_id",
        existing_type=sa.Integer(),
        comment=(
            "Unique identifier for the LCJFIP application. "
            f"Displayed as {prefix}<id>."
        ),
        existing_nullable=False,
        autoincrement=True,
    )


def upgrade() -> None:
    _recreate_views(OLD_PREFIX, NEW_PREFIX)
    _comment_id_column("JF-")


def downgrade() -> None:
    _recreate_views(NEW_PREFIX, OLD_PREFIX)
    _comment_id_column("LCJFIP-")
