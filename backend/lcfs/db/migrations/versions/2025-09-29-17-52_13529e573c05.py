"""FSE Compliance reporting

Revision ID: 13529e573c05
Revises: f1a2b3c4d5e6
Create Date: 2025-09-29 17:52:15.519620

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "13529e573c05"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fse_compliance_reporting",
        sa.Column(
            "fse_compliance_reporting_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column("supply_from_date", sa.Date(), nullable=False),
        sa.Column("supply_to_date", sa.Date(), nullable=False),
        sa.Column("kwh_usage", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("charging_equipment_id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("compliance_report_id", sa.Integer(), nullable=False),
        sa.Column("compliance_period_id", sa.Integer(), nullable=False),
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
        sa.CheckConstraint(
            "supply_to_date >= supply_from_date",
            name=op.f("ck_fse_compliance_reporting_check_supply_date_order"),
        ),
        sa.ForeignKeyConstraint(
            ["charging_equipment_id"],
            ["charging_equipment.charging_equipment_id"],
            name=op.f(
                "fk_fse_compliance_reporting_charging_equipment_id_charging_equipment"
            ),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["compliance_period_id"],
            ["compliance_period.compliance_period_id"],
            name=op.f(
                "fk_fse_compliance_reporting_compliance_period_id_compliance_period"
            ),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["compliance_report_id"],
            ["compliance_report.compliance_report_id"],
            name=op.f(
                "fk_fse_compliance_reporting_compliance_report_id_compliance_report"
            ),
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
            name="uix_fse_compliance_reporting_equipment_dates",
        ),
        sa.UniqueConstraint(
            "compliance_period_id",
            "compliance_report_id",
            "charging_equipment_id",
            "organization_id",
            name="uix_fse_compliance_reporting_period_by_org",
        ),
        comment="FSE compliance reporting",
        replace_if_exists=True,
    )
    op.create_index(
        op.f("ix_fse_compliance_reporting_charging_equipment_id"),
        "fse_compliance_reporting",
        ["charging_equipment_id"], replace_if_exists=True,
    )
    op.create_index(
        op.f("ix_fse_compliance_reporting_compliance_period_id"),
        "fse_compliance_reporting",
        ["compliance_period_id"], replace_if_exists=True,
    )
    op.create_index(
        op.f("ix_fse_compliance_reporting_compliance_report_id"),
        "fse_compliance_reporting",
        ["compliance_report_id"], replace_if_exists=True,
    )
    op.create_index(
        op.f("ix_fse_compliance_reporting_organization_id"),
        "fse_compliance_reporting",
        ["organization_id"], replace_if_exists=True,
    )

    # Fix invalid date data in final_supply_equipment before migration

    # First, identify and log records with clearly invalid dates (typos, wrong century, etc.)
    # These need manual review and cannot be automatically fixed
    op.execute("""
        DO $$
        DECLARE
            invalid_record RECORD;
        BEGIN
            FOR invalid_record IN
                SELECT final_supply_equipment_id, supply_from_date, supply_to_date
                FROM final_supply_equipment
                WHERE supply_from_date < '2000-01-01'::date
                   OR supply_to_date < '2000-01-01'::date
                   OR supply_from_date > CURRENT_DATE + interval '10 years'
                   OR supply_to_date > CURRENT_DATE + interval '10 years'
            LOOP
                RAISE WARNING 'Invalid date found in final_supply_equipment_id=%: from=%, to=%',
                    invalid_record.final_supply_equipment_id,
                    invalid_record.supply_from_date,
                    invalid_record.supply_to_date;
            END LOOP;
        END $$;
    """)

    # Swap supply_from_date and supply_to_date where they are in wrong order
    # Only swap dates that appear to be valid (reasonable date range)
    # Using tuple syntax to ensure proper swap operation
    op.execute("""
        UPDATE final_supply_equipment
        SET (supply_from_date, supply_to_date) = (supply_to_date, supply_from_date)
        WHERE supply_to_date < supply_from_date
            AND supply_from_date >= '2000-01-01'::date
            AND supply_to_date >= '2000-01-01'::date
            AND supply_from_date <= CURRENT_DATE + interval '10 years'
            AND supply_to_date <= CURRENT_DATE + interval '10 years'
    """)

    # Migrate data from final_supply_equipment to fse_compliance_reporting
    op.execute("""
        INSERT INTO fse_compliance_reporting (
            supply_from_date,
            supply_to_date,
            kwh_usage,
            notes,
            charging_equipment_id,
            organization_id,
            compliance_report_id,
            compliance_period_id,
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
            cr.compliance_period_id,
            fse.create_date,
            fse.update_date,
            fse.create_user,
            fse.update_user
        FROM final_supply_equipment fse
        JOIN compliance_report cr ON fse.compliance_report_id = cr.compliance_report_id
        JOIN charging_equipment ce ON ce.charging_equipment_id = fse.final_supply_equipment_id
        WHERE fse.kwh_usage IS NOT NULL
    """)


def downgrade() -> None:
    op.drop_index(
        op.f("ix_fse_compliance_reporting_organization_id"),
        table_name="fse_compliance_reporting",
        if_exists=True,
    )
    op.drop_index(
        op.f("ix_fse_compliance_reporting_compliance_report_id"),
        table_name="fse_compliance_reporting",
        if_exists=True,
    )
    op.drop_index(
        op.f("ix_fse_compliance_reporting_compliance_period_id"),
        table_name="fse_compliance_reporting",
        if_exists=True,
    )
    op.drop_index(
        op.f("ix_fse_compliance_reporting_charging_equipment_id"),
        table_name="fse_compliance_reporting",
        if_exists=True,
    )
    op.drop_table("fse_compliance_reporting")