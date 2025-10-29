"""Fix Charging Equipment Compliance association table

Revision ID: 1f3ce398db1c
Revises: add_ce_intended_users
Create Date: 2025-10-28 06:48:03.332799

"""

import sqlalchemy as sa
from alembic import op
from alembic_postgresql_enum import TableReference
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "1f3ce398db1c"
down_revision = "add_ce_intended_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index(
        op.f("ix_fse_compliance_reporting_charging_equipment_id"),
        table_name="fse_compliance_reporting",
    )
    op.drop_index(
        op.f("ix_fse_compliance_reporting_compliance_period_id"),
        table_name="fse_compliance_reporting",
    )
    op.drop_index(
        op.f("ix_fse_compliance_reporting_compliance_report_id"),
        table_name="fse_compliance_reporting",
    )
    op.drop_index(
        op.f("ix_fse_compliance_reporting_organization_id"),
        table_name="fse_compliance_reporting",
    )
    op.drop_table("fse_compliance_reporting")
    op.add_column(
        "compliance_report_charging_equipment",
        sa.Column(
            "supply_from_date",
            sa.DateTime(),
            nullable=False,
            comment="Start date of the supply period",
        ),
    )
    op.add_column(
        "compliance_report_charging_equipment",
        sa.Column(
            "supply_to_date",
            sa.DateTime(),
            nullable=False,
            comment="End date of the supply period",
        ),
    )
    op.add_column(
        "compliance_report_charging_equipment",
        sa.Column(
            "compliance_report_group_uuid",
            sa.String(length=36),
            nullable=False,
            comment="UUID that groups all versions of a compliance report",
        ),
    )
    op.create_unique_constraint(
        "uix_compliance_reporting_equipment_dates",
        "compliance_report_charging_equipment",
        ["charging_equipment_id", "supply_from_date", "supply_to_date"],
    )
    op.create_unique_constraint(
        "uix_compliance_reporting_period_by_org",
        "compliance_report_charging_equipment",
        ["compliance_report_group_uuid", "charging_equipment_id", "organization_id"],
    )
    op.drop_column("compliance_report_charging_equipment", "date_of_supply_from")
    op.drop_column("compliance_report_charging_equipment", "date_of_supply_to")
    # Migrate data from final_supply_equipment to compliance_report_charging_equipment
    op.execute(
        """
        INSERT INTO compliance_report_charging_equipment (
            supply_from_date,
            supply_to_date,
            kwh_usage,
            compliance_notes,
            charging_equipment_id,
            organization_id,
            compliance_report_id,
            compliance_report_group_uuid,
            create_date,
            update_date,
            create_user,
            update_user
        )
        SELECT 
            fse.supply_from_date,
            fse.supply_to_date,
            COALESCE(fse.kwh_usage, 0)::integer,
            fse.notes,
            ce.charging_equipment_id,
            cr.organization_id,
            fse.compliance_report_id,
            cr.compliance_report_group_uuid,
            fse.create_date,
            fse.update_date,
            fse.create_user,
            fse.update_user
        FROM final_supply_equipment fse
        JOIN compliance_report cr ON fse.compliance_report_id = cr.compliance_report_id
        JOIN charging_equipment ce ON ce.charging_equipment_id = fse.final_supply_equipment_id
        WHERE fse.kwh_usage IS NOT NULL
    """
    )


def downgrade() -> None:
    op.add_column(
        "compliance_report_charging_equipment",
        sa.Column(
            "date_of_supply_to",
            sa.DateTime(),
            nullable=True,
            comment="End date of the supply period",
        ),
    )
    op.add_column(
        "compliance_report_charging_equipment",
        sa.Column(
            "date_of_supply_from",
            sa.DateTime(),
            nullable=True,
            comment="Start date of the supply period",
        ),
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
    op.drop_column("compliance_report_charging_equipment", "supply_to_date")
    op.drop_column("compliance_report_charging_equipment", "supply_from_date")
    op.drop_column(
        "compliance_report_charging_equipment", "compliance_report_group_uuid"
    )
    op.create_table(
        "fse_compliance_reporting",
        sa.Column(
            "fse_compliance_reporting_id",
            sa.INTEGER(),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column("supply_from_date", sa.DATE(), autoincrement=False, nullable=False),
        sa.Column("supply_to_date", sa.DATE(), autoincrement=False, nullable=False),
        sa.Column("kwh_usage", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column("notes", sa.TEXT(), autoincrement=False, nullable=True),
        sa.Column(
            "charging_equipment_id", sa.INTEGER(), autoincrement=False, nullable=False
        ),
        sa.Column("organization_id", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column(
            "compliance_report_id", sa.INTEGER(), autoincrement=False, nullable=False
        ),
        sa.Column(
            "compliance_period_id", sa.INTEGER(), autoincrement=False, nullable=False
        ),
        sa.Column(
            "create_date",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            autoincrement=False,
            nullable=True,
            comment="Date and time (UTC) when the physical record was created in the database.",
        ),
        sa.Column(
            "update_date",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            autoincrement=False,
            nullable=True,
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
        ),
        sa.Column(
            "create_user",
            sa.VARCHAR(),
            autoincrement=False,
            nullable=True,
            comment="The user who created this record in the database.",
        ),
        sa.Column(
            "update_user",
            sa.VARCHAR(),
            autoincrement=False,
            nullable=True,
            comment="The user who last updated this record in the database.",
        ),
        sa.CheckConstraint(
            "supply_to_date >= supply_from_date",
            name=op.f("ck_fse_compliance_reporting_check_supply_date_order"),
        ),
        sa.ForeignKeyConstraint(
            ["charging_equipment_id"],
            ["charging_equipment.charging_equipment_id"],
            name=op.f("fk_fse_compliance_reporting_charging_equipment_id_charg_54f8"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["compliance_period_id"],
            ["compliance_period.compliance_period_id"],
            name=op.f("fk_fse_compliance_reporting_compliance_period_id_compli_574a"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["compliance_report_id"],
            ["compliance_report.compliance_report_id"],
            name=op.f("fk_fse_compliance_reporting_compliance_report_id_compli_5f96"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organization.organization_id"],
            name=op.f("fk_fse_compliance_reporting_organization_id_organization"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "fse_compliance_reporting_id", name=op.f("pk_fse_compliance_reporting")
        ),
        sa.UniqueConstraint(
            "charging_equipment_id",
            "supply_from_date",
            "supply_to_date",
            name=op.f("uix_fse_compliance_reporting_equipment_dates"),
            postgresql_include=[],
            postgresql_nulls_not_distinct=False,
        ),
        sa.UniqueConstraint(
            "compliance_period_id",
            "compliance_report_id",
            "charging_equipment_id",
            "organization_id",
            name=op.f("uix_fse_compliance_reporting_period_by_org"),
            postgresql_include=[],
            postgresql_nulls_not_distinct=False,
        ),
        comment="FSE compliance reporting",
    )
    op.create_index(
        op.f("ix_fse_compliance_reporting_organization_id"),
        "fse_compliance_reporting",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_fse_compliance_reporting_compliance_report_id"),
        "fse_compliance_reporting",
        ["compliance_report_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_fse_compliance_reporting_compliance_period_id"),
        "fse_compliance_reporting",
        ["compliance_period_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_fse_compliance_reporting_charging_equipment_id"),
        "fse_compliance_reporting",
        ["charging_equipment_id"],
        unique=False,
    )
