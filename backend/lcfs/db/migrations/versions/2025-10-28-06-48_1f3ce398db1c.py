"""Fix Charging Equipment Compliance association table and preserve data

Revision ID: 1f3ce398db1c
Revises: adee8bc4a278
Create Date: 2025-10-28 06:48:03.332799

"""

import sqlalchemy as sa
from alembic import op
from alembic_postgresql_enum import TableReference
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "1f3ce398db1c"
down_revision = "adee8bc4a278"  # Fixed: was "add_ce_intended_users" which doesn't exist
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Note: organization_name preservation is now handled in migration adee8bc4a278
    # The allocating_organization_name field is added to charging_site in that migration

    # =========================================================================
    # PART 1: Drop and recreate fse_compliance_reporting table
    # =========================================================================

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

    # =========================================================================
    # PART 2: Add new columns to compliance_report_charging_equipment
    # =========================================================================

    # Add new columns as NULLABLE first (will populate and make NOT NULL later)
    op.add_column(
        "compliance_report_charging_equipment",
        sa.Column(
            "supply_from_date",
            sa.DateTime(),
            nullable=True,
            comment="Start date of the supply period",
        ),
    )
    op.add_column(
        "compliance_report_charging_equipment",
        sa.Column(
            "supply_to_date",
            sa.DateTime(),
            nullable=True,
            comment="End date of the supply period",
        ),
    )
    op.add_column(
        "compliance_report_charging_equipment",
        sa.Column(
            "compliance_report_group_uuid",
            sa.String(length=36),
            nullable=True,
            comment="UUID that groups all versions of a compliance report",
        ),
    )

    # Populate new columns from existing data (from FSE migration)
    op.execute(
        """
        UPDATE compliance_report_charging_equipment crce
        SET
            supply_from_date = crce.date_of_supply_from,
            supply_to_date = crce.date_of_supply_to,
            compliance_report_group_uuid = cr.compliance_report_group_uuid
        FROM compliance_report cr
        WHERE crce.compliance_report_id = cr.compliance_report_id
        AND crce.supply_from_date IS NULL;
        """
    )

    # Now make the columns NOT NULL
    op.alter_column('compliance_report_charging_equipment', 'supply_from_date', nullable=False)
    op.alter_column('compliance_report_charging_equipment', 'supply_to_date', nullable=False)
    op.alter_column('compliance_report_charging_equipment', 'compliance_report_group_uuid', nullable=False)

    # =========================================================================
    # PART 3: Add constraints
    # =========================================================================

    op.create_unique_constraint(
        "uix_compliance_reporting_equipment_dates",
        "compliance_report_charging_equipment",
        ["charging_equipment_id", "supply_from_date", "supply_to_date"],
    )
    op.create_unique_constraint(
        "uix_compliance_reporting_period_by_org",
        "compliance_report_charging_equipment",
        ["compliance_report_id", "charging_equipment_id", "organization_id"],
    )

    # Drop old columns
    op.drop_column("compliance_report_charging_equipment", "date_of_supply_from")
    op.drop_column("compliance_report_charging_equipment", "date_of_supply_to")

    # =========================================================================
    # PART 4: Fix malformed date data
    # =========================================================================

    # Fix supply dates for wrongly entered data where from_date > to_date
    op.execute(
        """
        UPDATE final_supply_equipment fse
        SET
            supply_from_date = make_date(2024, EXTRACT(MONTH FROM fse.supply_from_date)::int, EXTRACT(DAY FROM fse.supply_from_date)::int),
            supply_to_date   = make_date(2024, EXTRACT(MONTH FROM fse.supply_to_date)::int, EXTRACT(DAY FROM fse.supply_to_date)::int)
        WHERE fse.supply_from_date > fse.supply_to_date;
        """
    )

    # =========================================================================
    # PART 5: Migrate FSE data to compliance_report_charging_equipment
    # =========================================================================

    # Migrate core FSE data (only if not already migrated by earlier FSE migration)
    # This handles cases where the FSE migration (c19276038926) didn't run yet
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
        AND NOT EXISTS (
            SELECT 1 FROM compliance_report_charging_equipment crce
            WHERE crce.charging_equipment_id = ce.charging_equipment_id
            AND crce.compliance_report_id = fse.compliance_report_id
        )
        ON CONFLICT DO NOTHING;
        """
    )

    # =========================================================================
    # PART 6: Migrate Intended Uses associations from FSE to ChargingEquipment
    # =========================================================================

    print("Migrating intended uses associations from FSE to ChargingEquipment...")

    # Copy intended uses from final_supply_equipment to charging_equipment
    op.execute(
        """
        INSERT INTO charging_equipment_intended_use_association (
            charging_equipment_id,
            end_use_type_id
        )
        SELECT DISTINCT
            fse.final_supply_equipment_id,
            fsiu.end_use_type_id
        FROM final_supply_intended_use_association fsiu
        JOIN final_supply_equipment fse
            ON fse.final_supply_equipment_id = fsiu.final_supply_equipment_id
        WHERE fse.final_supply_equipment_id IN (
            SELECT charging_equipment_id FROM charging_equipment
        )
        ON CONFLICT DO NOTHING;
        """
    )

    # =========================================================================
    # PART 7: Migrate Intended Users associations from FSE to ChargingEquipment
    # =========================================================================

    print("Migrating intended users associations from FSE to ChargingEquipment...")

    # Copy intended users from final_supply_equipment to charging_equipment
    op.execute(
        """
        INSERT INTO charging_equipment_intended_user_association (
            charging_equipment_id,
            end_user_type_id
        )
        SELECT DISTINCT
            fse.final_supply_equipment_id,
            fsiu.end_user_type_id
        FROM final_supply_intended_user_association fsiu
        JOIN final_supply_equipment fse
            ON fse.final_supply_equipment_id = fsiu.final_supply_equipment_id
        WHERE fse.final_supply_equipment_id IN (
            SELECT charging_equipment_id FROM charging_equipment
        )
        ON CONFLICT DO NOTHING;
        """
    )

    # =========================================================================
    # PART 8: Data validation and logging
    # =========================================================================

    # Log statistics about the migration
    op.execute(
        """
        DO $$
        DECLARE
            fse_count INTEGER;
            crce_count INTEGER;
            use_count INTEGER;
            user_count INTEGER;
        BEGIN
            SELECT COUNT(*) INTO fse_count FROM final_supply_equipment;
            SELECT COUNT(*) INTO crce_count FROM compliance_report_charging_equipment;
            SELECT COUNT(*) INTO use_count FROM charging_equipment_intended_use_association;
            SELECT COUNT(*) INTO user_count FROM charging_equipment_intended_user_association;

            RAISE NOTICE 'Migration complete:';
            RAISE NOTICE '  - Final Supply Equipment records: %', fse_count;
            RAISE NOTICE '  - Compliance Report Charging Equipment records: %', crce_count;
            RAISE NOTICE '  - Charging Equipment Intended Use associations: %', use_count;
            RAISE NOTICE '  - Charging Equipment Intended User associations: %', user_count;
        END $$;
        """
    )


def downgrade() -> None:
    """
    WARNING: This downgrade is partially destructive.
    - Intended uses/users associations cannot be fully restored
    """

    # Note: allocating_organization_name is handled in migration adee8bc4a278

    # Add back old columns
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

    # Drop constraints
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

    # Drop new columns
    op.drop_column("compliance_report_charging_equipment", "supply_to_date")
    op.drop_column("compliance_report_charging_equipment", "supply_from_date")
    op.drop_column(
        "compliance_report_charging_equipment", "compliance_report_group_uuid"
    )

    # Recreate fse_compliance_reporting table
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

    # Recreate indexes
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
