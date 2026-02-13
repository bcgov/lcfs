"""Penalty log

Revision ID: 63c126dcbecc
Revises: 3ac464e21203
Create Date: 2025-10-08 12:42:54.801204

"""

import sqlalchemy as sa
from alembic import op
from alembic_postgresql_enum import TableReference
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "63c126dcbecc"
down_revision = "3ac464e21203"
branch_labels = None
depends_on = None


def enum_exists(enum_name):
    """Check if an enum type exists"""
    bind = op.get_bind()
    result = bind.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = :enum_name)"
        ),
        {"enum_name": enum_name}
    )
    return result.scalar()


def table_exists(table_name):
    """Check if a table exists"""
    bind = op.get_bind()
    inspector = inspect(bind)
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    # Create enum only if it doesn't exist
    if not enum_exists("contravention_enum"):
        sa.Enum(
            "Single contravention", "Continuous contravention", name="contravention_enum"
        ).create(op.get_bind())

    # Create table only if it doesn't exist
    if not table_exists("penalty_log"):
        op.create_table(
            "penalty_log",
        sa.Column(
            "penalty_log_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the penalty log entry.",
        ),
        sa.Column(
            "organization_id",
            sa.Integer(),
            nullable=False,
            comment="Organization associated with the penalty entry.",
        ),
        sa.Column(
            "compliance_period_id",
            sa.Integer(),
            nullable=False,
            comment="Compliance period that the penalty relates to.",
        ),
        sa.Column(
            "contravention_type",
            postgresql.ENUM(
                "Single contravention",
                "Continuous contravention",
                name="contravention_enum",
                create_type=False,
            ),
            nullable=False,
            comment="Type of penalty assessed (e.g., 'Single contravention', 'Continuous contravention').",
        ),
        sa.Column(
            "offence_history",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
            comment="Indicates if prior offences exist for the organization.",
        ),
        sa.Column(
            "deliberate",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
            comment="Indicates if the violation was deliberate.",
        ),
        sa.Column(
            "efforts_to_correct",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
            comment="Indicates if efforts were made to correct the violation.",
        ),
        sa.Column(
            "economic_benefit_derived",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
            comment="Indicates if an economic benefit was derived from the violation.",
        ),
        sa.Column(
            "efforts_to_prevent_recurrence",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
            comment="Indicates if efforts were made to prevent recurrence of the violation.",
        ),
        sa.Column(
            "notes",
            sa.Text(),
            nullable=True,
            comment="Additional notes about the penalty assessment.",
        ),
        sa.Column(
            "penalty_amount",
            sa.Numeric(precision=12, scale=2),
            server_default=sa.text("0"),
            nullable=False,
            comment="Penalty amount assessed in dollars.",
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
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
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
            ["compliance_period_id"],
            ["compliance_period.compliance_period_id"],
            name=op.f("fk_penalty_log_compliance_period_id_compliance_period"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organization.organization_id"],
            name=op.f("fk_penalty_log_organization_id_organization"),
        ),
        sa.PrimaryKeyConstraint("penalty_log_id", name=op.f("pk_penalty_log")),
        comment="Records penalty assessments applied to organizations for a given compliance period.",
    )


def downgrade() -> None:
    op.drop_table("penalty_log")
    sa.Enum(
        "Single contravention", "Continuous contravention", name="contravention_enum"
    ).drop(op.get_bind())

