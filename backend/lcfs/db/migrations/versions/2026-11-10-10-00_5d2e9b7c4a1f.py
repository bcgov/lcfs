"""Constrain compliance report snapshots and schedule rows.

- One organization snapshot per compliance report. Duplicates are collapsed
  first, keeping the edited copy, then the most recently updated one.
- One row per (group_uuid, version) in each compliance report schedule. A
  duplicate there is real compliance data, so this migration stops instead of
  choosing which row to delete; resolve duplicates with a data patch first.
- Schedule quantities cannot be negative. The check is added NOT VALID and
  validated when existing rows allow it, so new writes are always checked.

Revision ID: 5d2e9b7c4a1f
Revises: a6f1c2d3e4b5
Create Date: 2026-11-10 10:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "5d2e9b7c4a1f"
down_revision = "a6f1c2d3e4b5"
branch_labels = None
depends_on = None


SNAPSHOT_TABLE = "compliance_report_organization_snapshot"
SNAPSHOT_UNIQUE = "uq_compliance_report_organization_snapshot_report"

# table -> quantity columns that cannot be negative
SCHEDULE_QUANTITIES = {
    "fuel_supply": [
        "quantity",
        "q1_quantity",
        "q2_quantity",
        "q3_quantity",
        "q4_quantity",
    ],
    "fuel_export": ["quantity"],
    "other_uses": ["quantity_supplied"],
    "notional_transfer": [
        "quantity",
        "q1_quantity",
        "q2_quantity",
        "q3_quantity",
        "q4_quantity",
    ],
    "allocation_agreement": [
        "quantity",
        "q1_quantity",
        "q2_quantity",
        "q3_quantity",
        "q4_quantity",
    ],
}


def _version_unique(table: str) -> str:
    return f"uq_{table}_group_uuid_version"


def _quantity_check(table: str) -> str:
    return f"ck_{table}_quantities_non_negative"


def _duplicate_versions(connection, table: str) -> int:
    return connection.execute(sa.text(f"""
            SELECT count(*) FROM (
                SELECT 1 FROM {table}
                GROUP BY group_uuid, version
                HAVING count(*) > 1
            ) duplicates
            """)).scalar_one()


def upgrade() -> None:
    connection = op.get_bind()

    duplicated = {
        table: count
        for table in SCHEDULE_QUANTITIES
        if (count := _duplicate_versions(connection, table))
    }
    if duplicated:
        summary = ", ".join(
            f"{table} ({count} group/version pairs)"
            for table, count in duplicated.items()
        )
        raise RuntimeError(
            "Cannot add the (group_uuid, version) unique constraints while "
            f"duplicate schedule versions exist: {summary}. Decide which row "
            "of each pair is correct, remove the other with a data patch and "
            "rerun."
        )

    # Keep one snapshot per report: the edited one, then the newest.
    connection.execute(sa.text(f"""
            DELETE FROM {SNAPSHOT_TABLE}
            WHERE organization_snapshot_id IN (
                SELECT organization_snapshot_id FROM (
                    SELECT
                        organization_snapshot_id,
                        row_number() OVER (
                            PARTITION BY compliance_report_id
                            ORDER BY
                                is_edited DESC,
                                coalesce(update_date, create_date) DESC NULLS LAST,
                                organization_snapshot_id DESC
                        ) AS keep_rank
                    FROM {SNAPSHOT_TABLE}
                    WHERE compliance_report_id IS NOT NULL
                ) ranked
                WHERE keep_rank > 1
            )
            """))
    op.create_unique_constraint(
        SNAPSHOT_UNIQUE, SNAPSHOT_TABLE, ["compliance_report_id"]
    )

    for table, columns in SCHEDULE_QUANTITIES.items():
        op.create_unique_constraint(
            _version_unique(table), table, ["group_uuid", "version"]
        )

        condition = " AND ".join(f"{column} >= 0" for column in columns)
        constraint = _quantity_check(table)
        op.execute(
            f"ALTER TABLE {table} ADD CONSTRAINT {constraint} "
            f"CHECK ({condition}) NOT VALID"
        )
        negative_rows = connection.execute(
            sa.text(f"SELECT count(*) FROM {table} WHERE NOT ({condition})")
        ).scalar_one()
        if negative_rows == 0:
            op.execute(f"ALTER TABLE {table} VALIDATE CONSTRAINT {constraint}")


def downgrade() -> None:
    for table in reversed(list(SCHEDULE_QUANTITIES)):
        # op.f: the name is final; the metadata convention would prefix it again.
        op.drop_constraint(op.f(_quantity_check(table)), table, type_="check")
        op.drop_constraint(_version_unique(table), table, type_="unique")
    op.drop_constraint(SNAPSHOT_UNIQUE, SNAPSHOT_TABLE, type_="unique")
