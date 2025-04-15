"""Add quarterly to annual report association

Revision ID: bf034b44000f
Revises: ddc2db9c2def
Create Date: 2025-04-14 16:26:58.747354

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "bf034b44000f"
down_revision = "ddc2db9c2def"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "compliance_report",
        sa.Column(
            "quarter",
            postgresql.ENUM("Q1", "Q2", "Q3", "Q4", name="quarter", create_type=False),
            nullable=True,
            comment="Quarter for the compliance report",
        ),
    )
    op.create_table(
        "quarterly_to_annual_report",
        sa.Column("annual_report_id", sa.Integer(), nullable=False),
        sa.Column("quarterly_report_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["annual_report_id"],
            ["compliance_report.compliance_report_id"],
            on_delete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["quarterly_report_id"],
            ["compliance_report.compliance_report_id"],
            on_delete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("annual_report_id", "quarterly_report_id")
    )


def downgrade() -> None:
    op.drop_column("compliance_report", "quarter")
    op.drop_table("quarterly_to_annual_report")
