"""Consolidated Migration: Materialized Views, Audit Logging Functions, and Triggers

Revision ID: 4038ff8d8c49
Revises: 2c69188b9d1c
Create Date: 2024-11-02 10:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "4038ff8d8c49"
down_revision = "2c69188b9d1c"
branch_labels = None
depends_on = None


def upgrade():
    # ----------------------------------------
    # Part 1: Drop Existing Triggers, Functions, and Views
    # ----------------------------------------
    drop_existing_triggers_functions_views()

    # ----------------------------------------
    # Part 2: Create Audit Log Functions and Triggers
    # ----------------------------------------
    create_audit_log_functions_and_triggers()

    # ----------------------------------------
    # Part 3: Create Materialized Views and Triggers
    # ----------------------------------------
    create_materialized_views_and_triggers()

    # ----------------------------------------
    # Part 4: Create Update Organization Balance Function and Trigger
    # ----------------------------------------
    create_update_organization_balance_function_and_trigger()


def downgrade():
    # ----------------------------------------
    # Part 4 Downgrade: Drop Update Organization Balance Function and Trigger
    # ----------------------------------------
    op.execute(
        """DROP TRIGGER IF EXISTS update_organization_balance_trigger ON "transaction";"""
    )
    op.execute("""DROP FUNCTION IF EXISTS update_organization_balance();""")

    # ----------------------------------------
    # Part 3 Downgrade: Drop Materialized Views and Triggers
    # ----------------------------------------
    drop_materialized_views_and_triggers()

    # ----------------------------------------
    # Part 2 Downgrade: Drop Audit Log Functions and Triggers
    # ----------------------------------------
    drop_audit_log_functions_and_triggers()


# ---------------------------
# Helper Functions
# ---------------------------


def drop_existing_triggers_functions_views():
    # Drop existing triggers
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer ON transfer;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_transaction_view_after_initiative_agreement ON initiative_agreement;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_transaction_view_after_admin_adjustment ON admin_adjustment;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer_history ON transfer_history;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_transaction_view_after_initiative_agreement_history ON initiative_agreement_history;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_transaction_view_after_admin_adjustment_history ON admin_adjustment_history;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_mv_transaction_count_after_transfer ON transfer;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_mv_transaction_count_after_initiative_agreement ON initiative_agreement;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_mv_transaction_count_after_admin_adjustment ON admin_adjustment;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_transfer ON transfer;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_compliance_report ON compliance_report;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_initiative_agreement ON initiative_agreement;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_admin_adjustment ON admin_adjustment;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_mv_org_compliance_report_count_after_compliance_report ON compliance_report;"""
    )

    # Drop existing functions
    op.execute("""DROP FUNCTION IF EXISTS refresh_transaction_aggregate();""")
    op.execute("""DROP FUNCTION IF EXISTS refresh_mv_transaction_count();""")
    op.execute(
        """DROP FUNCTION IF EXISTS refresh_mv_director_review_transaction_count();"""
    )
    op.execute("""DROP FUNCTION IF EXISTS refresh_mv_org_compliance_report_count();""")

    # Drop existing materialized views and views
    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_transaction_aggregate;""")
    op.execute("""DROP VIEW IF EXISTS transaction_status_view;""")
    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_transaction_count;""")
    op.execute(
        """DROP MATERIALIZED VIEW IF EXISTS mv_director_review_transaction_count;"""
    )
    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_org_compliance_report_count;""")


def create_audit_log_functions_and_triggers():
    # Step 1: Create JSONB_DIFF FUNCTION
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

    # Step 2: Add JSON delta function
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

    # Step 3: Add audit trigger function
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

    # Step 4: Add audit triggers to relevant tables
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


def create_materialized_views_and_triggers():
    # Create mv_transaction_aggregate materialized view
    op.execute(
        """
    CREATE MATERIALIZED VIEW mv_transaction_aggregate AS
    SELECT
        t.transfer_id AS transaction_id,
        'Transfer' AS transaction_type,
        org_from.organization_id AS from_organization_id,
        org_from.name AS from_organization,
        org_to.organization_id AS to_organization_id,
        org_to.name AS to_organization,
        t.quantity,
        t.price_per_unit,
        ts.status::text AS status,
        NULL AS compliance_period,
        t.from_org_comment AS comment,
        tc.category,
        (
            SELECT th.create_date 
            FROM transfer_history th 
            WHERE th.transfer_id = t.transfer_id AND th.transfer_status_id = 6
        ) AS recorded_date,
        NULL AS approved_date,
        t.transaction_effective_date,
        t.update_date,
        t.create_date
    FROM transfer t
    JOIN organization org_from ON t.from_organization_id = org_from.organization_id
    JOIN organization org_to ON t.to_organization_id = org_to.organization_id
    JOIN transfer_status ts ON t.current_status_id = ts.transfer_status_id
    LEFT JOIN transfer_category tc ON t.transfer_category_id = tc.transfer_category_id
    UNION ALL
    SELECT
        ia.initiative_agreement_id AS transaction_id,
        'InitiativeAgreement' AS transaction_type,
        NULL AS from_organization_id,
        NULL AS from_organization,
        org.organization_id AS to_organization_id,
        org.name AS to_organization,
        ia.compliance_units AS quantity,
        NULL AS price_per_unit,
        ias.status::text AS status,
        NULL AS compliance_period,
        ia.gov_comment AS comment,
        NULL AS category,
        NULL AS recorded_date,
        (
            SELECT iah.create_date 
            FROM initiative_agreement_history iah 
            WHERE iah.initiative_agreement_id = ia.initiative_agreement_id AND iah.initiative_agreement_status_id = 3
        ) AS approved_date,
        ia.transaction_effective_date,
        ia.update_date,
        ia.create_date
    FROM initiative_agreement ia
    JOIN organization org ON ia.to_organization_id = org.organization_id
    JOIN initiative_agreement_status ias ON ia.current_status_id = ias.initiative_agreement_status_id
    UNION ALL
    SELECT
        aa.admin_adjustment_id AS transaction_id,
        'AdminAdjustment' AS transaction_type,
        NULL AS from_organization_id,
        NULL AS from_organization,
        org.organization_id AS to_organization_id,
        org.name AS to_organization,
        aa.compliance_units AS quantity,
        NULL AS price_per_unit,
        aas.status::text AS status,
        NULL AS compliance_period,
        aa.gov_comment AS comment,
        NULL AS category,
        NULL AS recorded_date,
        (
            SELECT aah.create_date 
            FROM admin_adjustment_history aah 
            WHERE aah.admin_adjustment_id = aa.admin_adjustment_id AND aah.admin_adjustment_status_id = 3
        ) AS approved_date,
        aa.transaction_effective_date,
        aa.update_date,
        aa.create_date
    FROM admin_adjustment aa
    JOIN organization org ON aa.to_organization_id = org.organization_id
    JOIN admin_adjustment_status aas ON aa.current_status_id = aas.admin_adjustment_status_id;
    """
    )

    # Create unique index on mv_transaction_aggregate
    op.execute(
        """
    CREATE UNIQUE INDEX mv_transaction_aggregate_unique_idx ON mv_transaction_aggregate (transaction_id, transaction_type);
    """
    )

    # Create transaction_status_view
    op.execute(
        """
    CREATE OR REPLACE VIEW transaction_status_view AS
    SELECT 
        status::text, 
        create_date,
        update_date
    FROM initiative_agreement_status
    UNION
    SELECT         
        status::text, 
        create_date,
        update_date 
    FROM admin_adjustment_status
    UNION
    SELECT 
        status::text, 
        create_date,
        update_date  
    FROM transfer_status;
    """
    )

    # Create refresh_transaction_aggregate function
    op.execute(
        """
    CREATE OR REPLACE FUNCTION refresh_transaction_aggregate()
    RETURNS TRIGGER AS $$
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_aggregate;
        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
    """
    )

    # Create triggers to refresh mv_transaction_aggregate
    op.execute(
        """
    CREATE TRIGGER refresh_transaction_view_after_transfer
    AFTER INSERT OR UPDATE OR DELETE ON transfer
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
    """
    )
    op.execute(
        """
    CREATE TRIGGER refresh_transaction_view_after_initiative_agreement
    AFTER INSERT OR UPDATE OR DELETE ON initiative_agreement
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
    """
    )
    op.execute(
        """
    CREATE TRIGGER refresh_transaction_view_after_admin_adjustment
    AFTER INSERT OR UPDATE OR DELETE ON admin_adjustment
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
    """
    )
    op.execute(
        """
    CREATE TRIGGER refresh_transaction_view_after_transfer_history
    AFTER INSERT OR UPDATE OR DELETE ON transfer_history
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
    """
    )
    op.execute(
        """
    CREATE TRIGGER refresh_transaction_view_after_initiative_agreement_history
    AFTER INSERT OR UPDATE OR DELETE ON initiative_agreement_history
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
    """
    )
    op.execute(
        """
    CREATE TRIGGER refresh_transaction_view_after_admin_adjustment_history
    AFTER INSERT OR UPDATE OR DELETE ON admin_adjustment_history
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
    """
    )

    # Create mv_transaction_count materialized view
    op.execute(
        """
    CREATE MATERIALIZED VIEW mv_transaction_count AS
    SELECT
        'transfers' AS transaction_type,
        COUNT(*) FILTER (
            WHERE
                t.current_status_id IN (4, 5)  -- Submitted, Recommended
        ) AS count_in_progress
    FROM transfer t
    UNION ALL
    SELECT
        'initiative_agreements' AS transaction_type,
        COUNT(*) FILTER (
            WHERE
                ia.current_status_id IN (1, 2)  -- Draft, Recommended
        ) AS count_in_progress
    FROM initiative_agreement ia
    UNION ALL
    SELECT
        'admin_adjustments' AS transaction_type,
        COUNT(*) FILTER (
            WHERE
                aa.current_status_id IN (1, 2)  -- Draft, Recommended
        ) AS count_in_progress
    FROM admin_adjustment aa;
    """
    )

    # Create unique index on mv_transaction_count
    op.execute(
        """
    CREATE UNIQUE INDEX mv_transaction_count_unique_idx ON mv_transaction_count (transaction_type);
    """
    )

    # Create refresh_mv_transaction_count function
    op.execute(
        """
    CREATE OR REPLACE FUNCTION refresh_mv_transaction_count()
    RETURNS TRIGGER AS $$
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_count;
        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
    """
    )

    # Create triggers to refresh mv_transaction_count
    op.execute(
        """
    CREATE TRIGGER refresh_mv_transaction_count_after_transfer
    AFTER INSERT OR UPDATE OR DELETE ON transfer
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_transaction_count();
    """
    )
    op.execute(
        """
    CREATE TRIGGER refresh_mv_transaction_count_after_initiative_agreement
    AFTER INSERT OR UPDATE OR DELETE ON initiative_agreement
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_transaction_count();
    """
    )
    op.execute(
        """
    CREATE TRIGGER refresh_mv_transaction_count_after_admin_adjustment
    AFTER INSERT OR UPDATE OR DELETE ON admin_adjustment
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_transaction_count();
    """
    )

    # Create mv_director_review_transaction_count materialized view
    op.execute(
        """
    CREATE MATERIALIZED VIEW mv_director_review_transaction_count AS
    SELECT
        'transfers' AS transaction_type,
        COUNT(*) FILTER (
            WHERE
                t.current_status_id = 5  -- Recommended
        ) AS count_for_review
    FROM transfer t
    UNION ALL
    SELECT
        'compliance_reports' AS transaction_type,
        COUNT(*) FILTER (
            WHERE
                cr.current_status_id = 4  -- Recommended by Manager
        ) AS count_for_review
    FROM compliance_report cr
    UNION ALL
    SELECT
        'initiative_agreements' AS transaction_type,
        COUNT(*) FILTER (
            WHERE
                ia.current_status_id = 2  -- Recommended
        ) AS count_for_review
    FROM initiative_agreement ia
    UNION ALL
    SELECT
        'admin_adjustments' AS transaction_type,
        COUNT(*) FILTER (
            WHERE
                aa.current_status_id = 2  -- Recommended
        ) AS count_for_review
    FROM admin_adjustment aa;
    """
    )

    # Create unique index on mv_director_review_transaction_count
    op.execute(
        """
    CREATE UNIQUE INDEX mv_director_review_transaction_count_unique_idx ON mv_director_review_transaction_count (transaction_type);
    """
    )

    # Create refresh_mv_director_review_transaction_count function
    op.execute(
        """
    CREATE OR REPLACE FUNCTION refresh_mv_director_review_transaction_count()
    RETURNS TRIGGER AS $$
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_director_review_transaction_count;
        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
    """
    )

    # Create triggers to refresh mv_director_review_transaction_count
    op.execute(
        """
    CREATE TRIGGER refresh_mv_director_review_transaction_count_after_transfer
    AFTER INSERT OR UPDATE OR DELETE ON transfer
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_director_review_transaction_count();
    """
    )
    op.execute(
        """
    CREATE TRIGGER refresh_mv_director_review_transaction_count_after_compliance_report
    AFTER INSERT OR UPDATE OR DELETE ON compliance_report
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_director_review_transaction_count();
    """
    )
    op.execute(
        """
    CREATE TRIGGER refresh_mv_director_review_transaction_count_after_initiative_agreement
    AFTER INSERT OR UPDATE OR DELETE ON initiative_agreement
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_director_review_transaction_count();
    """
    )
    op.execute(
        """
    CREATE TRIGGER refresh_mv_director_review_transaction_count_after_admin_adjustment
    AFTER INSERT OR UPDATE OR DELETE ON admin_adjustment
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_director_review_transaction_count();
    """
    )

    # Create mv_org_compliance_report_count materialized view
    op.execute(
        """
    CREATE MATERIALIZED VIEW mv_org_compliance_report_count AS
    SELECT
        organization_id,
        COUNT(*) FILTER (WHERE current_status_id = 1) AS count_in_progress,
        COUNT(*) FILTER (WHERE current_status_id = 2) AS count_awaiting_gov_review
    FROM
        compliance_report
    GROUP BY
        organization_id;
    """
    )

    # Create unique index on mv_org_compliance_report_count
    op.execute(
        """
    CREATE UNIQUE INDEX mv_org_compliance_report_count_org_id_idx ON mv_org_compliance_report_count (organization_id);
    """
    )

    # Create refresh_mv_org_compliance_report_count function
    op.execute(
        """
    CREATE OR REPLACE FUNCTION refresh_mv_org_compliance_report_count()
    RETURNS TRIGGER AS $$
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_org_compliance_report_count;
        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
    """
    )

    # Create trigger to refresh mv_org_compliance_report_count
    op.execute(
        """
    CREATE TRIGGER refresh_mv_org_compliance_report_count_after_compliance_report
    AFTER INSERT OR UPDATE OR DELETE ON compliance_report
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_org_compliance_report_count();
    """
    )


def create_update_organization_balance_function_and_trigger():
    # Create update_organization_balance function
    op.execute(
        """
    CREATE OR REPLACE FUNCTION update_organization_balance()
    RETURNS TRIGGER AS $$
    DECLARE
        new_total_balance BIGINT;
        new_reserved_balance BIGINT;
        org_id INT := COALESCE(NEW.organization_id, OLD.organization_id);
    BEGIN
        -- Calculate new total balance for specific organization_id
        SELECT COALESCE(SUM(compliance_units), 0) INTO new_total_balance
        FROM "transaction"
        WHERE organization_id = org_id
        AND transaction_action = 'Adjustment';

        -- Calculate new reserved balance for specific organization_id
        SELECT COALESCE(SUM(compliance_units), 0) INTO new_reserved_balance
        FROM "transaction"
        WHERE organization_id = org_id
        AND transaction_action = 'Reserved';

        -- Update the organization with the new balances
        UPDATE organization
        SET total_balance = new_total_balance,
            reserved_balance = new_reserved_balance
        WHERE organization_id = org_id;

        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    """
    )

    # Create trigger to update organization balance
    op.execute(
        """
    CREATE TRIGGER update_organization_balance_trigger
    AFTER INSERT OR UPDATE OR DELETE ON "transaction"
    FOR EACH ROW EXECUTE FUNCTION update_organization_balance();
    """
    )


def drop_materialized_views_and_triggers():
    # Drop triggers related to materialized views
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer ON transfer;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_transaction_view_after_initiative_agreement ON initiative_agreement;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_transaction_view_after_admin_adjustment ON admin_adjustment;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer_history ON transfer_history;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_transaction_view_after_initiative_agreement_history ON initiative_agreement_history;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_transaction_view_after_admin_adjustment_history ON admin_adjustment_history;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_mv_transaction_count_after_transfer ON transfer;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_mv_transaction_count_after_initiative_agreement ON initiative_agreement;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_mv_transaction_count_after_admin_adjustment ON admin_adjustment;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_transfer ON transfer;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_compliance_report ON compliance_report;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_initiative_agreement ON initiative_agreement;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_admin_adjustment ON admin_adjustment;"""
    )
    op.execute(
        """DROP TRIGGER IF EXISTS refresh_mv_org_compliance_report_count_after_compliance_report ON compliance_report;"""
    )

    # Drop functions related to materialized views
    op.execute("""DROP FUNCTION IF EXISTS refresh_transaction_aggregate();""")
    op.execute("""DROP FUNCTION IF EXISTS refresh_mv_transaction_count();""")
    op.execute(
        """DROP FUNCTION IF EXISTS refresh_mv_director_review_transaction_count();"""
    )
    op.execute("""DROP FUNCTION IF EXISTS refresh_mv_org_compliance_report_count();""")

    # Drop materialized views and views
    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_transaction_aggregate;""")
    op.execute("""DROP VIEW IF EXISTS transaction_status_view;""")
    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_transaction_count;""")
    op.execute(
        """DROP MATERIALIZED VIEW IF EXISTS mv_director_review_transaction_count;"""
    )
    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_org_compliance_report_count;""")


def drop_audit_log_functions_and_triggers():
    # Remove audit triggers
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

    # Drop audit trigger function
    op.execute("DROP FUNCTION IF EXISTS audit_trigger_func;")

    # Drop generate_json_delta function
    op.execute("DROP FUNCTION IF EXISTS generate_json_delta;")

    # Drop JSONB_DIFF FUNCTION
    op.execute("DROP FUNCTION IF EXISTS jsonb_diff;")
