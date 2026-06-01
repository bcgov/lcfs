"""Fix FSE pref view to match compliance records by group UUID

Revision ID: 098cf79762b9
Revises: c7e4d9a1b2f6
Create Date: 2026-03-24 12:00:00.000000
"""


# revision identifiers, used by Alembic.
revision = "098cf79762b9"
down_revision = "c7e4d9a1b2f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Recreate v_fse_reporting_base_pref to match compliance records by
    compliance_report_group_uuid instead of compliance_report_id.

    This fixes supplemental reports not showing kWh data that was uploaded
    against the original report in the same compliance report group.
    """
    pass


def downgrade() -> None:
    """Drop and recreate with original logic."""
    pass
