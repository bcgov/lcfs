"""Add early issuance summary columns

Revision ID: aa79bc6d6152
Revises: ddc2db9c2def
Create Date: 2025-04-14 19:55:34.930877

"""

import sqlalchemy as sa
from alembic import op
from alembic_postgresql_enum import TableReference
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "aa79bc6d6152"
down_revision = "ddc2db9c2def"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "compliance_report_summary",
        sa.Column("early_issuance_credits_q1", sa.Integer(), nullable=True),
    )
    op.add_column(
        "compliance_report_summary",
        sa.Column("early_issuance_credits_q2", sa.Integer(), nullable=True),
    )
    op.add_column(
        "compliance_report_summary",
        sa.Column("early_issuance_credits_q3", sa.Integer(), nullable=True),
    )
    op.add_column(
        "compliance_report_summary",
        sa.Column("early_issuance_credits_q4", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("compliance_report_summary", "early_issuance_credits_q4")
    op.drop_column("compliance_report_summary", "early_issuance_credits_q3")
    op.drop_column("compliance_report_summary", "early_issuance_credits_q2")
    op.drop_column("compliance_report_summary", "early_issuance_credits_q1")
