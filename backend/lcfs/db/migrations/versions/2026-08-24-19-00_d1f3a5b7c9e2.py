"""Add analyst assessment fields to evidence requirements.

Closes the outstanding acceptance criterion on #4846 (an analyst review
field supporting long-form text) and backs the evidence of completion
review section (#4899): each requirement carries the analyst's narrative,
optional notes, and one outcome of Satisfactory or Information requested.

Every column is nullable — a requirement that has not been reviewed has
no assessment, and NULL says exactly that. Completed review rounds are
preserved as payload-carrying snapshots in designated_action_history, so
requesting more information never destroys the previous round's finding.

Revision ID: d1f3a5b7c9e2
Revises: c9d4e6f8a0b2
Create Date: 2026-08-24 19:00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "d1f3a5b7c9e2"
down_revision = "c9d4e6f8a0b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "evidence_requirement",
        sa.Column(
            "analyst_review",
            sa.Text(),
            nullable=True,
            comment="Analyst's long-form record of the evidence for this requirement",
        ),
    )
    op.add_column(
        "evidence_requirement",
        sa.Column(
            "review_outcome",
            sa.String(length=100),
            nullable=True,
            comment=(
                "Assessment result (Satisfactory | Information requested); "
                "NULL until the requirement has been reviewed"
            ),
        ),
    )
    op.add_column(
        "evidence_requirement",
        sa.Column(
            "review_notes",
            sa.Text(),
            nullable=True,
            comment="Optional analyst notes accompanying the assessment",
        ),
    )
    op.add_column(
        "evidence_requirement",
        sa.Column(
            "reviewed_by_user_id",
            sa.Integer(),
            nullable=True,
            comment="User who recorded the current assessment",
        ),
    )
    op.add_column(
        "evidence_requirement",
        sa.Column(
            "reviewed_date",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            comment="When the current assessment was recorded",
        ),
    )
    op.create_foreign_key(
        op.f("fk_evidence_requirement_reviewed_by_user_id_user_profile"),
        "evidence_requirement",
        "user_profile",
        ["reviewed_by_user_id"],
        ["user_profile_id"],
    )
    op.create_index(
        op.f("ix_evidence_requirement_reviewed_by_user_id"),
        "evidence_requirement",
        ["reviewed_by_user_id"],
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_evidence_requirement_reviewed_by_user_id"),
        table_name="evidence_requirement",
    )
    op.drop_constraint(
        op.f("fk_evidence_requirement_reviewed_by_user_id_user_profile"),
        "evidence_requirement",
        type_="foreignkey",
    )
    op.drop_column("evidence_requirement", "reviewed_date")
    op.drop_column("evidence_requirement", "reviewed_by_user_id")
    op.drop_column("evidence_requirement", "review_notes")
    op.drop_column("evidence_requirement", "review_outcome")
    op.drop_column("evidence_requirement", "analyst_review")
