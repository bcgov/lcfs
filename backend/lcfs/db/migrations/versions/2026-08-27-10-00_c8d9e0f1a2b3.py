"""Create FSE reporting base view and preferred materialized view.

Revision ID: c8d9e0f1a2b3
Revises: a1c2d3e4f5b6
Create Date: 2026-08-27 10:00:00.000000
"""

from pathlib import Path

from alembic import op
import sqlalchemy as sa


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
OLD_BASE_MATERIALIZED_VIEW_NAME = "mv_fse_reporting_base"
NEW_BASE_VIEW_NAME = "v_fse_reporting_base"
NEW_PREF_VIEW_NAME = "mv_fse_reporting_base_pref"
FSE_SQL_SECTIONS = ("FSE Reporting Base View", "FSE Reporting Base Preferred View")
VW_FSE_BASE_NAME = "vw_fse_base"
VW_FSE_BASE_START_MARKER = f"DROP VIEW IF EXISTS {VW_FSE_BASE_NAME} CASCADE;"
VW_FSE_BASE_END_MARKER = "-- Electricity Allocation FSE Match Query"

ASSOCIATION_TABLES = (
    (
        "charging_equipment_intended_use_association",
        "end_use_type_id",
        "ix_ce_intended_use_equipment_version",
    ),
    (
        "charging_equipment_intended_user_association",
        "end_user_type_id",
        "ix_ce_intended_user_equipment_version",
    ),
)


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


def _vw_fse_base_statements() -> list[str]:
    metabase_path = Path(__file__).resolve().parents[2] / "sql/views/metabase.sql"
    content = metabase_path.read_text()
    start = content.index(VW_FSE_BASE_START_MARKER)
    end = content.index(VW_FSE_BASE_END_MARKER, start)
    section = content[start:end]
    return [stmt.strip() for stmt in section.split(";") if stmt.strip()]


def _definition_with_old_names(definition: str) -> str:
    return definition.replace(NEW_PREF_VIEW_NAME, OLD_PREF_VIEW_NAME).replace(
        NEW_BASE_VIEW_NAME, OLD_BASE_VIEW_NAME
    )


def _legacy_definition_without_association_version(definition: str) -> str:
    replacements = {
        "        ceiu.charging_equipment_version,\n": "",
        "        ceiu2.charging_equipment_version,\n": "",
        "    GROUP BY ceiu.charging_equipment_id, ceiu.charging_equipment_version": (
            "    GROUP BY ceiu.charging_equipment_id"
        ),
        "    GROUP BY ceiu2.charging_equipment_id, ceiu2.charging_equipment_version": (
            "    GROUP BY ceiu2.charging_equipment_id"
        ),
        "\n   AND ce.version = eu.charging_equipment_version": "",
        "\n       AND ce.version = eu.charging_equipment_version": "",
        "\n   AND ce.version = eus.charging_equipment_version": "",
        "\n       AND ce.version = eus.charging_equipment_version": "",
    }
    for old, new in replacements.items():
        definition = definition.replace(old, new)
    return definition


