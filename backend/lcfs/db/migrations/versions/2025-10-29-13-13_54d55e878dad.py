"""compliance summary historical update

Revision ID: 54d55e878dad
Revises: a3290902296b
Create Date: 2025-04-04 13:52:08.981318

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "54d55e878dad"
down_revision = "a3290902296b"
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    """Check if a column exists in a table"""
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    # Add new column (only if it doesn't exist)
    if not column_exists("compliance_report_summary", "historical_snapshot"):
        op.add_column(
            "compliance_report_summary",
            sa.Column(
                "historical_snapshot",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=True,
                comment="Contains historical data from pre-2024 TFRS system for data retention and analysis purposes.",
            ),
        )

    # Drop the columns with CASCADE to handle dependent views (only if they exist)
    # Using raw SQL to handle CASCADE and IF EXISTS
    for col in ["credits_offset_b", "credits_offset_c", "credits_offset_a"]:
        if column_exists("compliance_report_summary", col):
            op.execute(f"ALTER TABLE compliance_report_summary DROP COLUMN IF EXISTS {col} CASCADE")


def downgrade() -> None:
    op.add_column(
        "compliance_report_summary",
        sa.Column("credits_offset_a", sa.INTEGER(), autoincrement=False, nullable=True),
    )
    op.add_column(
        "compliance_report_summary",
        sa.Column("credits_offset_c", sa.INTEGER(), autoincrement=False, nullable=True),
    )
    op.add_column(
        "compliance_report_summary",
        sa.Column("credits_offset_b", sa.INTEGER(), autoincrement=False, nullable=True),
    )
    op.drop_column("compliance_report_summary", "historical_snapshot")
