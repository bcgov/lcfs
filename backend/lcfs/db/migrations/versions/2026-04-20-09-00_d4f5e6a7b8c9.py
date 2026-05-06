"""Add compliance report schedule performance indexes

Revision ID: d4f5e6a7b8c9
Revises: c1d2e3f4a5b6
Create Date: 2026-04-20 09:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "d4f5e6a7b8c9"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_compliance_report_group_uuid_version_id
        ON compliance_report (compliance_report_group_uuid, version, compliance_report_id);
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_fuel_supply_report_group_version_action
        ON fuel_supply (compliance_report_id, group_uuid, version DESC, action_type);
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_fuel_export_report_group_version_action
        ON fuel_export (compliance_report_id, group_uuid, version DESC, action_type);
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_allocation_agreement_report_group_version_action
        ON allocation_agreement (compliance_report_id, group_uuid, version DESC, action_type);
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_notional_transfer_report_group_version_action
        ON notional_transfer (compliance_report_id, group_uuid, version DESC, action_type);
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_other_uses_report_group_version_action
        ON other_uses (compliance_report_id, group_uuid, version DESC, action_type);
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_final_supply_equipment_report_create_date
        ON final_supply_equipment (compliance_report_id, create_date);
        """
    )


def downgrade() -> None:
    op.execute(
        "DROP INDEX IF EXISTS idx_final_supply_equipment_report_create_date;"
    )
    op.execute(
        "DROP INDEX IF EXISTS idx_other_uses_report_group_version_action;"
    )
    op.execute(
        "DROP INDEX IF EXISTS idx_notional_transfer_report_group_version_action;"
    )
    op.execute(
        "DROP INDEX IF EXISTS idx_allocation_agreement_report_group_version_action;"
    )
    op.execute(
        "DROP INDEX IF EXISTS idx_fuel_export_report_group_version_action;"
    )
    op.execute(
        "DROP INDEX IF EXISTS idx_fuel_supply_report_group_version_action;"
    )
    op.execute(
        "DROP INDEX IF EXISTS idx_compliance_report_group_uuid_version_id;"
    )
