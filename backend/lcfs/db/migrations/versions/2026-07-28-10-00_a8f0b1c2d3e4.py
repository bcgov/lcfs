"""Add FK indexes on high-traffic tables.

Revision ID: a8f0b1c2d3e4
Revises: c9d1e2f3a4b5
Create Date: 2026-07-28 10:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "a8f0b1c2d3e4"
down_revision = "c9d1e2f3a4b5"
branch_labels = None
depends_on = None

_INDEXES = [
    # table                                         index name                                                    columns
    ("fuel_supply",                                 "ix_fuel_supply_compliance_report_id",                        ["compliance_report_id"]),
    ("fuel_supply",                                 "ix_fuel_supply_fuel_code_id",                                ["fuel_code_id"]),
    ("fuel_supply",                                 "ix_fuel_supply_fuel_type_id",                                ["fuel_type_id"]),
    ("fuel_export",                                 "ix_fuel_export_compliance_report_id",                        ["compliance_report_id"]),
    ("other_uses",                                  "ix_other_uses_compliance_report_id",                         ["compliance_report_id"]),
    ("allocation_agreement",                        "ix_allocation_agreement_compliance_report_id",               ["compliance_report_id"]),
    ("notional_transfer",                           "ix_notional_transfer_compliance_report_id",                  ["compliance_report_id"]),
    ("compliance_report",                           "ix_compliance_report_organization_id",                       ["organization_id"]),
    ("compliance_report",                           "ix_compliance_report_compliance_period_id",                  ["compliance_period_id"]),
    ("compliance_report",                           "ix_compliance_report_current_status_id",                     ["current_status_id"]),
    ("compliance_report",                           "ix_compliance_report_transaction_id",                        ["transaction_id"]),
    ("compliance_report_summary",                   "ix_compliance_report_summary_compliance_report_id",          ["compliance_report_id"]),
    ("compliance_report_organization_snapshot",     "ix_cr_organization_snapshot_compliance_report_id",           ["compliance_report_id"]),
    ("transaction",                                 "ix_transaction_organization_id",                             ["organization_id"]),
    ("transfer",                                    "ix_transfer_from_organization_id",                           ["from_organization_id"]),
    ("transfer",                                    "ix_transfer_to_organization_id",                             ["to_organization_id"]),
    ("transfer",                                    "ix_transfer_from_transaction_id",                            ["from_transaction_id"]),
    ("transfer",                                    "ix_transfer_to_transaction_id",                              ["to_transaction_id"]),
    ("transfer",                                    "ix_transfer_current_status_id",                              ["current_status_id"]),
    ("transfer_history",                            "ix_transfer_history_transfer_id",                            ["transfer_id"]),

    # mv_transaction_aggregate runs three correlated subqueries per transfer row
    ("transfer_comment",                            "ix_transfer_comment_transfer_id",                            ["transfer_id"]),
    
    # mv_transaction_aggregate correlated subquery to resolve the Approved date
    ("initiative_agreement_history",                "ix_initiative_agreement_history_ia_id",                      ["initiative_agreement_id"]),
    ("admin_adjustment_history",                    "ix_admin_adjustment_history_admin_adjustment_id",            ["admin_adjustment_id"]),
    
    # FuelCode.history_records uses lazy="selectin"
    ("fuel_code_history",                           "ix_fuel_code_history_fuel_code_id",                          ["fuel_code_id"]),
    ("notification_message",                        "ix_notification_message_related_user_profile_id",            ["related_user_profile_id"]),
]


def _index_exists(bind, name: str) -> bool:
    return (
        bind.execute(
            sa.text("SELECT 1 FROM pg_indexes WHERE indexname = :name"),
            {"name": name},
        ).fetchone()
        is not None
    )


def upgrade() -> None:
    bind = op.get_bind()
    for table, name, columns in _INDEXES:
        if not _index_exists(bind, name):
            op.create_index(name, table, columns)


def downgrade() -> None:
    bind = op.get_bind()
    for table, name, _columns in reversed(_INDEXES):
        if _index_exists(bind, name):
            op.drop_index(name, table_name=table)
