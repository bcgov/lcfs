"""Add display_name to document for editable file display names.

Revision ID: a1c2d3e4f5b6
Revises: f9a0b1c2d3e5
Create Date: 2026-08-13 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "a1c2d3e4f5b6"
down_revision = "f9a0b1c2d3e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "document",
        sa.Column(
            "display_name",
            sa.String(),
            nullable=True,
            comment="User-editable display name shown in place of file_name; original file_name/extension are preserved",
        ),
    )


def downgrade() -> None:
    op.drop_column("document", "display_name")
