"""Add charging equipment version to compliance report association

Revision ID: 5e1a2c3d4f67
Revises: 1909a3e5fafd
Create Date: 2025-11-05 09:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "5e1a2c3d4f67"
down_revision = "1909a3e5fafd"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "compliance_report_charging_equipment",
        sa.Column(
            "charging_equipment_version",
            sa.Integer(),
            nullable=True,
            comment="Version of the referenced charging equipment when this record was created",
        ),
    )
    op.execute(
        """
        UPDATE compliance_report_charging_equipment crce
        SET charging_equipment_version = (
            SELECT MAX(version)
            FROM charging_equipment ce
            WHERE ce.charging_equipment_id = crce.charging_equipment_id
        )
        """
    )

    op.alter_column(
        "compliance_report_charging_equipment",
        "charging_equipment_version",
        existing_type=sa.Integer(),
        nullable=False,
    )

    op.drop_constraint(
        "uix_compliance_reporting_equipment_dates",
        "compliance_report_charging_equipment",
        type_="unique",
    )
    op.drop_constraint(
        "uix_compliance_reporting_period_by_org",
        "compliance_report_charging_equipment",
        type_="unique",
    )

    op.create_unique_constraint(
        "uix_compliance_reporting_equipment_dates",
        "compliance_report_charging_equipment",
        [
            "charging_equipment_id",
            "charging_equipment_version",
            "supply_from_date",
            "supply_to_date",
        ],
    )
    op.create_unique_constraint(
        "uix_compliance_reporting_period_by_org",
        "compliance_report_charging_equipment",
        [
            "compliance_report_group_uuid",
            "charging_equipment_id",
            "charging_equipment_version",
            "organization_id",
        ],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uix_compliance_reporting_equipment_dates",
        "compliance_report_charging_equipment",
        type_="unique",
    )
    op.drop_constraint(
        "uix_compliance_reporting_period_by_org",
        "compliance_report_charging_equipment",
        type_="unique",
    )

    op.drop_column(
        "compliance_report_charging_equipment",
        "charging_equipment_version",
    )

    op.create_unique_constraint(
        "uix_compliance_reporting_equipment_dates",
        "compliance_report_charging_equipment",
        ["charging_equipment_id", "supply_from_date", "supply_to_date"],
    )
    op.create_unique_constraint(
        "uix_compliance_reporting_period_by_org",
        "compliance_report_charging_equipment",
        [
            "compliance_report_group_uuid",
            "charging_equipment_id",
            "organization_id",
        ],
    )
