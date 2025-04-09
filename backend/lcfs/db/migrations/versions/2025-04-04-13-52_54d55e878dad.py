"""compliance summary historical update

Revision ID: 54d55e878dad
Revises: 2e2f6f7ff390
Create Date: 2025-04-04 13:52:08.981318

"""

import sqlalchemy as sa
from alembic import op
from alembic_postgresql_enum import TableReference
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "54d55e878dad"
down_revision = "2e2f6f7ff390"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "compliance_report_summary",
        sa.Column(
            "historical_snapshot",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="Contains historical data from pre-2024 TFRS system for data retention and analysis purposes.",
        ),
    )
    op.drop_column("compliance_report_summary", "credits_offset_b")
    op.drop_column("compliance_report_summary", "credits_offset_c")
    op.drop_column("compliance_report_summary", "credits_offset_a")


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
