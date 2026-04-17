"""Add comment visibility to internal_comment

Revision ID: a1b2c3d4e5f0
Revises: 098cf79762b9
Create Date: 2026-04-08 12:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f0"
down_revision = "098cf79762b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create the comment_visibility ENUM type
    visibility_enum = sa.Enum("Internal", "Public", name="comment_visibility")
    visibility_enum.create(op.get_bind())

    # 2. Add visibility column to internal_comment with default 'Internal'
    op.add_column(
        "internal_comment",
        sa.Column(
            "visibility",
            postgresql.ENUM(
                "Internal",
                "Public",
                name="comment_visibility",
                create_type=False,
            ),
            nullable=False,
            server_default=sa.text("'Internal'::comment_visibility"),
            comment="Visibility scope: Internal (gov-only) or Public (visible to org users)",
        ),
    )

    # 3. Make audience_scope nullable (public comments don't require audience_scope)
    op.alter_column(
        "internal_comment",
        "audience_scope",
        existing_type=sa.Enum(
            "Director",
            "Analyst",
            "Compliance Manager",
            name="audience_scope",
            create_type=False,
        ),
        nullable=True,
    )


def downgrade() -> None:
    # Public comments introduced by this migration can have NULL audience_scope.
    # Backfill before restoring NOT NULL constraint.
    op.execute(
        "UPDATE internal_comment SET audience_scope = 'Analyst' WHERE audience_scope IS NULL"
    )

    # 1. Restore audience_scope to NOT NULL
    op.alter_column(
        "internal_comment",
        "audience_scope",
        existing_type=sa.Enum(
            "Director",
            "Analyst",
            "Compliance Manager",
            name="audience_scope",
            create_type=False,
        ),
        nullable=False,
    )

    # 2. Drop visibility column
    op.drop_column("internal_comment", "visibility")

    # 3. Drop the comment_visibility ENUM type
    sa.Enum(name="comment_visibility").drop(op.get_bind(), checkfirst=True)
