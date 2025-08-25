"""FSE Compliance Reporting association

Revision ID: b7c0cbcad7d8
Revises: 6640ecfbe53
Create Date: 2025-08-25 08:59:52.924747

"""

import sqlalchemy as sa
from alembic import op
from alembic_postgresql_enum import TableReference
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "b7c0cbcad7d8"
down_revision = "6640ecfbe53"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fse_compliance_association",
        sa.Column(
            "fse_compliance_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the FSE compliance association",
        ),
        sa.Column(
            "fse_id",
            sa.Integer(),
            nullable=False,
            comment="Reference to final supply equipment",
        ),
        sa.Column(
            "compliance_report_id",
            sa.Integer(),
            nullable=False,
            comment="Reference to compliance report",
        ),
        sa.Column(
            "organization_id",
            sa.Integer(),
            nullable=False,
            comment="Reference to organization",
        ),
        sa.Column(
            "date_of_supply_from",
            sa.DateTime(),
            nullable=False,
            comment="Start date of the supply period",
        ),
        sa.Column(
            "date_of_supply_to",
            sa.DateTime(),
            nullable=False,
            comment="End date of the supply period",
        ),
        sa.Column(
            "kwh_usage",
            sa.Double(),
            nullable=True,
            comment="kWh usage during the supply period (optional)",
        ),
        sa.Column(
            "compliance_notes",
            sa.Text(),
            nullable=True,
            comment="Optional notes about compliance for this association",
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
            ["compliance_report_id"],
            ["compliance_report.compliance_report_id"],
            name=op.f(
                "fk_fse_compliance_association_compliance_report_id_compliance_report"
            ),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["fse_id"],
            ["fse.fse_id"],
            name=op.f("fk_fse_compliance_association_fse_id_fse"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organization.organization_id"],
            name=op.f("fk_fse_compliance_association_organization_id_organization"),
        ),
        sa.PrimaryKeyConstraint(
            "fse_compliance_id", name=op.f("pk_fse_compliance_association")
        ),
        comment="Association between FSE, Compliance Report, and Organization with supply data",
    )
    op.create_index(
        op.f("ix_fse_compliance_association_compliance_report_id"),
        "fse_compliance_association",
        ["compliance_report_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_fse_compliance_association_fse_id"),
        "fse_compliance_association",
        ["fse_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_fse_compliance_association_organization_id"),
        "fse_compliance_association",
        ["organization_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_fse_compliance_association_organization_id"),
        table_name="fse_compliance_association",
    )
    op.drop_index(
        op.f("ix_fse_compliance_association_fse_id"),
        table_name="fse_compliance_association",
    )
    op.drop_index(
        op.f("ix_fse_compliance_association_compliance_report_id"),
        table_name="fse_compliance_association",
    )
    op.drop_table("fse_compliance_association")
