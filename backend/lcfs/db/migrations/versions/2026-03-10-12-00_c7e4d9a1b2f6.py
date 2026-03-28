"""Deduplicate charging equipment rows per group/version

Revision ID: c7e4d9a1b2f6
Revises: a2b3c4d5e6f7
Create Date: 2026-03-10 12:00:00.000000
"""

import logging

import sqlalchemy as sa
from alembic import op
from lcfs.db.dependencies import (
    create_role_if_not_exists,
    execute_sql_sections,
    find_and_read_sql_file,
    parse_sql_sections,
)

# revision identifiers, used by Alembic.
revision = "c7e4d9a1b2f6"
down_revision = "a2b3c4d5e6f7"
branch_labels = None
depends_on = None

SECTIONS_TO_EXECUTE = [
    "FSE Reporting Base View",
    "FSE Reporting Base Preferred View",
]


def upgrade() -> None:
    """
    Remove duplicate charging_equipment rows that share the same group_uuid and
    version for versioned records above v1. The most recent physical row is
    retained based on update_date/create_date, with charging_equipment_id as a
    deterministic tie-breaker.
    """
    conn = op.get_bind()
    logger = logging.getLogger("alembic.runtime.migration")

    # Snapshot tables are temporary rollback aids and should be dropped manually
    # after 30 days once the migration has been validated in all environments.
    conn.execute(
        sa.text("DROP TABLE IF EXISTS charging_equipment_snapshot_3d7b65a9d2ef;")
    )
    conn.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS charging_equipment_snapshot_c7e4d9a1b2f6
            (LIKE charging_equipment INCLUDING ALL);
            """
        )
    )
    conn.execute(
        sa.text(
            """
            COMMENT ON TABLE charging_equipment_snapshot_c7e4d9a1b2f6 IS
            'Temporary rollback snapshot for migration c7e4d9a1b2f6. Drop after 30 days.';
            """
        )
    )
    conn.execute(
        sa.text("TRUNCATE TABLE charging_equipment_snapshot_c7e4d9a1b2f6;")
    )
    conn.execute(
        sa.text(
            """
            INSERT INTO charging_equipment_snapshot_c7e4d9a1b2f6
            SELECT * FROM charging_equipment;
            """
        )
    )

    dedup_cte = """
        WITH ranked_duplicates AS (
            SELECT
                charging_equipment_id,
                group_uuid,
                version,
                ROW_NUMBER() OVER (
                    PARTITION BY group_uuid, version
                    ORDER BY
                        COALESCE(update_date, create_date) DESC NULLS LAST,
                        charging_equipment_id DESC
                ) AS retention_rank
            FROM charging_equipment
            WHERE group_uuid IS NOT NULL
              AND version > 1
        ),
        duplicates AS (
            SELECT charging_equipment_id, group_uuid, version
            FROM ranked_duplicates
            WHERE retention_rank > 1
        )
    """

    log_rows = conn.execute(
        sa.text(
            dedup_cte
            + """
        SELECT
            group_uuid,
            version,
            COUNT(*) AS deleted_row_count
        FROM duplicates
        GROUP BY group_uuid, version
        ORDER BY group_uuid, version;
        """
        )
    ).fetchall()

    if log_rows:
        for row in log_rows:
            logger.info(
                "Deleting %s duplicate charging_equipment rows for group_uuid=%s version=%s",
                row.deleted_row_count,
                row.group_uuid,
                row.version,
            )
    else:
        logger.info(
            "No duplicate charging_equipment rows detected for identical group_uuid/version pairs."
        )

    deactivated_rows = conn.execute(
        sa.text(
            """
        WITH ranked_report_equipment AS (
            SELECT
                crce.charging_equipment_compliance_id,
                crce.compliance_report_id,
                ce.group_uuid,
                ce.version,
                ROW_NUMBER() OVER (
                    PARTITION BY crce.compliance_report_id, ce.group_uuid
                    ORDER BY
                        ce.version DESC,
                        crce.charging_equipment_version DESC,
                        crce.charging_equipment_compliance_id DESC
                ) AS version_rank
            FROM compliance_report_charging_equipment crce
            JOIN charging_equipment ce
                ON ce.charging_equipment_id = crce.charging_equipment_id
            WHERE ce.group_uuid IS NOT NULL
        )
        UPDATE compliance_report_charging_equipment crce
        SET is_active = FALSE
        FROM ranked_report_equipment rre
        WHERE crce.charging_equipment_compliance_id = rre.charging_equipment_compliance_id
          AND rre.version_rank > 1
          AND crce.is_active IS DISTINCT FROM FALSE
        RETURNING crce.compliance_report_id, rre.group_uuid, rre.version;
        """
        )
    ).fetchall()

    if deactivated_rows:
        for row in deactivated_rows:
            logger.info(
                "Set is_active=false for older compliance_report_charging_equipment row on compliance_report_id=%s group_uuid=%s version=%s",
                row.compliance_report_id,
                row.group_uuid,
                row.version,
            )

    conn.execute(
        sa.text(
            dedup_cte
            + """
        DELETE FROM compliance_report_charging_equipment crce
        USING duplicates d
        WHERE crce.charging_equipment_id = d.charging_equipment_id;
        """
        )
    )

    conn.execute(
        sa.text(
            dedup_cte
            + """
        DELETE FROM charging_equipment ce
        USING duplicates d
        WHERE ce.charging_equipment_id = d.charging_equipment_id;
        """
        )
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_charging_equipment_group_uuid_version_id
        ON charging_equipment (group_uuid, version DESC, charging_equipment_id DESC);
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_charging_site_group_uuid_org_version
        ON charging_site (group_uuid, organization_id, version DESC);
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_crce_org_report_active_equipment_version
        ON compliance_report_charging_equipment (
            organization_id,
            compliance_report_id,
            is_active,
            charging_equipment_id,
            charging_equipment_version
        );
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_cpo_level_user_use_lookup
        ON charging_power_output (
            level_of_equipment_id,
            end_user_type_id,
            end_use_type_id
        );
        """
    )

    create_role_if_not_exists()
    content = find_and_read_sql_file(sqlFile="metabase.sql")
    sections = parse_sql_sections(content)
    execute_sql_sections(sections, SECTIONS_TO_EXECUTE)


def downgrade() -> None:
    """
    Restore rows removed by this migration from the snapshot table while leaving
    any newer rows intact.
    """
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = 'charging_equipment_snapshot_c7e4d9a1b2f6'
            ) THEN
                INSERT INTO charging_equipment
                SELECT * FROM charging_equipment_snapshot_c7e4d9a1b2f6
                ON CONFLICT (charging_equipment_id) DO NOTHING;
            END IF;
        END;
        $$;
        """
    )
    op.execute("DROP VIEW IF EXISTS v_fse_reporting_base_pref;")
    op.execute("DROP VIEW IF EXISTS v_fse_reporting_base;")
    op.execute("DROP INDEX IF EXISTS idx_cpo_level_user_use_lookup;")
    op.execute("DROP INDEX IF EXISTS idx_crce_org_report_active_equipment_version;")
    op.execute("DROP INDEX IF EXISTS idx_charging_site_group_uuid_org_version;")
    op.execute("DROP INDEX IF EXISTS idx_charging_equipment_group_uuid_version_id;")
