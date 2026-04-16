"""Add login_bg_image table for admin-managed login screen backgrounds.

Revision ID: a2b3c4d5e6f7
Revises: a9b8c7d6e5f4
Create Date: 2026-03-09 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "a2b3c4d5e6f7"
down_revision = "a9b8c7d6e5f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if "login_bg_image" in inspect(bind).get_table_names():
        return

    op.create_table(
        "login_bg_image",
        sa.Column("login_bg_image_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("image_key", sa.String(), nullable=False, comment="S3 object key for the stored image file"),
        sa.Column("file_name", sa.String(255), nullable=False, comment="Original filename of the uploaded image"),
        sa.Column("display_name", sa.String(200), nullable=False, comment="Photographer or author name displayed as image credit"),
        sa.Column("caption", sa.String(500), nullable=True, comment="Location or additional attribution text"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.false(), comment="Whether this image is the current active login screen background"),
        sa.Column("create_date", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("update_date", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("create_user", sa.String(), nullable=True),
        sa.Column("update_user", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("login_bg_image_id"),
        comment="Stores background images for the login screen, managed by administrators",
    )
    op.create_index(
        "idx_login_bg_image_is_active",
        "login_bg_image",
        ["is_active"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_login_bg_image_is_active", table_name="login_bg_image")
    op.drop_table("login_bg_image")
