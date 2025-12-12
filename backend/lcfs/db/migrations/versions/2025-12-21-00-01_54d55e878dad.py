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

def downgrade() -> None:
    op.drop_column("compliance_report_summary", "historical_snapshot")