def _drop_current_fse_relations() -> None:
    for relation_name in (
        NEW_PREF_VIEW_NAME,
        OLD_PREF_VIEW_NAME,
        OLD_BASE_MATERIALIZED_VIEW_NAME,
        NEW_BASE_VIEW_NAME,
        OLD_BASE_VIEW_NAME,
        VW_FSE_BASE_NAME,
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


def _create_vw_fse_base_from_sql() -> None:
    for statement in _vw_fse_base_statements():
        if statement.upper().startswith("GRANT "):
            continue
        op.execute(statement)


def _create_legacy_views_from_sql() -> None:
    for statement in _fse_section_statements():
        statement_upper = statement.upper()
        if not (
            statement_upper.startswith("CREATE MATERIALIZED VIEW ")
            or statement_upper.startswith("CREATE OR REPLACE VIEW ")
        ):
            continue
        legacy_statement = _legacy_definition_without_association_version(
            _definition_with_old_names(statement)
        )
        if statement_upper.startswith("CREATE MATERIALIZED VIEW "):
            legacy_statement = legacy_statement.replace(
                "CREATE MATERIALIZED VIEW", "CREATE VIEW", 1
            )
        op.execute(legacy_statement)


def _drop_primary_key(table_name: str) -> None:
    op.execute(
        f"""
        DO $$
        DECLARE
            pk_name text;
        BEGIN
            SELECT conname
            INTO pk_name
            FROM pg_constraint
            WHERE conrelid = '{table_name}'::regclass
              AND contype = 'p';

            IF pk_name IS NOT NULL THEN
                EXECUTE format(
                    'ALTER TABLE %I DROP CONSTRAINT %I',
                    '{table_name}',
                    pk_name
                );
            END IF;
        END $$;
        """
    )


def _add_version_to_association(
    table_name: str, type_column: str, index_name: str
) -> None:
    op.add_column(
        table_name,
        sa.Column(
            "charging_equipment_version",
            sa.Integer(),
            nullable=True,
            comment="Version of the referenced charging equipment",
        ),
    )

    staged_table_name = f"{table_name}_version_backfill"
    op.execute(
        f"""
        CREATE TEMPORARY TABLE {staged_table_name} ON COMMIT DROP AS
        SELECT DISTINCT
            versioned_equipment.charging_equipment_id,
            versioned_equipment.version AS charging_equipment_version,
            association.{type_column}
        FROM {table_name} association
        JOIN charging_equipment source_equipment
            ON source_equipment.charging_equipment_id = association.charging_equipment_id
        JOIN charging_equipment versioned_equipment
            ON versioned_equipment.group_uuid = source_equipment.group_uuid
        """
    )

    op.execute(f"DELETE FROM {table_name}")

    op.execute(
        f"""
        INSERT INTO {table_name} (
            charging_equipment_id,
            charging_equipment_version,
            {type_column}
        )
        SELECT
            charging_equipment_id,
            charging_equipment_version,
            {type_column}
        FROM {staged_table_name}
        """
    )

    op.alter_column(
        table_name,
        "charging_equipment_version",
        existing_type=sa.Integer(),
        nullable=False,
    )

    _drop_primary_key(table_name)
    op.create_primary_key(
        op.f(f"pk_{table_name}"),
        table_name,
        ["charging_equipment_id", "charging_equipment_version", type_column],
    )
    op.create_index(
        index_name,
        table_name,
        ["charging_equipment_id", "charging_equipment_version"],
    )


def _add_association_versions() -> None:
    for table_name, type_column, index_name in ASSOCIATION_TABLES:
        _add_version_to_association(table_name, type_column, index_name)


def _drop_association_versions() -> None:
    for table_name, type_column, index_name in reversed(ASSOCIATION_TABLES):
        op.drop_index(index_name, table_name=table_name)
        _drop_primary_key(table_name)
        op.create_primary_key(
            op.f(f"pk_{table_name}"),
            table_name,
            ["charging_equipment_id", type_column],
        )
        op.drop_column(table_name, "charging_equipment_version")


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


def _create_refresh_state_table() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS fse_reporting_mv_refresh_state (
            id integer PRIMARY KEY DEFAULT 1,
            dirty_generation bigint NOT NULL DEFAULT 0,
            refreshed_generation bigint NOT NULL DEFAULT 0,
            create_date timestamp with time zone NOT NULL DEFAULT now(),
            update_date timestamp with time zone NOT NULL DEFAULT now(),
            CONSTRAINT ck_fse_reporting_mv_refresh_state_singleton CHECK (id = 1)
        );
        """
    )
    op.execute(
        """
        INSERT INTO fse_reporting_mv_refresh_state (
            id,
            dirty_generation,
            refreshed_generation
        )
        VALUES (1, 0, 0)
        ON CONFLICT (id) DO NOTHING;
        """
    )


def _create_refresh_function() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION refresh_fse_reporting_base_views()
        RETURNS TRIGGER AS $$
        BEGIN
            INSERT INTO fse_reporting_mv_refresh_state (
                id,
                dirty_generation,
                refreshed_generation,
                update_date
            )
            VALUES (1, 1, 0, now())
            ON CONFLICT (id) DO UPDATE
                SET dirty_generation =
                        fse_reporting_mv_refresh_state.dirty_generation + 1,
                    update_date = now();
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
    _create_refresh_state_table()
    _drop_current_fse_relations()
    _add_association_versions()
    _create_current_materialized_views_from_sql()
    _create_vw_fse_base_from_sql()
    op.execute(
        """
        UPDATE fse_reporting_mv_refresh_state
        SET refreshed_generation = dirty_generation,
            update_date = now()
        WHERE id = 1;
        """
    )
    _grant_select_if_role_exists(NEW_PREF_VIEW_NAME)
    _grant_select_if_role_exists(VW_FSE_BASE_NAME)
    _create_refresh_function()
    _create_refresh_triggers()


def downgrade() -> None:
    _drop_refresh_triggers()
    op.execute("DROP FUNCTION IF EXISTS refresh_fse_reporting_base_views();")
    _drop_current_fse_relations()
    op.execute("DROP INDEX IF EXISTS ix_charging_site_group_uuid_version_id;")
    op.execute("DROP TABLE IF EXISTS fse_reporting_mv_refresh_state;")
    _drop_association_versions()
    _create_legacy_views_from_sql()
    _grant_select_if_role_exists(OLD_PREF_VIEW_NAME)
