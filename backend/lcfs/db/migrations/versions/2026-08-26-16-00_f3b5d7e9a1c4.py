"""Make document folders restorable

Folders were hard-deleted, so a deleted folder could not be restored and
its documents' placement rows cascaded away with it — the files survived
but lost every trace of where they had lived. Folders now soft-delete the
way documents already do.

A delete stamps every row it touches with a shared deleted_group_uuid, so
a restore can un-delete exactly the rows that went together. Without it a
folder deleted on its own, earlier, would be dragged back by a later
cascade of its parent.

Revision ID: f3b5d7e9a1c4
Revises: e2a4c6b8d0f1
Create Date: 2026-08-26 16:00:00

"""

import sqlalchemy as sa
from alembic import op

revision = "f3b5d7e9a1c4"
down_revision = "e2a4c6b8d0f1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "document_folder",
        sa.Column(
            "deleted_date",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            comment="When the folder was sent to the bin; NULL while it is live",
        ),
    )
    op.add_column(
        "document_folder",
        sa.Column(
            "deleted_by",
            sa.String(length=255),
            nullable=True,
            comment="Username that sent the folder to the bin",
        ),
    )
    op.add_column(
        "document_folder",
        sa.Column(
            "deleted_group_uuid",
            sa.String(length=36),
            nullable=True,
            comment=(
                "Groups every row removed by one delete action, so a restore "
                "can un-delete exactly what went together and not rows that "
                "were removed separately beforehand."
            ),
        ),
    )
    op.add_column(
        "document",
        sa.Column(
            "deleted_group_uuid",
            sa.String(length=36),
            nullable=True,
            comment=(
                "Set when the document went to the bin as part of a folder "
                "delete; NULL when it was deleted on its own."
            ),
        ),
    )
    op.create_index(
        "ix_document_folder_deleted_group_uuid",
        "document_folder",
        ["deleted_group_uuid"],
    )
    op.create_index(
        "ix_document_deleted_group_uuid",
        "document",
        ["deleted_group_uuid"],
    )

    # Sibling names must stay unique among LIVE folders only. Left as-is,
    # a folder in the bin would hold its name hostage forever — nothing is
    # ever purged — so the name could never be reused, and restoring a
    # folder whose name had been taken would fail on the constraint.
    op.drop_index("uq_document_folder_sibling_name", table_name="document_folder")
    op.create_index(
        "uq_document_folder_sibling_name",
        "document_folder",
        [
            "parent_type",
            "parent_id",
            sa.text("coalesce(parent_folder_id, 0)"),
            sa.text("lower(name)"),
        ],
        unique=True,
        postgresql_where=sa.text("deleted_date IS NULL"),
    )


def downgrade() -> None:
    # Folders in the bin would collide once the index stops ignoring them,
    # so clear the bin before restoring the total index.
    op.execute("DELETE FROM document_folder WHERE deleted_date IS NOT NULL")
    op.drop_index("uq_document_folder_sibling_name", table_name="document_folder")
    op.create_index(
        "uq_document_folder_sibling_name",
        "document_folder",
        [
            "parent_type",
            "parent_id",
            sa.text("coalesce(parent_folder_id, 0)"),
            sa.text("lower(name)"),
        ],
        unique=True,
    )
    op.drop_index("ix_document_deleted_group_uuid", table_name="document")
    op.drop_index("ix_document_folder_deleted_group_uuid", table_name="document_folder")
    op.drop_column("document", "deleted_group_uuid")
    op.drop_column("document_folder", "deleted_group_uuid")
    op.drop_column("document_folder", "deleted_by")
    op.drop_column("document_folder", "deleted_date")
