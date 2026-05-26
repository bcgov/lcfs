"""Add IDIR-side list view columns to CI applications.

Revision ID: c1a2b3c4d5e6
Revises: b8f9c0d1e2a3
Create Date: 2026-05-14 08:30:00.000000
"""

import sqlalchemy as sa
from alembic import op


revision = "c1a2b3c4d5e6"
down_revision = "b8f9c0d1e2a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ci_application",
        sa.Column(
            "assigned_analyst_id",
            sa.Integer(),
            sa.ForeignKey(
                "user_profile.user_profile_id",
                name="fk_ci_application_assigned_analyst_id_user_profile",
            ),
            nullable=True,
            comment="IDIR Analyst assigned to review this CI application.",
        ),
    )
    op.create_index(
        "ix_ci_application_assigned_analyst_id",
        "ci_application",
        ["assigned_analyst_id"],
    )
    op.add_column(
        "ci_application",
        sa.Column(
            "priority_score",
            sa.Integer(),
            nullable=True,
            comment="Analyst-facing triage score for the IDIR CI applications inbox.",
        ),
    )
    op.add_column(
        "ci_application",
        sa.Column(
            "verification_level",
            sa.String(length=50),
            nullable=True,
            comment="Verification level label (e.g. 'VX1 - Low', 'VX2 - High').",
        ),
    )


def downgrade() -> None:
    op.drop_column("ci_application", "verification_level")
    op.drop_column("ci_application", "priority_score")
    op.drop_index(
        "ix_ci_application_assigned_analyst_id",
        table_name="ci_application",
    )
    op.drop_constraint(
        "fk_ci_application_assigned_analyst_id_user_profile",
        "ci_application",
        type_="foreignkey",
    )
    op.drop_column("ci_application", "assigned_analyst_id")
