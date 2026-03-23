"""Replace static audit trigger list with dynamic coverage

Revision ID: e8f1d2c3b4a5
Revises: c7e4d9a1b2f6
Create Date: 2026-03-20 10:00:00.000000
"""

from alembic import op

revision = "e8f1d2c3b4a5"
down_revision = "c7e4d9a1b2f6"
branch_labels = None
depends_on = None

# Tables that must never receive an audit trigger.
_EXCLUDED = ("audit_log", "alembic_version")

_EXCLUDED_SQL = "ARRAY[{}]".format(",".join(f"'{t}'" for t in _EXCLUDED))


def upgrade() -> None:
    # Adds audit_trigger_func to all public tables not in _EXCLUDED
    op.execute(
        f"""
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
                  AND NOT (pt.tablename = ANY({_EXCLUDED_SQL}))
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
        """
    )

    # Back-fill every table that slipped through the old static list.
    op.execute("SELECT ensure_audit_triggers();")

    # Adds audit triggers when a table is created in public.
    op.execute(
        f"""
        CREATE OR REPLACE FUNCTION apply_audit_trigger_on_create()
        RETURNS event_trigger AS $$
        DECLARE
            obj            RECORD;
            v_tablename    TEXT;
            v_trigger_name TEXT;
            v_func_oid     OID;
            v_excluded     TEXT[] := {_EXCLUDED_SQL};
        BEGIN
            SELECT oid INTO v_func_oid
            FROM pg_proc
            WHERE proname = 'audit_trigger_func'
              AND pronamespace = 'public'::regnamespace;

            IF v_func_oid IS NULL THEN
                RETURN;
            END IF;

            FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands()
            LOOP
                IF obj.command_tag = 'CREATE TABLE'
                   AND obj.object_type = 'table'
                   AND split_part(obj.object_identity, '.', 1) = 'public'
                THEN
                    v_tablename := split_part(obj.object_identity, '.', 2);

                    IF NOT (v_tablename = ANY(v_excluded))
                       AND NOT EXISTS (
                           SELECT 1
                           FROM pg_trigger t
                           JOIN pg_class   c ON c.oid = t.tgrelid
                           WHERE c.relname      = v_tablename
                             AND c.relnamespace = 'public'::regnamespace
                             AND t.tgfoid       = v_func_oid
                             AND NOT t.tgisinternal
                       )
                    THEN
                        v_trigger_name := left(
                            'audit_' || v_tablename || '_insert_update_delete', 63
                        );
                        EXECUTE format(
                            'CREATE TRIGGER %I'
                            ' AFTER INSERT OR UPDATE OR DELETE ON %I'
                            ' FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();',
                            v_trigger_name, v_tablename
                        );
                    END IF;
                END IF;
            END LOOP;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    op.execute(
        """
        CREATE EVENT TRIGGER auto_audit_trigger_on_create
            ON ddl_command_end
            WHEN TAG IN ('CREATE TABLE')
            EXECUTE FUNCTION apply_audit_trigger_on_create();
        """
    )


def downgrade() -> None:
    op.execute("DROP EVENT TRIGGER  IF EXISTS auto_audit_trigger_on_create;")
    op.execute("DROP FUNCTION IF EXISTS apply_audit_trigger_on_create;")
    op.execute("DROP FUNCTION IF EXISTS ensure_audit_triggers;")
