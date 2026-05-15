"""Add ci_application_internal_comment association table.

Integrates CI applications into the shared internal_comments system so
Step 5 (Government decision) can use the same comment widget (rich-text,
edit, visibility toggle) already in use by transfers, transactions, and
compliance reports.

Revision ID: b8f9c0d1e2a3
Revises: a1c3f4b5b6c7
Create Date: 2026-05-12 15:00:00.000000
"""

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = "b8f9c0d1e2a3"
down_revision = "a1c3f4b5b6c7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ci_application_internal_comment",
        sa.Column(
            "ci_application_id",
            sa.Integer(),
            nullable=False,
            comment=(
                "Foreign key to ci_application, part of the composite "
                "primary key."
            ),
        ),
        sa.Column(
            "internal_comment_id",
            sa.Integer(),
            nullable=False,
            comment=(
                "Foreign key to internal_comment, part of the composite "
                "primary key."
            ),
        ),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            comment=(
                "Date and time (UTC) when the physical record was created "
                "in the database."
            ),
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            comment=(
                "Date and time (UTC) when the physical record was updated "
                "in the database."
            ),
        ),
        sa.ForeignKeyConstraint(
            ["ci_application_id"],
            ["ci_application.ci_application_id"],
            name=op.f("fk_ci_application_internal_comment_ci_application_id"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["internal_comment_id"],
            ["internal_comment.internal_comment_id"],
            name=op.f("fk_ci_application_internal_comment_internal_comment_id"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "ci_application_id",
            "internal_comment_id",
            name=op.f("pk_ci_application_internal_comment"),
        ),
        comment="Associates internal comments with a CI application.",
    )


def downgrade() -> None:
    op.drop_table("ci_application_internal_comment")
