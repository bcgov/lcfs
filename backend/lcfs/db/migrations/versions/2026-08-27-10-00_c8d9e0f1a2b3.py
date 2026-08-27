"""Convert FSE reporting base views to materialized views.

Revision ID: c8d9e0f1a2b3
Revises: a1c2d3e4f5b6
Create Date: 2026-08-27 10:00:00.000000
"""

from alembic import op
from pathlib import Path


revision = "c8d9e0f1a2b3"
down_revision = "a1c2d3e4f5b6"
branch_labels = None
depends_on = None


FSE_REFRESH_TRIGGERS = [
    ("charging_equipment", "refresh_fse_reporting_mvs_after_ce"),
    (
        "charging_equipment_intended_use_association",
        "refresh_fse_reporting_mvs_after_ceiu",
    ),
    (
        "charging_equipment_intended_user_association",
        "refresh_fse_reporting_mvs_after_ceuser",
    ),
    ("charging_site", "refresh_fse_reporting_mvs_after_cs"),
    ("compliance_report_charging_equipment", "refresh_fse_reporting_mvs_after_crce"),
]

OLD_BASE_VIEW_NAME = "v_fse_reporting_base"
OLD_PREF_VIEW_NAME = "v_fse_reporting_base_pref"
NEW_BASE_VIEW_NAME = "mv_fse_reporting_base"
NEW_PREF_VIEW_NAME = "mv_fse_reporting_base_pref"
FSE_SQL_SECTIONS = ("FSE Reporting Base View", "FSE Reporting Base Preferred View")


def _parse_sql_sections(content: str) -> dict[str, str]:
    sections = {}
    current_section = None
    current_sql = []

    lines = content.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if (
            line.startswith("--")
            and "=" in line
            and len(line) > 20
            and i + 1 < len(lines)
        ):
            next_line = lines[i + 1].strip()
            if (
                next_line.startswith("--")
                and "=" not in next_line
                and next_line.replace("--", "").strip()
            ):
                if current_section and current_sql:
                    sql_content = "\n".join(current_sql).strip()
                    if sql_content:
                        sections[current_section] = sql_content
                current_section = next_line.replace("--", "").strip()
                current_sql = []
                i += 2
                continue
        elif current_section:
            current_sql.append(lines[i])
        i += 1

    if current_section and current_sql:
        sql_content = "\n".join(current_sql).strip()
        if sql_content:
            sections[current_section] = sql_content

    return sections


def _fse_section_statements() -> list[str]:
    metabase_path = Path(__file__).resolve().parents[2] / "sql/views/metabase.sql"
    sections = _parse_sql_sections(metabase_path.read_text())
    statements = []
    for section_name in FSE_SQL_SECTIONS:
        section_sql = sections[section_name]
        statements.extend(
            stmt.strip() for stmt in section_sql.split(";") if stmt.strip()
        )
    return statements


def _definition_with_old_names(definition: str) -> str:
    return definition.replace(NEW_PREF_VIEW_NAME, OLD_PREF_VIEW_NAME).replace(
        NEW_BASE_VIEW_NAME, OLD_BASE_VIEW_NAME
    )


def _drop_current_fse_relations() -> None:
    for relation_name in (
        NEW_PREF_VIEW_NAME,
        OLD_PREF_VIEW_NAME,
        NEW_BASE_VIEW_NAME,
        OLD_BASE_VIEW_NAME,
    ):
        op.execute(
            f"""
            DO $$
            DECLARE
                relation_kind "char";
            BEGIN
                SELECT c.relkind
                INTO relation_kind
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relname = '{relation_name}'
                  AND n.nspname = current_schema();

                IF relation_kind = 'm' THEN
                    EXECUTE 'DROP MATERIALIZED VIEW IF EXISTS {relation_name} CASCADE';
                ELSIF relation_kind = 'v' THEN
                    EXECUTE 'DROP VIEW IF EXISTS {relation_name} CASCADE';
                END IF;
            END $$;
            """
        )


def _create_current_materialized_views_from_sql() -> None:
    for statement in _fse_section_statements():
        if statement.upper().startswith("GRANT "):
            continue
        op.execute(statement)


def _create_legacy_views_from_sql() -> None:
    for statement in _fse_section_statements():
        if not statement.upper().startswith("CREATE MATERIALIZED VIEW "):
            continue
        legacy_statement = _definition_with_old_names(statement).replace(
            "CREATE MATERIALIZED VIEW", "CREATE VIEW", 1
        )
        op.execute(legacy_statement)


def _create_source_indexes() -> None:
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_charging_site_group_uuid_version_id
            ON charging_site (
                group_uuid,
                version DESC,
                charging_site_id DESC
            );
        """
    )


def _create_refresh_function() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION refresh_fse_reporting_base_views()
        RETURNS TRIGGER AS $$
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fse_reporting_base;
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fse_reporting_base_pref;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        """
    )


def _grant_select_if_role_exists(relation_name: str) -> None:
    op.execute(
        f"""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_roles WHERE rolname = 'basic_lcfs_reporting_role'
            ) THEN
                GRANT SELECT
                    ON {relation_name}
                    TO basic_lcfs_reporting_role;
            END IF;
        END $$;
        """
    )


def _create_refresh_triggers() -> None:
    for table_name, trigger_name in FSE_REFRESH_TRIGGERS:
        op.execute(f"DROP TRIGGER IF EXISTS {trigger_name} ON {table_name};")
        op.execute(
            f"""
            CREATE TRIGGER {trigger_name}
            AFTER INSERT OR UPDATE ON {table_name}
            FOR EACH STATEMENT
            EXECUTE FUNCTION refresh_fse_reporting_base_views();
            """
        )


def _drop_refresh_triggers() -> None:
    for table_name, trigger_name in FSE_REFRESH_TRIGGERS:
        op.execute(f"DROP TRIGGER IF EXISTS {trigger_name} ON {table_name};")


def upgrade() -> None:
    _create_source_indexes()
    _drop_current_fse_relations()
    _create_current_materialized_views_from_sql()
    _grant_select_if_role_exists(NEW_PREF_VIEW_NAME)
    _create_refresh_function()
    _create_refresh_triggers()


def downgrade() -> None:
    _drop_refresh_triggers()
    op.execute("DROP FUNCTION IF EXISTS refresh_fse_reporting_base_views();")
    _drop_current_fse_relations()
    op.execute("DROP INDEX IF EXISTS ix_charging_site_group_uuid_version_id;")
    _create_legacy_views_from_sql()
    _grant_select_if_role_exists(OLD_PREF_VIEW_NAME)
