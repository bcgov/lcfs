"""Database-Level Audit Logging with JSON Delta

Note:
    As the table grows, automatic archiving (e.g., moving older logs to an archive table) and purging (e.g., deleting very old logs)
    can be implemented in the future to maintain performance and manage storage efficiently.

    Archiving:
    - Create an `audit_log_archive` table with the same structure as `audit_log`.
    - Use a scheduled job (e.g., with `pg_cron`) to move records older than a certain threshold (e.g., 1 month) from `audit_log` to `audit_log_archive`.
    - Alternatively, consider creating date-based archive tables (e.g., audit_log_archive_2025_01) to organize logs by time periods.
    
    Purging:
    - Use a scheduled job (e.g., with `pg_cron`) to delete records older than a defined retention period (e.g., 1 years) from `audit_log_archive`.

Revision ID: bf26425d2a14
Revises: 1b4d0dcf70a8
Create Date: 2024-11-01 12:27:33.901648

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "bf26425d2a14"
down_revision = "413db49916b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 1: Create the audit_log table
    op.create_table(
        "audit_log",
        sa.Column(
            "audit_log_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for each audit log entry.",
        ),
        sa.Column(
            "table_name",
            sa.Text(),
            nullable=False,
            comment="Name of the table where the action occurred.",
        ),
        sa.Column(
            "operation",
            sa.Text(),
            nullable=False,
            comment="Type of operation: 'INSERT', 'UPDATE', or 'DELETE'.",
        ),
        sa.Column(
            "row_id",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            comment="Primary key of the affected row, stored as JSONB to support composite keys.",
        ),
        sa.Column(
            "old_values",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="Previous values before the operation.",
        ),
        sa.Column(
            "new_values",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="New values after the operation.",
        ),
        sa.Column(
            "delta",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="JSONB delta of the changes.",
        ),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Timestamp when the audit log entry was created.",
        ),
        sa.Column(
            "create_user",
            sa.String(),
            nullable=True,
            comment="User who created the audit log entry.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Timestamp when the audit log entry was last updated.",
        ),
        sa.Column(
            "update_user",
            sa.String(),
            nullable=True,
            comment="User who last updated the audit log entry.",
        ),
        sa.PrimaryKeyConstraint("audit_log_id", name=op.f("pk_audit_log")),
        sa.UniqueConstraint(
            "audit_log_id",
            name=op.f("uq_audit_log_audit_log_id"),
        ),
        comment="Audit log capturing changes to database tables.",
    )

    # Create indexes
    op.create_index(
        "idx_audit_log_table_name",
        "audit_log",
        ["table_name"],
        unique=False,
    )
    op.create_index(
        "idx_audit_log_operation",
        "audit_log",
        ["operation"],
        unique=False,
    )
    op.create_index(
        "idx_audit_log_create_date",
        "audit_log",
        ["create_date"],
        unique=False,
    )
    op.create_index(
        "idx_audit_log_create_user",
        "audit_log",
        ["create_user"],
        unique=False,
    )
    op.create_index(
        "idx_audit_log_delta",
        "audit_log",
        ["delta"],
        postgresql_using="gin",
        unique=False,
    )

    # Step 2: Create JSONB_DIFF FUNCTION
    op.execute(
        """
        CREATE OR REPLACE FUNCTION jsonb_diff(
            old_row JSONB,
            new_row JSONB
        ) RETURNS JSONB AS $$
        BEGIN
            RETURN (
                SELECT jsonb_object_agg(key, value)
                FROM (
                    SELECT key, value
                    FROM jsonb_each(new_row)
                    EXCEPT
                    SELECT key, value
                    FROM jsonb_each(old_row)
                ) diff
            );
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    # Step 3: Add JSON delta function
    op.execute(
        """
        CREATE OR REPLACE FUNCTION generate_json_delta(
            old_row JSONB,
            new_row JSONB
        ) RETURNS JSONB AS $$
        BEGIN
            RETURN jsonb_diff(old_row, new_row);
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    # Step 4: Add audit trigger function
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

            INSERT INTO audit_log (
                create_user,
                update_user,
                table_name,
                operation,
                row_id,
                delta,
                old_values,
                new_values
            )
            VALUES (
                current_setting('app.username', true),
                current_setting('app.username', true),
                v_table_name,
                v_operation,
                v_row_id,
                v_delta,
                v_old_values,
                v_new_values
            );

            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    # Step 5: Add audit triggers to relevant LCFS tables
    op.execute(
        """
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN SELECT tablename
                     FROM pg_tables
                     WHERE schemaname = 'public'
                       AND tablename IN ('transaction', 'compliance_report', 'compliance_report_history',
                       'compliance_report_status', 'compliance_report_summary', 'compliance_period',
                       'initiative_agreement', 'initiative_agreement_status', 'initiative_agreement_history',
                       'allocation_agreement', 'allocation_transaction_type', 'custom_fuel_type', 'fuel_code',
                       'fuel_code_prefix', 'fuel_code_status', 'fuel_category', 'fuel_instance', 'fuel_type',
                       'fuel_export', 'organization', 'organization_address', 'organization_attorney_address',
                       'organization_status', 'organization_type', 'transfer', 'transfer_category', 'transfer_history',
                       'transfer_status', 'internal_comment', 'user_profile', 'user_role', 'role', 'notification_message',
                       'notification_type', 'admin_adjustment', 'admin_adjustment_status', 'admin_adjustment_history',
                       'provision_of_the_act', 'supplemental_report', 'final_supply_equipment', 'notional_transfer',
                       'fuel_supply', 'additional_carbon_intensity', 'document', 'end_use_type', 'energy_density',
                       'energy_effectiveness_ratio', 'transport_mode', 'final_supply_equipment', 'level_of_equipment',
                       'user_login_history', 'unit_of_measure', 'target_carbon_intensity')
            LOOP
                EXECUTE format('
                    CREATE TRIGGER audit_%I_insert_update_delete
                    AFTER INSERT OR UPDATE OR DELETE ON %I
                    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();',
                    r.tablename, r.tablename);
            END LOOP;
        END $$;
        """
    )


def downgrade() -> None:
    # Step 5 Downgrade: Remove audit triggers
    op.execute(
        """
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN SELECT tablename
                     FROM pg_tables
                     WHERE schemaname = 'public'
                       AND tablename IN ('transaction', 'compliance_report', 'compliance_report_history',
                       'compliance_report_status', 'compliance_report_summary', 'compliance_period',
                       'initiative_agreement', 'initiative_agreement_status', 'initiative_agreement_history',
                       'allocation_agreement', 'allocation_transaction_type', 'custom_fuel_type', 'fuel_code',
                       'fuel_code_prefix', 'fuel_code_status', 'fuel_category', 'fuel_instance', 'fuel_type',
                       'fuel_export', 'organization', 'organization_address', 'organization_attorney_address',
                       'organization_status', 'organization_type', 'transfer', 'transfer_category', 'transfer_history',
                       'transfer_status', 'internal_comment', 'user_profile', 'user_role', 'role', 'notification_message',
                       'notification_type', 'admin_adjustment', 'admin_adjustment_status', 'admin_adjustment_history',
                       'provision_of_the_act', 'supplemental_report', 'final_supply_equipment', 'notional_transfer',
                       'fuel_supply', 'additional_carbon_intensity', 'document', 'end_use_type', 'energy_density',
                       'energy_effectiveness_ratio', 'transport_mode', 'final_supply_equipment', 'level_of_equipment',
                       'user_login_history', 'unit_of_measure', 'target_carbon_intensity')
            LOOP
                EXECUTE format('
                    DROP TRIGGER IF EXISTS audit_%I_insert_update_delete ON %I;',
                    r.tablename, r.tablename);
            END LOOP;
        END $$;
        """
    )

    # Step 4 Downgrade: Drop audit trigger function
    op.execute("DROP FUNCTION IF EXISTS audit_trigger_func;")

    # Step 3 Downgrade: Drop generate_json_delta function
    op.execute("DROP FUNCTION IF EXISTS generate_json_delta;")

    # Step 2 Downgrade: Drop JSONB_DIFF FUNCTION
    op.execute("DROP FUNCTION IF EXISTS jsonb_diff;")

    # Step 1 Downgrade: Drop audit_log table
    op.drop_index("idx_audit_log_delta", table_name="audit_log")
    op.drop_index("idx_audit_log_create_user", table_name="audit_log")
    op.drop_index("idx_audit_log_create_date", table_name="audit_log")
    op.drop_index("idx_audit_log_operation", table_name="audit_log")
    op.drop_index("idx_audit_log_table_name", table_name="audit_log")
    op.drop_table("audit_log")
