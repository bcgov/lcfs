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
    op.create_table(
        "compliance_report_penalty_status_history",
        sa.Column(
            "penalty_status_history_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the penalty status history record.",
        ),
        sa.Column(
            "summary_id",
            sa.Integer(),
            nullable=False,
            comment="Summary row group where the penalty status changed.",
        ),
        sa.Column(
            "compliance_report_group_uuid",
            sa.String(length=36),
            nullable=False,
            comment="Compliance report group UUID where the penalty status changed.",
        ),
        sa.Column(
            "version",
            sa.Integer(),
            nullable=False,
            comment="Compliance report version where the penalty status changed.",
        ),
        sa.Column(
            "line",
            sa.Integer(),
            nullable=False,
            comment="Penalty summary line updated. Expected values are 11 or 21.",
        ),
        sa.Column(
            "field_name",
            sa.String(length=50),
            nullable=False,
            comment="Status field updated, such as invoice_sent or payment_received.",
        ),
        sa.Column(
            "previous_value",
            sa.Boolean(),
            nullable=True,
            comment="Status value before the update.",
        ),
        sa.Column(
            "new_value",
            sa.Boolean(),
            nullable=True,
            comment="Status value after the update.",
        ),
        sa.Column(
            "user_profile_id",
            sa.Integer(),
            nullable=True,
            comment="User who changed the penalty status.",
        ),
        sa.Column(
            "display_name",
            sa.String(length=255),
            nullable=True,
            comment="Display name for the user who changed the penalty status.",
        ),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was created in the database.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was updated in the database.",
        ),
        sa.Column(
            "create_user",
            sa.String(),
            nullable=True,
            comment="The user who created this record in the database.",
        ),
        sa.Column(
            "update_user",
            sa.String(),
            nullable=True,
            comment="The user who last updated this record in the database.",
        ),
        sa.ForeignKeyConstraint(
            ["summary_id"], ["compliance_report_summary.summary_id"]
        ),
        sa.ForeignKeyConstraint(["user_profile_id"], ["user_profile.user_profile_id"]),
        sa.PrimaryKeyConstraint("penalty_status_history_id"),
        comment="Tracks invoice and payment status changes for compliance report penalties.",
    )
    op.create_index(
        "ix_penalty_status_history_report_group_version",
        "compliance_report_penalty_status_history",
        ["compliance_report_group_uuid", "version"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_penalty_status_history_report_group_version",
        table_name="compliance_report_penalty_status_history",
    )
    op.drop_table("compliance_report_penalty_status_history")
    op.drop_column("compliance_report_summary", "line_21_payment_received")
    op.drop_column("compliance_report_summary", "line_21_invoice_sent")
    op.drop_column("compliance_report_summary", "line_11_payment_received")
    op.drop_column("compliance_report_summary", "line_11_invoice_sent")
