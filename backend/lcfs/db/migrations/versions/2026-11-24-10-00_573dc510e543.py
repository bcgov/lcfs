"""Keep the row-level audit trigger off scheduled_job_lease

ensure_audit_triggers() (e8f1d2c3b4a5) attaches audit_trigger_func to every
public table that lacks it, and new migrations call it to cover their tables.
scheduled_job_lease (b7a04f59fdf3) is keyed by the text job_name, which
audit_trigger_func cannot record as a row id ("invalid input syntax for type
json"), so the next migration to call ensure_audit_triggers() would make every
lease claim fail and stop the scheduled maintenance jobs. The lease is
operational state, not business data, so it is excluded from audit coverage.

Revision ID: 573dc510e543
Revises: c3a7e91d5f48
Create Date: 2026-11-24 10:00:00.000000
"""

from alembic import op

revision = "573dc510e543"
down_revision = "c3a7e91d5f48"
branch_labels = None
depends_on = None

# Tables that must never receive an audit trigger. Keep this list when
# replacing ensure_audit_triggers() again.
_EXCLUDED = ("audit_log", "alembic_version", "scheduled_job_lease")
_PREVIOUS_EXCLUDED = ("audit_log", "alembic_version")


def _create_ensure_audit_triggers(excluded: tuple[str, ...]) -> None:
    """Replace ensure_audit_triggers() with one that skips the given tables."""
    excluded_sql = "ARRAY[{}]".format(",".join(f"'{t}'" for t in excluded))
    op.execute(f"""
        CREATE OR REPLACE FUNCTION ensure_audit_triggers()
        RETURNS void AS $$
        DECLARE
            r              RECORD;
            v_trigger_name TEXT;
            v_func_oid     OID;
        BEGIN
            SELECT oid INTO v_func_oid
            FROM pg_proc
            WHERE proname = 'audit_trigger_func'
              AND pronamespace = 'public'::regnamespace;

            IF v_func_oid IS NULL THEN
                RETURN;
            END IF;

            FOR r IN
                SELECT pt.tablename
                FROM pg_tables pt
                WHERE pt.schemaname = 'public'
                  AND NOT (pt.tablename = ANY({excluded_sql}))
                  AND NOT EXISTS (
                      SELECT 1
                      FROM pg_trigger t
                      JOIN pg_class   c ON c.oid = t.tgrelid
                      WHERE c.relname      = pt.tablename
                        AND c.relnamespace = 'public'::regnamespace
                        AND t.tgfoid       = v_func_oid
                        AND NOT t.tgisinternal
                  )
            LOOP
                -- Truncate name explicitly so it is predictable (pg limit: 63 bytes).
                v_trigger_name := left(
                    'audit_' || r.tablename || '_insert_update_delete', 63
                );
                EXECUTE format(
                    'CREATE TRIGGER %I'
                    ' AFTER INSERT OR UPDATE OR DELETE ON %I'
                    ' FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();',
                    v_trigger_name, r.tablename
                );
            END LOOP;
        END;
        $$ LANGUAGE plpgsql;
        """)


def upgrade() -> None:
    _create_ensure_audit_triggers(_EXCLUDED)
    # A database that already ran ensure_audit_triggers() after the lease table
    # existed has the trigger; remove it so lease claims work again.
    op.execute(
        "DROP TRIGGER IF EXISTS audit_scheduled_job_lease_insert_update_delete "
        "ON scheduled_job_lease;"
    )


def downgrade() -> None:
    # The trigger is not restored: it breaks every lease claim.
    _create_ensure_audit_triggers(_PREVIOUS_EXCLUDED)
