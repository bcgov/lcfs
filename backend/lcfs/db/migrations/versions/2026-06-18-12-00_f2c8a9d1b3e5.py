"""Add internal_comment_document_association table.

Links internal comments to attached documents so the existing
DocumentService/S3 attachment machinery can be reused with the
parent_type "internal_comment" (issue #4514).

Revision ID: f2c8a9d1b3e5
Revises: a9c7e5f3d1b2
Create Date: 2026-06-18 12:00:00.000000
"""

import sqlalchemy as sa
from alembic import op


revision = "f2c8a9d1b3e5"
down_revision = "a9c7e5f3d1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "internal_comment_document_association",
        sa.Column(
            "internal_comment_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "document_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("internal_comment_id", "document_id"),
        comment="Associates internal comments with their attached documents.",
    )
    op.create_foreign_key(
        "fk_internal_comment_document_internal_comment_id",
        "internal_comment_document_association",
        "internal_comment",
        ["internal_comment_id"],
        ["internal_comment_id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_internal_comment_document_document_id",
        "internal_comment_document_association",
        "document",
        ["document_id"],
        ["document_id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_table("internal_comment_document_association")
