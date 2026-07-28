"""Add release_note_override table for System Admin release note edits.

Revision ID: b3c4d5e6f7a8
Revises: e7f8a9b0c1d2
Create Date: 2026-07-22 13:30:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "b3c4d5e6f7a8"
down_revision = "e7f8a9b0c1d2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if "release_note_override" in inspect(bind).get_table_names():
        return

    op.create_table(
        "release_note_override",
        sa.Column(
            "release_note_override_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column(
            "version",
            sa.String(20),
            nullable=False,
            comment="Release version this override applies to, e.g. '1.3.6'",
        ),
        sa.Column(
            "summary",
            sa.Text(),
            nullable=True,
            comment="Admin-edited summary. Null means use the auto-generated summary.",
        ),
        sa.Column(
            "sections",
            JSONB(),
            nullable=True,
            comment=(
                "Admin-edited release note sections (features, fixes, security, "
                "breaking, dependencies, other). Null means use the "
                "auto-generated sections."
            ),
        ),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("create_user", sa.String(), nullable=True),
        sa.Column("update_user", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("release_note_override_id"),
        sa.UniqueConstraint("version", name="uq_release_note_override_version"),
        comment=(
            "Stores System Admin edits layered on top of the auto-generated "
            "release notes for a given release version."
        ),
    )


def downgrade() -> None:
    op.drop_table("release_note_override")
