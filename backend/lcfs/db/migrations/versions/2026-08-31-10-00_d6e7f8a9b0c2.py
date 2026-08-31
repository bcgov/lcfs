"""Add invoice and payment status to compliance report penalties

Revision ID: d6e7f8a9b0c2
Revises: c8d9e0f1a2b3
Create Date: 2026-08-31 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "d6e7f8a9b0c2"
down_revision = "c8d9e0f1a2b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "compliance_report_summary",
        sa.Column(
            "line_11_invoice_sent",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="Invoice sent status for renewable fuel target non-compliance penalty.",
        ),
    )
    op.add_column(
        "compliance_report_summary",
        sa.Column(
            "line_11_payment_received",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="Payment received status for renewable fuel target non-compliance penalty.",
        ),
    )
    op.add_column(
        "compliance_report_summary",
        sa.Column(
            "line_21_invoice_sent",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="Invoice sent status for low carbon fuel target non-compliance penalty.",
        ),
    )
    op.add_column(
        "compliance_report_summary",
        sa.Column(
            "line_21_payment_received",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="Payment received status for low carbon fuel target non-compliance penalty.",
        ),
    )


def downgrade() -> None:
    op.drop_column("compliance_report_summary", "line_21_payment_received")
    op.drop_column("compliance_report_summary", "line_21_invoice_sent")
    op.drop_column("compliance_report_summary", "line_11_payment_received")
    op.drop_column("compliance_report_summary", "line_11_invoice_sent")
