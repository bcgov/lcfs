"""Fix FSE pref view to match compliance records by group UUID

Revision ID: 098cf79762b9
Revises: c7e4d9a1b2f6
Create Date: 2026-03-24 12:00:00.000000
"""


from alembic import op

from lcfs.db.dependencies import (
    create_role_if_not_exists,
    execute_sql_sections,
    find_and_read_sql_file,
    parse_sql_sections,
)

# revision identifiers, used by Alembic.
revision = "098cf79762b9"
down_revision = "c7e4d9a1b2f6"
branch_labels = None
depends_on = None

FSE_MATERIALIZED_VIEW_SECTIONS = [
    "FSE Reporting Base View",
    "FSE Reporting Base Preferred View",
    "FSE Base View YoY Optimised",
]

FSE_REFRESH_TRIGGER_TABLES = {
    "compliance_report": "refresh_fse_mv_after_cr",
    "compliance_report_status": "refresh_fse_mv_after_crs",
    "compliance_report_charging_equipment": "refresh_fse_mv_after_crce",
    "charging_equipment": "refresh_fse_mv_after_ce",
    "charging_site": "refresh_fse_mv_after_cs",
    "level_of_equipment": "refresh_fse_mv_after_loe",
    "charging_equipment_status": "refresh_fse_mv_after_ces",
    "charging_equipment_intended_use_association": "refresh_fse_mv_after_ceiu",
    "charging_equipment_intended_user_association": "refresh_fse_mv_after_ceiur",
    "end_use_type": "refresh_fse_mv_after_eut",
    "end_user_type": "refresh_fse_mv_after_eurt",
    "charging_power_output": "refresh_fse_mv_after_cpo",
    "organization": "refresh_fse_mv_after_org",
    "compliance_period": "refresh_fse_mv_after_cp",
}


def _drop_relation(name: str) -> None:
    op.execute(
        f"""
        DO $$
        BEGIN
            IF to_regclass('public.{name}') IS NOT NULL THEN
                IF (
                    SELECT relkind
                    FROM pg_class
                    WHERE oid = 'public.{name}'::regclass
                ) = 'm' THEN
                    DROP MATERIALIZED VIEW public.{name} CASCADE;
                ELSE
                    DROP VIEW public.{name} CASCADE;
                END IF;
            END IF;
        END $$;
        """
    )


def _drop_refresh_triggers() -> None:
    for table_name, trigger_name in FSE_REFRESH_TRIGGER_TABLES.items():
        op.execute(f"DROP TRIGGER IF EXISTS {trigger_name} ON {table_name};")


def _create_refresh_triggers() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION refresh_fse_materialized_views()
        RETURNS TRIGGER AS $$
        BEGIN
            IF to_regclass('public.v_fse_reporting_base_pref') IS NOT NULL THEN
                REFRESH MATERIALIZED VIEW v_fse_reporting_base_pref;
            END IF;

            IF to_regclass('public.vw_fse_base') IS NOT NULL THEN
                REFRESH MATERIALIZED VIEW vw_fse_base;
            END IF;

            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    for table_name, trigger_name in FSE_REFRESH_TRIGGER_TABLES.items():
        op.execute(
            f"""
            CREATE TRIGGER {trigger_name}
            AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON {table_name}
            FOR EACH STATEMENT
            EXECUTE FUNCTION refresh_fse_materialized_views();
            """
        )


def upgrade() -> None:
    """
    Recreate FSE reporting objects as materialized views.

    This fixes supplemental reports not showing kWh data that was uploaded
    against the original report in the same compliance report group, and keeps
    assessed historical report rows visible even when later equipment
    validation changes the current/latest FSE row used by the editing view.
    """
    create_role_if_not_exists()
    _drop_refresh_triggers()
    _drop_relation("vw_fse_base")
    _drop_relation("v_fse_reporting_base_pref")
    content = find_and_read_sql_file(sqlFile="metabase.sql")
    sections = parse_sql_sections(content)
    execute_sql_sections(sections, FSE_MATERIALIZED_VIEW_SECTIONS)
    _create_refresh_triggers()


def downgrade() -> None:
    """Remove FSE materialized views and refresh automation."""
    _drop_refresh_triggers()
    op.execute("DROP FUNCTION IF EXISTS refresh_fse_materialized_views();")
    _drop_relation("vw_fse_base")
    _drop_relation("v_fse_reporting_base_pref")
