"""Add document folder tables for the Initiative Agreements module.

Folders are a layer beside the document system (#4925): the document table
and every *_document_association table are untouched, placement lives in a
side table, and a document with no placement row sits at the root. Dropping
these two tables removes the feature completely.

Revision ID: c9d4e6f8a0b2
Revises: b8c3d5e7f9a1
Create Date: 2026-08-24 15:00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "c9d4e6f8a0b2"
down_revision = "b8c3d5e7f9a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "document_folder",
        sa.Column("folder_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("parent_type", sa.String(length=50), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=False),
        sa.Column("parent_folder_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False
        ),
        sa.Column(
            "is_system",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("create_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("update_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("create_user", sa.String(), nullable=True),
        sa.Column("update_user", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(
            ["parent_folder_id"],
            ["document_folder.folder_id"],
            name=op.f("fk_document_folder_parent_folder_id_document_folder"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("folder_id", name=op.f("pk_document_folder")),
        comment=(
            "Folder tree for parent-scoped document organisation; documents "
            "place into folders via document_folder_item."
        ),
    )
    op.create_index(
        "ix_document_folder_parent",
        "document_folder",
        ["parent_type", "parent_id"],
    )
    # Case-insensitive sibling uniqueness. NULL parent_folder_id (the root)
    # coalesces to 0 because NULLs never collide in a unique index.
    op.execute(
        """
        CREATE UNIQUE INDEX uq_document_folder_sibling_name
        ON document_folder (
            parent_type, parent_id, coalesce(parent_folder_id, 0), lower(name)
        )
        """
    )

    op.create_table(
        "document_folder_item",
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("folder_id", sa.Integer(), nullable=False),
        sa.Column("create_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("update_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("create_user", sa.String(), nullable=True),
        sa.Column("update_user", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["document.document_id"],
            name=op.f("fk_document_folder_item_document_id_document"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["folder_id"],
            ["document_folder.folder_id"],
            name=op.f("fk_document_folder_item_folder_id_document_folder"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("document_id", name=op.f("pk_document_folder_item")),
        comment="Places a document in a document_folder; absence means root.",
    )
    op.create_index(
        "ix_document_folder_item_folder_id",
        "document_folder_item",
        ["folder_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_document_folder_item_folder_id", table_name="document_folder_item"
    )
    op.drop_table("document_folder_item")
    op.execute("DROP INDEX uq_document_folder_sibling_name")
    op.drop_index("ix_document_folder_parent", table_name="document_folder")
    op.drop_table("document_folder")
