"""Add CI application fuel code association table.

Revision ID: b1c2d3e4f5a6
Revises: f2c8a9d1b3e5
Create Date: 2026-06-29 09:30:00.000000
"""

import sqlalchemy as sa
from alembic import op


revision = "b1c2d3e4f5a6"
down_revision = "f2c8a9d1b3e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ci_application_fuel_code_association",
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
            comment=(
                "Date and time (UTC) when the physical record was updated in "
                "the database. It will be the same as the create_date until "
                "the record is first updated after creation."
            ),
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
        sa.Column(
            "ci_application_fuel_code_association_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the CI application fuel code association",
        ),
        sa.Column(
            "ci_application_id",
            sa.Integer(),
            nullable=False,
            comment="CI application that generated this fuel code",
        ),
        sa.Column(
            "fuel_code_id",
            sa.Integer(),
            nullable=False,
            comment="Draft fuel code generated for the CI application",
        ),
        sa.Column(
            "pathway_id",
            sa.Integer(),
            nullable=True,
            comment="Pathway that produced this draft fuel code",
        ),
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=False,
            comment="Display order for generated fuel code rows",
        ),
        sa.ForeignKeyConstraint(
            ["ci_application_id"],
            ["ci_application.ci_application_id"],
            name=op.f(
                "fk_ci_application_fuel_code_association_ci_application_id_ci_application"
            ),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["fuel_code_id"],
            ["fuel_code.fuel_code_id"],
            name=op.f("fk_ci_application_fuel_code_association_fuel_code_id_fuel_code"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["pathway_id"],
            ["pathway.pathway_id"],
            name=op.f("fk_ci_application_fuel_code_association_pathway_id_pathway"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint(
            "ci_application_fuel_code_association_id",
            name=op.f("pk_ci_application_fuel_code_association"),
        ),
        sa.UniqueConstraint(
            "ci_application_id",
            "fuel_code_id",
            name=op.f("uq_ci_application_fuel_code_association_ci_application_id"),
        ),
        comment=(
            "Associates CI applications with draft fuel codes generated from "
            "their pathway data."
        ),
    )
    op.create_index(
        op.f("ix_ci_application_fuel_code_association_ci_application_id"),
        "ci_application_fuel_code_association",
        ["ci_application_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_ci_application_fuel_code_association_fuel_code_id"),
        "ci_application_fuel_code_association",
        ["fuel_code_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_ci_application_fuel_code_association_pathway_id"),
        "ci_application_fuel_code_association",
        ["pathway_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_ci_application_fuel_code_association_pathway_id"),
        table_name="ci_application_fuel_code_association",
    )
    op.drop_index(
        op.f("ix_ci_application_fuel_code_association_fuel_code_id"),
        table_name="ci_application_fuel_code_association",
    )
    op.drop_index(
        op.f("ix_ci_application_fuel_code_association_ci_application_id"),
        table_name="ci_application_fuel_code_association",
    )
    op.drop_table("ci_application_fuel_code_association")
