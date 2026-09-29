"""Give evidence requirements a title

An evidence requirement's description was doing two jobs: the heading of
its card and the statement of what evidence is required. The design
round splits them — a short title as the heading, the description as
the body beneath it. The column is nullable because every existing
requirement predates it; the page falls back to the description as the
heading until a title is saved.

Revision ID: a4b6c8d0e2f4
Revises: f3b5d7e9a1c4
Create Date: 2026-09-15 10:00:00

"""

import sqlalchemy as sa
from alembic import op

revision = "a4b6c8d0e2f4"
down_revision = "f3b5d7e9a1c4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "evidence_requirement",
        sa.Column(
            "title",
            sa.String(length=500),
            nullable=True,
            comment=(
                "Short heading for the requirement; NULL for requirements "
                "created before titles existed, which display their "
                "description instead."
            ),
        ),
    )


def downgrade() -> None:
    op.drop_column("evidence_requirement", "title")
