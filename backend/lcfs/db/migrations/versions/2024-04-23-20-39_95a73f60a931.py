"""Create 'admin_adjustment_internal_comment' table for linking admin adjustments to internal comments.

Revision ID: 95a73f60a931
Revises: d781da2e8de1
Create Date: 2024-04-23 20:39:46.492161

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "95a73f60a931"
down_revision = "a1c6c67c49c6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "admin_adjustment_internal_comment",
        sa.Column(
            "admin_adjustment_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to admin_adjustment, part of the composite primary key.",
        ),
        sa.Column(
            "internal_comment_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to internal_comment, part of the composite primary key.",
        ),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was created in the database.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
        ),
        sa.ForeignKeyConstraint(
            ["internal_comment_id"],
            ["internal_comment.internal_comment_id"],
        ),
        sa.ForeignKeyConstraint(
            ["admin_adjustment_id"],
            ["admin_adjustment.admin_adjustment_id"],
        ),
        sa.PrimaryKeyConstraint("admin_adjustment_id", "internal_comment_id"),
        comment="Associates internal comments with admin adjustments.",
    )


def downgrade() -> None:
    op.drop_table("admin_adjustment_internal_comment")
