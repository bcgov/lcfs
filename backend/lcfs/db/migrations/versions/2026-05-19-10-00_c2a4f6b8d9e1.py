"""Add CI application internal workflow tracking fields.

Revision ID: c2a4f6b8d9e1
Revises: c1a2b3c4d5e6
Create Date: 2026-05-19 10:00:00.000000
"""

import sqlalchemy as sa
from alembic import op


revision = "c2a4f6b8d9e1"
down_revision = "c1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ci_application",
        sa.Column(
            "preliminary_risk_assessment",
            sa.String(length=20),
            nullable=True,
            comment="Preliminary risk assessment: Low, Medium, or High",
        ),
    )
    op.add_column(
        "ci_application",
        sa.Column(
            "verification_1_user_id",
            sa.Integer(),
            nullable=True,
            comment="User who completed Verification 1",
        ),
    )
    op.add_column(
        "ci_application",
        sa.Column(
            "verification_1_date",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            comment="UTC date and time Verification 1 was completed",
        ),
    )
    op.add_column(
        "ci_application",
        sa.Column(
            "verification_2_user_id",
            sa.Integer(),
            nullable=True,
            comment="User who completed Verification 2",
        ),
    )
    op.add_column(
        "ci_application",
        sa.Column(
            "verification_2_date",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            comment="UTC date and time Verification 2 was completed",
        ),
    )
    op.add_column(
        "ci_application",
        sa.Column(
            "verification_2_risk_assessment",
            sa.String(length=20),
            nullable=True,
            comment="Risk assessment recorded during Verification 2",
        ),
    )
    op.add_column(
        "ci_application",
        sa.Column(
            "verification_2_priority_score",
            sa.Integer(),
            nullable=True,
            comment="Priority score recorded during Verification 2",
        ),
    )
    op.add_column(
        "ci_application",
        sa.Column(
            "recommendation_user_id",
            sa.Integer(),
            nullable=True,
            comment="User who recommended the application to the director",
        ),
    )
    op.add_column(
        "ci_application",
        sa.Column(
            "recommendation_date",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            comment="UTC date and time the application was recommended to director",
        ),
    )
    op.add_column(
        "ci_application",
        sa.Column(
            "approval_user_id",
            sa.Integer(),
            nullable=True,
            comment="User who approved the application",
        ),
    )
    op.add_column(
        "ci_application",
        sa.Column(
            "approval_date",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            comment="UTC date and time the application was approved",
        ),
    )

    op.create_foreign_key(
        op.f("fk_ci_application_verification_1_user_id_user_profile"),
        "ci_application",
        "user_profile",
        ["verification_1_user_id"],
        ["user_profile_id"],
    )
    op.create_foreign_key(
        op.f("fk_ci_application_verification_2_user_id_user_profile"),
        "ci_application",
        "user_profile",
        ["verification_2_user_id"],
        ["user_profile_id"],
    )
    op.create_foreign_key(
        op.f("fk_ci_application_recommendation_user_id_user_profile"),
        "ci_application",
        "user_profile",
        ["recommendation_user_id"],
        ["user_profile_id"],
    )
    op.create_foreign_key(
        op.f("fk_ci_application_approval_user_id_user_profile"),
        "ci_application",
        "user_profile",
        ["approval_user_id"],
        ["user_profile_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("fk_ci_application_approval_user_id_user_profile"),
        "ci_application",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("fk_ci_application_recommendation_user_id_user_profile"),
        "ci_application",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("fk_ci_application_verification_2_user_id_user_profile"),
        "ci_application",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("fk_ci_application_verification_1_user_id_user_profile"),
        "ci_application",
        type_="foreignkey",
    )
    op.drop_column("ci_application", "approval_date")
    op.drop_column("ci_application", "approval_user_id")
    op.drop_column("ci_application", "recommendation_date")
    op.drop_column("ci_application", "recommendation_user_id")
    op.drop_column("ci_application", "verification_2_date")
    op.drop_column("ci_application", "verification_2_priority_score")
    op.drop_column("ci_application", "verification_2_risk_assessment")
    op.drop_column("ci_application", "verification_2_user_id")
    op.drop_column("ci_application", "verification_1_date")
    op.drop_column("ci_application", "verification_1_user_id")
    op.drop_column("ci_application", "preliminary_risk_assessment")
