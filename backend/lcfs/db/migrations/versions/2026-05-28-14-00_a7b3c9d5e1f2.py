"""Add submission hot-path indexes on schedule tables.

Compliance report submission re-fetches every versioned schedule
(fuel_supply, fuel_export, other_uses, notional_transfer,
allocation_agreement) by ``compliance_report_id`` and walks the
group history via ``group_uuid``. Postgres does not auto-index FKs,
and only ``allocation_agreement.group_uuid`` was indexed prior to
this migration, so each lookup was a sequential scan over the
table.

We also index ``compliance_report.compliance_report_group_uuid`` —
that column is the join key used to assemble a report's version
chain on every submit, status change, and report fetch.

All statements use ``IF NOT EXISTS`` so the migration is safe to
re-run, and any ad-hoc indexes added out-of-band won't collide.

Revision ID: a7b3c9d5e1f2
Revises: c2a4f6b8d9e1
Create Date: 2026-05-28 14:00:00.000000

"""

from alembic import op


revision = "a7b3c9d5e1f2"
down_revision = "c2a4f6b8d9e1"
branch_labels = None
depends_on = None


# (index_name, table_name, column_name)
INDEXES = [
    # Schedule tables — compliance_report_id is the per-version FK
    ("ix_fuel_supply_compliance_report_id", "fuel_supply", "compliance_report_id"),
    ("ix_fuel_export_compliance_report_id", "fuel_export", "compliance_report_id"),
    ("ix_other_uses_compliance_report_id", "other_uses", "compliance_report_id"),
    (
        "ix_notional_transfer_compliance_report_id",
        "notional_transfer",
        "compliance_report_id",
    ),
    (
        "ix_allocation_agreement_compliance_report_id",
        "allocation_agreement",
        "compliance_report_id",
    ),
    # Schedule tables — group_uuid is used to walk the version chain
    # (allocation_agreement.group_uuid was already indexed in 173179aeed95)
    ("ix_fuel_supply_group_uuid", "fuel_supply", "group_uuid"),
    ("ix_fuel_export_group_uuid", "fuel_export", "group_uuid"),
    ("ix_other_uses_group_uuid", "other_uses", "group_uuid"),
    ("ix_notional_transfer_group_uuid", "notional_transfer", "group_uuid"),
    # Compliance report itself + its 1:1 / 1:N children keyed on report id
    (
        "ix_compliance_report_compliance_report_group_uuid",
        "compliance_report",
        "compliance_report_group_uuid",
    ),
    (
        "ix_compliance_report_history_compliance_report_id",
        "compliance_report_history",
        "compliance_report_id",
    ),
    (
        "ix_compliance_report_summary_compliance_report_id",
        "compliance_report_summary",
        "compliance_report_id",
    ),
]


def upgrade() -> None:
    for index_name, table_name, column_name in INDEXES:
        op.execute(
            f'CREATE INDEX IF NOT EXISTS "{index_name}" '
            f'ON "{table_name}" ("{column_name}")'
        )


def downgrade() -> None:
    for index_name, _table_name, _column_name in reversed(INDEXES):
        op.execute(f'DROP INDEX IF EXISTS "{index_name}"')
