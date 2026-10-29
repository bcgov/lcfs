"""Make compliance report history append-only and restore overwritten entries.

add_compliance_report_history used to keep one row per (report, status): when a
report re-entered a status, the existing row was updated in place with the new
user and date. A report returned to the analyst and recommended again (for
example by the Director acting as analyst and manager) lost its original
analyst and manager entries (#5172).

The unique constraint that enforced one row per status is dropped, and every
entry the old code overwrote is re-inserted from audit_log, where the audit
trigger kept the full pre-update row. Restored rows keep their original date,
user and display name; update_user and update_date record the restore.

Revision ID: 749bbce07dda
Revises: 5148a6b7c9d0
Create Date: 2026-10-09 10:00:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "749bbce07dda"
down_revision = "5148a6b7c9d0"
branch_labels = None
depends_on = None

RESTORE_USER = "migration_5172_restore_report_history"


def upgrade() -> None:
    op.drop_constraint(
        "uq_compliance_report_id_status_id",
        "compliance_report_history",
        type_="unique",
    )

    # Only the upsert ever updated history rows, and it always moved
    # create_date while keeping the status, so those audit rows are exactly
    # the overwrites. NOT EXISTS keeps the restore idempotent.
    op.execute(
        f"""
        INSERT INTO compliance_report_history (
            compliance_report_id,
            status_id,
            user_profile_id,
            display_name,
            create_date,
            create_user,
            update_user
        )
        SELECT DISTINCT
            (al.old_values->>'compliance_report_id')::int,
            (al.old_values->>'status_id')::int,
            up.user_profile_id,
            al.old_values->>'display_name',
            (al.old_values->>'create_date')::timestamptz,
            al.old_values->>'create_user',
            '{RESTORE_USER}'
        FROM audit_log al
        JOIN compliance_report cr
          ON cr.compliance_report_id = (al.old_values->>'compliance_report_id')::int
        LEFT JOIN user_profile up
          ON up.user_profile_id = (al.old_values->>'user_profile_id')::int
        WHERE al.table_name = 'compliance_report_history'
          AND al.operation = 'UPDATE'
          AND al.old_values->>'status_id' = al.new_values->>'status_id'
          AND (al.old_values->>'create_date') IS NOT NULL
          AND (al.old_values->>'create_date')::timestamptz
              IS DISTINCT FROM (al.new_values->>'create_date')::timestamptz
          AND NOT EXISTS (
              SELECT 1
              FROM compliance_report_history h
              WHERE h.compliance_report_id = (al.old_values->>'compliance_report_id')::int
                AND h.status_id = (al.old_values->>'status_id')::int
                AND h.create_date = (al.old_values->>'create_date')::timestamptz
          );
        """
    )


def downgrade() -> None:
    op.execute(
        f"""
        DELETE FROM compliance_report_history
        WHERE update_user = '{RESTORE_USER}';
        """
    )
    # The constraint cannot come back while a status has several entries.
    # Keep the latest entry per status, which is what the old upsert showed.
    op.execute(
        """
        DELETE FROM compliance_report_history h
        USING compliance_report_history newer
        WHERE newer.compliance_report_id = h.compliance_report_id
          AND newer.status_id = h.status_id
          AND (newer.create_date, newer.compliance_report_history_id)
              > (h.create_date, h.compliance_report_history_id);
        """
    )
    op.create_unique_constraint(
        "uq_compliance_report_id_status_id",
        "compliance_report_history",
        ["compliance_report_id", "status_id"],
    )
