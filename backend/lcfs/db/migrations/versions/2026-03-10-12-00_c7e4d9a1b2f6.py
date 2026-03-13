"""Deduplicate charging equipment rows per group/version

Revision ID: c7e4d9a1b2f6
Revises: f5a8c3d7e2b4
Create Date: 2026-03-10 12:00:00.000000
"""

import logging

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "c7e4d9a1b2f6"
down_revision = "f5a8c3d7e2b4"
branch_labels = None
depends_on = None


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
