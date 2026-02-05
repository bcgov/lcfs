"""Deduplicate charging equipment per report group/serial combination

Revision ID: 3d7b65a9d2ef
Revises: a1b2c3d4e5f1
Create Date: 2026-02-01 09:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
import logging

# revision identifiers, used by Alembic.
revision = "3d7b65a9d2ef"
down_revision = "a1b2c3d4e5f1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Remove duplicate charging equipment rows that share the same serial number
    within compliance report groups that have multiple report versions.
    Priority for retention is Validated > Submitted > Draft to ensure that the
    most mature equipment record survives per serial number.
    """
    conn = op.get_bind()
    logger = logging.getLogger("alembic.runtime.migration")

    conn.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS charging_equipment_snapshot_3d7b65a9d2ef
            (LIKE charging_equipment INCLUDING ALL);
            """
        )
    )
    conn.execute(sa.text("TRUNCATE TABLE charging_equipment_snapshot_3d7b65a9d2ef;"))
    conn.execute(
        sa.text(
            """
            INSERT INTO charging_equipment_snapshot_3d7b65a9d2ef
            SELECT * FROM charging_equipment;
            """
        )
    )

    dedup_cte = """
        WITH multi_report_groups AS (
            SELECT compliance_report_group_uuid
            FROM compliance_report
            GROUP BY compliance_report_group_uuid
            HAVING COUNT(DISTINCT compliance_report_id) > 1
        ),
        equipment_candidates AS (
            SELECT DISTINCT
                mrg.compliance_report_group_uuid,
                ce.charging_equipment_id,
                UPPER(TRIM(ce.serial_number)) AS normalized_serial,
                ces.status AS equipment_status
            FROM multi_report_groups mrg
            JOIN compliance_report cr
                ON cr.compliance_report_group_uuid = mrg.compliance_report_group_uuid
            JOIN compliance_report_charging_equipment crce
                ON crce.compliance_report_id = cr.compliance_report_id
            JOIN charging_equipment ce
                ON ce.charging_equipment_id = crce.charging_equipment_id
            JOIN charging_equipment_status ces
                ON ces.charging_equipment_status_id = ce.status_id
            WHERE ce.action_type != 'DELETE'
        ),
        ranked_equipment AS (
            SELECT
                compliance_report_group_uuid,
                charging_equipment_id,
                normalized_serial,
                equipment_status,
                ROW_NUMBER() OVER (
                    PARTITION BY compliance_report_group_uuid, normalized_serial
                    ORDER BY
                        CASE equipment_status
                            WHEN 'Validated' THEN 1
                            WHEN 'Submitted' THEN 2
                            WHEN 'Draft' THEN 3
                            ELSE 4
                        END,
                        charging_equipment_id
                ) AS retention_rank
            FROM equipment_candidates
            WHERE normalized_serial IS NOT NULL
                  AND normalized_serial <> ''
        ),
        duplicates AS (
            SELECT
                compliance_report_group_uuid,
                charging_equipment_id
            FROM ranked_equipment
            WHERE retention_rank > 1
        )
    """

    log_rows = conn.execute(
        sa.text(
            dedup_cte
            + """
        SELECT
            crce.compliance_report_id,
            COUNT(DISTINCT duplicates.charging_equipment_id) AS deleted_equipment_count
        FROM duplicates
        JOIN compliance_report_charging_equipment crce
            ON crce.charging_equipment_id = duplicates.charging_equipment_id
        GROUP BY crce.compliance_report_id
        ORDER BY crce.compliance_report_id
        """
        )
    ).fetchall()

    if log_rows:
        for row in log_rows:
            logger.info(
                "Deleting %s charging equipment rows linked to compliance_report_id=%s",
                row.deleted_equipment_count,
                row.compliance_report_id,
            )
    else:
        logger.info("No duplicate charging equipment rows detected for deletion.")

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
    Restore rows removed by this migration using the snapshot table while
    preserving any new or updated records created after the upgrade.
    """
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = 'charging_equipment_snapshot_3d7b65a9d2ef'
            ) THEN
                INSERT INTO charging_equipment
                SELECT * FROM charging_equipment_snapshot_3d7b65a9d2ef
                ON CONFLICT (charging_equipment_id) DO NOTHING;
            END IF;
        END;
        $$;
        """
    )