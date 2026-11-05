"""Mark the FSE reporting view dirty when compliance reports change (#5132).

mv_fse_reporting_base_pref holds a row for each compliance report and piece of
equipment, so a new report version has no rows until the view is refreshed.
Only the FSE source tables marked it dirty, so creating a report never
triggered a refresh. A government adjustment or supplemental showed no FSE,
and vw_fse_base, which follows the latest non-Draft version, emptied every
version of the report. The rows came back only after an unrelated FSE save.

The compliance_report trigger marks the view dirty when a report is added or
removed. It also fires if a report's organization or group changes. Marking it
dirty once here picks up the reports created since the last refresh.

Revision ID: 4dab1d106b2b
Revises: ba06f9f3360c
Create Date: 2026-11-03 10:00:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "4dab1d106b2b"
down_revision = "ba06f9f3360c"
branch_labels = None
depends_on = None

TRIGGER_NAME = "refresh_fse_reporting_mvs_after_cr"


def upgrade() -> None:
    op.execute(f"DROP TRIGGER IF EXISTS {TRIGGER_NAME} ON compliance_report;")
    op.execute(
        f"""
        CREATE TRIGGER {TRIGGER_NAME}
        AFTER INSERT OR DELETE
            OR UPDATE OF organization_id, compliance_report_group_uuid
        ON compliance_report
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_fse_reporting_base_views();
        """
    )
    op.execute(
        """
        UPDATE fse_reporting_mv_refresh_state
        SET dirty_generation = dirty_generation + 1,
            update_date = now()
        WHERE id = 1;
        """
    )


def downgrade() -> None:
    op.execute(f"DROP TRIGGER IF EXISTS {TRIGGER_NAME} ON compliance_report;")
