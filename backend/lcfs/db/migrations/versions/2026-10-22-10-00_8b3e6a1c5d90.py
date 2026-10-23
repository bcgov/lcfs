"""Associate penalty log comments with their organization.

Revision ID: 8b3e6a1c5d90
Revises: 4f2a9c8d6e1b
Create Date: 2026-10-22 10:00:00
"""

from alembic import op
import sqlalchemy as sa

revision = "8b3e6a1c5d90"
down_revision = "4f2a9c8d6e1b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "penalty_log_internal_comment",
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("internal_comment_id", sa.Integer(), nullable=False),
        sa.Column(
            "create_date", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()")
        ),
        sa.Column(
            "update_date", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()")
        ),
        sa.ForeignKeyConstraint(["organization_id"], ["organization.organization_id"]),
        sa.ForeignKeyConstraint(
            ["internal_comment_id"],
            ["internal_comment.internal_comment_id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("organization_id", "internal_comment_id"),
    )
    op.create_index(
        "ix_penalty_log_internal_comment_internal_comment_id",
        "penalty_log_internal_comment",
        ["internal_comment_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_penalty_log_internal_comment_internal_comment_id",
        table_name="penalty_log_internal_comment",
    )
    op.drop_table("penalty_log_internal_comment")
