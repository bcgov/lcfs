"""Add versioning to compliance report charging equipment

Revision ID: f8e9d0c1b2a3
Revises: c1a2b3c4d5e6
Create Date: 2026-05-25 12:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from lcfs.db.dependencies import (
    execute_sql_sections,
    find_and_read_sql_file,
    parse_sql_sections,
)


revision = "f8e9d0c1b2a3"
down_revision = "c1a2b3c4d5e6"
branch_labels = None
depends_on = None


SECTIONS_TO_EXECUTE = [
    "FSE Reporting Base View",
    "FSE Reporting Base Preferred View",
]


def _refresh_fse_reporting_views() -> None:
    content = find_and_read_sql_file(sqlFile="metabase.sql")
    sections = parse_sql_sections(content)
    execute_sql_sections(sections, SECTIONS_TO_EXECUTE)


def upgrade() -> None:
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

    op.add_column(
        "compliance_report_charging_equipment",
        sa.Column(
            "version",
            sa.Integer(),
            nullable=False,
            server_default="0",
            comment=(
                "Version number for this report-equipment association within its "
                "reporting group"
            ),
        ),
    )
    op.add_column(
        "compliance_report_charging_equipment",
        sa.Column(
            "action_type",
            postgresql.ENUM(
                "CREATE",
                "UPDATE",
                "DELETE",
                name="actiontypeenum",
                create_type=False,
            ),
            nullable=False,
            server_default=sa.text("'CREATE'"),
            comment="Action type for this report-equipment association version",
        ),
    )

    op.create_unique_constraint(
        "uix_compliance_reporting_equipment_dates",
        "compliance_report_charging_equipment",
        [
            "compliance_report_group_uuid",
            "charging_equipment_id",
            "charging_equipment_version",
            "supply_from_date",
            "supply_to_date",
            "version",
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
            "version",
        ],
    )
    op.execute(
        """
        CREATE INDEX ix_crce_reporting_revision_key
        ON compliance_report_charging_equipment (
            compliance_report_group_uuid,
            charging_equipment_id,
            charging_equipment_version,
            organization_id,
            version DESC
        );
        """
    )

    _refresh_fse_reporting_views()


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS v_fse_reporting_base_pref;")
    op.execute("DROP VIEW IF EXISTS v_fse_reporting_base CASCADE;")

    op.drop_index(
        "ix_crce_reporting_revision_key",
        table_name="compliance_report_charging_equipment",
    )
    op.drop_constraint(
        "uix_compliance_reporting_period_by_org",
        "compliance_report_charging_equipment",
        type_="unique",
    )
    op.drop_constraint(
        "uix_compliance_reporting_equipment_dates",
        "compliance_report_charging_equipment",
        type_="unique",
    )

    op.drop_column("compliance_report_charging_equipment", "action_type")
    op.drop_column("compliance_report_charging_equipment", "version")

    op.create_unique_constraint(
        "uix_compliance_reporting_equipment_dates",
        "compliance_report_charging_equipment",
        [
            "compliance_report_group_uuid",
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
