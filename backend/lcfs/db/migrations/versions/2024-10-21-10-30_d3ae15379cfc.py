"""Add audit trigger function

Revision ID: d3ae15379cfc
Revises: 617ebc57979b
Create Date: 2024-10-21 10:30:18.414369

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "d3ae15379cfc"
down_revision = "617ebc57979b"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
    CREATE OR REPLACE FUNCTION audit_trigger_func() 
    RETURNS TRIGGER AS $$
    DECLARE
        v_operation TEXT;
        v_table_name TEXT := TG_TABLE_NAME;
        v_row_id JSONB;
        v_old_values JSONB;
        v_new_values JSONB;
        v_delta JSONB;
        v_pk_col TEXT;
    BEGIN
        SELECT c.column_name INTO v_pk_col
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage AS ccu USING (constraint_schema, constraint_name)
        JOIN information_schema.columns AS c ON c.table_schema = tc.constraint_schema
            AND tc.table_name = c.table_name AND ccu.column_name = c.column_name
        WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = TG_TABLE_NAME
        LIMIT 1;

        -- Set the operation type
        IF (TG_OP = 'INSERT') THEN
            v_operation := 'INSERT';
            v_new_values := to_jsonb(NEW);
               
            EXECUTE format('SELECT ($1).%I', v_pk_col) INTO v_row_id USING NEW;
        ELSIF (TG_OP = 'UPDATE') THEN
            v_operation := 'UPDATE';
            v_old_values := to_jsonb(OLD);
            v_new_values := to_jsonb(NEW);
            v_delta := generate_json_delta(v_old_values, v_new_values);
            
            EXECUTE format('SELECT ($1).%I', v_pk_col) INTO v_row_id USING NEW;
        ELSIF (TG_OP = 'DELETE') THEN
            v_operation := 'DELETE';
            v_old_values := to_jsonb(OLD);
            
            EXECUTE format('SELECT ($1).%I', v_pk_col) INTO v_row_id USING OLD;
        END IF;

        -- Insert the audit log entry
        INSERT INTO audit_log (table_name, operation, row_id, delta, old_values, new_values)
        VALUES (v_table_name, v_operation, v_row_id, v_delta, v_old_values, v_new_values);

        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
    """
    )


def downgrade():
    op.execute(
        """
    DROP FUNCTION IF EXISTS audit_trigger_func;
    """
    )
