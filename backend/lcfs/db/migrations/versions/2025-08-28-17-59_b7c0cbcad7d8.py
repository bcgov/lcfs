"""Charging Equipment Compliance Reporting association

Revision ID: b7c0cbcad7d8
Revises: 6640ecfbe53
Create Date: 2025-08-28 08:59:52.924747

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "b7c0cbcad7d8"
down_revision = "6640ecfbe53"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "compliance_report_charging_equipment",
        sa.Column(
            "charging_equipment_compliance_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the charging equipment compliance association",
        ),
        sa.Column(
            "charging_equipment_id",
            sa.Integer(),
            nullable=False,
            comment="Reference to charging equipment",
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
                "fk_compliance_report_charging_equipment_compliance_report_id_compliance_report"
            ),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["charging_equipment_id"],
            ["charging_equipment.charging_equipment_id"],
            name=op.f(
                "fk_compliance_report_charging_equipment_charging_equipment_id_charging_equipment"
            ),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organization.organization_id"],
            name=op.f(
                "fk_compliance_report_charging_equipment_organization_id_organization"
            ),
        ),
        sa.PrimaryKeyConstraint(
            "charging_equipment_compliance_id",
            name=op.f("pk_compliance_report_charging_equipment"),
        ),
        comment="Association between Charging Equipment, Compliance Report, and Organization with supply data",
    )
    op.create_index(
        op.f("ix_compliance_report_charging_equipment_compliance_report_id"),
        "compliance_report_charging_equipment",
        ["compliance_report_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_compliance_report_charging_equipment_charging_equipment_id"),
        "compliance_report_charging_equipment",
        ["charging_equipment_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_compliance_report_charging_equipment_organization_id"),
        "compliance_report_charging_equipment",
        ["organization_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_compliance_report_charging_equipment_organization_id"),
        table_name="compliance_report_charging_equipment",
    )
    op.drop_index(
        op.f("ix_compliance_report_charging_equipment_charging_equipment_id"),
        table_name="compliance_report_charging_equipment",
    )
    op.drop_index(
        op.f("ix_compliance_report_charging_equipment_compliance_report_id"),
        table_name="compliance_report_charging_equipment",
    )
    op.drop_table("compliance_report_charging_equipment")
