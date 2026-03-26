"""Track charging equipment against charging site group/version

Revision ID: d1f6a7b8c9e0
Revises: c5d6e7f8a9b0
Create Date: 2026-03-25 14:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "d1f6a7b8c9e0"
down_revision = "c5d6e7f8a9b0"
branch_labels = None
depends_on = None

BACKUP_TABLE_NAME = "tmp_charging_equipment_site_reference_backup_d1f6a7b8c9e0"
BACKUP_TABLE_COMMENT = (
    "Temporary backup created by migration d1f6a7b8c9e0 before charging_equipment "
    "site-reference backfill and charging_site_id removal. Delete after 30 days once verified."
)


def upgrade() -> None:
    backup_table_comment_literal = BACKUP_TABLE_COMMENT.replace("'", "''")
    op.execute(
        sa.text(
            f"""
            CREATE TABLE IF NOT EXISTS {BACKUP_TABLE_NAME} AS
            SELECT
                ce.*,
                now() AS backup_created_at
            FROM charging_equipment ce
            """
        )
    )
    op.execute(
        f"COMMENT ON TABLE {BACKUP_TABLE_NAME} IS "
        f"'{backup_table_comment_literal}'"
    )

    op.create_unique_constraint(
        "uq_charging_site_group_uuid_version",
        "charging_site",
        ["group_uuid", "version"],
    )

    op.add_column(
        "charging_equipment",
        sa.Column(
            "charging_site_group_uuid",
            sa.String(length=36),
            nullable=True,
            comment="Charging site group UUID referenced by this equipment row",
        ),
    )
    op.add_column(
        "charging_equipment",
        sa.Column(
            "charging_site_version",
            sa.Integer(),
            nullable=True,
            comment="Charging site version referenced by this equipment row",
        ),
    )
    op.create_index(
        "ix_charging_equipment_charging_site_group_uuid",
        "charging_equipment",
        ["charging_site_group_uuid"],
        unique=False,
    )

    op.execute(
        """
        UPDATE charging_equipment ce
        SET
            charging_site_group_uuid = cs.group_uuid,
            charging_site_version = cs.version
        FROM charging_site cs
        WHERE ce.charging_site_id = cs.charging_site_id
        """
    )

    op.alter_column(
        "charging_equipment",
        "charging_site_group_uuid",
        existing_type=sa.String(length=36),
        nullable=False,
    )
    op.alter_column(
        "charging_equipment",
        "charging_site_version",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.create_foreign_key(
        "fk_charging_equipment_site_group_uuid_version",
        "charging_equipment",
        "charging_site",
        ["charging_site_group_uuid", "charging_site_version"],
        ["group_uuid", "version"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_charging_equipment_site_group_uuid_version",
        "charging_equipment",
        type_="foreignkey",
    )
    op.add_column(
        "charging_equipment",
        sa.Column(
            "charging_site_id",
            sa.Integer(),
            nullable=True,
            comment="Associated charging site",
        ),
    )
    op.execute(
        """
        UPDATE charging_equipment ce
        SET charging_site_id = cs.charging_site_id
        FROM charging_site cs
        WHERE ce.charging_site_group_uuid = cs.group_uuid
          AND ce.charging_site_version = cs.version
        """
    )
    op.alter_column(
        "charging_equipment",
        "charging_site_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.create_foreign_key(
        op.f("fk_charging_equipment_charging_site_id_charging_site"),
        "charging_equipment",
        "charging_site",
        ["charging_site_id"],
        ["charging_site_id"],
    )
    op.create_index(
        op.f("ix_charging_equipment_charging_site_id"),
        "charging_equipment",
        ["charging_site_id"],
        unique=False,
    )
    op.drop_index(
        "ix_charging_equipment_charging_site_group_uuid",
        table_name="charging_equipment",
    )
    op.drop_column("charging_equipment", "charging_site_version")
    op.drop_column("charging_equipment", "charging_site_group_uuid")
    op.drop_constraint(
        "uq_charging_site_group_uuid_version",
        "charging_site",
        type_="unique",
    )
    op.execute(sa.text(f"DROP TABLE IF EXISTS {BACKUP_TABLE_NAME}"))
