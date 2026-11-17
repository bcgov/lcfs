"""Add independent DA/EOC submissions and document links.

Revision ID: 5499daec0001
Revises: 9e0e5741b48f
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "5499daec0001"
down_revision = "9e0e5741b48f"
branch_labels = None
depends_on = None


def audit_columns():
    return [
        sa.Column(
            "create_date", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()")
        ),
        sa.Column(
            "update_date", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()")
        ),
        sa.Column("create_user", sa.String()),
        sa.Column("update_user", sa.String()),
    ]


def upgrade():
    op.create_table(
        "da_eoc_submission",
        sa.Column("da_eoc_submission_id", sa.Integer(), primary_key=True),
        sa.Column(
            "designated_action_id",
            sa.Integer(),
            sa.ForeignKey("designated_action.designated_action_id"),
            nullable=False,
        ),
        sa.Column(
            "organization_id",
            sa.Integer(),
            sa.ForeignKey("organization.organization_id"),
            nullable=False,
        ),
        sa.Column("status", sa.String(50), nullable=False, server_default="Draft"),
        sa.Column("summary_of_work_completed", sa.Text()),
        sa.Column("how_evidence_meets_agreement_requirements", sa.Text()),
        sa.Column("exceptions_limitations_and_context", sa.Text()),
        *audit_columns(),
        sa.CheckConstraint(
            "status IN ('Draft', 'Submitted', 'Recommended by analyst', 'Recommended by manager', 'Approved', 'Rejected')",
            name=op.f("ck_da_eoc_submission_status"),
        ),
        comment="Independent DA/EOC submissions; the IA is reached through the designated action.",
    )
    op.create_index(
        "ix_da_eoc_submission_designated_action_id",
        "da_eoc_submission",
        ["designated_action_id"],
    )
    op.create_index(
        "ix_da_eoc_submission_organization_id", "da_eoc_submission", ["organization_id"]
    )
    op.create_table(
        "da_eoc_submission_document_association",
        sa.Column(
            "da_eoc_submission_id",
            sa.Integer(),
            sa.ForeignKey("da_eoc_submission.da_eoc_submission_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "document_id",
            sa.Integer(),
            sa.ForeignKey("document.document_id"),
            primary_key=True,
        ),
    )
    op.create_index(
        "ix_da_eoc_submission_document_association_document_id",
        "da_eoc_submission_document_association",
        ["document_id"],
    )
    op.create_table(
        "da_eoc_submission_history",
        sa.Column("da_eoc_submission_history_id", sa.Integer(), primary_key=True),
        sa.Column(
            "da_eoc_submission_id",
            sa.Integer(),
            sa.ForeignKey("da_eoc_submission.da_eoc_submission_id"),
            nullable=False,
        ),
        sa.Column("event", sa.String(100), nullable=False),
        sa.Column("status", sa.String(50)),
        sa.Column(
            "sub_status",
            sa.String(100),
            comment="For SUB_STATUS_CHANGE events: new internal state, or NULL to clear it",
        ),
        sa.Column(
            "user_profile_id",
            sa.Integer(),
            sa.ForeignKey("user_profile.user_profile_id"),
        ),
        sa.Column(
            "snapshot",
            postgresql.JSONB(),
            comment="Event details or submission content snapshot",
        ),
        *audit_columns(),
        sa.CheckConstraint(
            "sub_status IS NULL OR (event = 'SUB_STATUS_CHANGE' AND "
            "sub_status IN ('Assigned', 'Under Review', 'Information requested'))",
            name=op.f("ck_da_eoc_submission_history_sub_status"),
        ),
    )
    op.create_index(
        "ix_da_eoc_submission_history_sub_status_event",
        "da_eoc_submission_history",
        ["da_eoc_submission_id", "event", "da_eoc_submission_history_id"],
    )
    op.create_index(
        "ix_da_eoc_submission_history_submission_id",
        "da_eoc_submission_history",
        ["da_eoc_submission_id"],
    )
    # Match the portal-wide row-level audit coverage for all new tables.
    op.execute("SELECT ensure_audit_triggers();")


def downgrade():
    op.drop_table("da_eoc_submission_history")
    op.drop_table("da_eoc_submission_document_association")
    op.drop_table("da_eoc_submission")
