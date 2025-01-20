"""
Consolidated Migration: Materialized Views, Audit Logging, Updated Balances, and More

Incorporates the original base migration (4038ff8d8c49, dated 2024-11-02)
plus follow-up migrations in chronological order:

1) 9329e38396e1 (2024-12-30):   update_count_transfers_in_progress()
2) 10863452ccd2 (2025-01-10):   mv_compliance_report_count
3) d25e7c47659e (2025-01-10):   update_organization_balance() changes (overridden later)
4) f78e53370ed2 (2025-01-13):   Add CR to mv_transaction_aggregate
5) 5163af6ba4a4 (2025-01-14):   Revert org display balance (final version of update_organization_balance())
6) 8119d12538df (2025-01-14):   mv_fuel_code_count

Revision ID: f217cd32474b
Revises: ed3b4d40b324
Create Date: 2025-01-20 14:37:57.157152
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "f217cd32474b"
down_revision = "ed3b4d40b324"
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
    # Part 3: Create Materialized Views and Triggers (Base)
    # ----------------------------------------
    create_materialized_views_and_triggers()

    # ----------------------------------------
    # Part 4: Create/Update Organization Balance Function and Trigger (Final)
    #  (Supersedes older definitions by taking final logic from 5163af6ba4a4)
    # ----------------------------------------
    create_update_organization_balance_function_and_trigger()

    # ----------------------------------------
    # Part 5 (2024-12-30, rev 9329e38396e1): add update_count_transfers_in_progress
    # ----------------------------------------
    create_update_count_transfers_in_progress()

    # ----------------------------------------
    # Part 6 (2025-01-10, rev 10863452ccd2): Create mv_compliance_report_count
    # ----------------------------------------
    create_mv_compliance_report_count()

    # ----------------------------------------
    # Part 7 (2025-01-13, rev f78e53370ed2): Recreate mv_transaction_aggregate with CR support
    # ----------------------------------------
    recreate_mv_transaction_aggregate_with_compliance_report()

    # ----------------------------------------
    # Part 8 (2025-01-14, rev 8119d12538df): Create mv_fuel_code_count
    # ----------------------------------------
    create_mv_fuel_code_count()

    # End of upgrade


def downgrade():
    """
    Rolls back changes in reverse order.

    - Drops mv_fuel_code_count (Part 8).
    - Restores older mv_transaction_aggregate definition from before CR was added (Part 7).
    - Drops mv_compliance_report_count (Part 6).
    - Drops update_count_transfers_in_progress() (Part 5).
    - Removes final update_organization_balance (Part 4) but re-creates the older one from the base script.
    - Drops all base materialized views/triggers (Part 3).
    - Drops audit log triggers/functions (Part 2).
    - Leaves the DB with no triggers/functions/views (Part 1).
    """

    # ----------------------------------------
    # Part 8 Downgrade: mv_fuel_code_count
    # ----------------------------------------
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_mv_fuel_code_count_after_change ON fuel_code;"
    )
    op.execute("DROP FUNCTION IF EXISTS refresh_mv_fuel_code_count();")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_fuel_code_count;")

    # ----------------------------------------
    # Part 7 Downgrade: revert mv_transaction_aggregate to original base
    # ----------------------------------------
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_transaction_aggregate;")
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
                WHERE iah.initiative_agreement_id = ia.initiative_agreement_id
                  AND iah.initiative_agreement_status_id = 3
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
                WHERE aah.admin_adjustment_id = aa.admin_adjustment_id
                  AND aah.admin_adjustment_status_id = 3
            ) AS approved_date,
            aa.transaction_effective_date,
            aa.update_date,
            aa.create_date
        FROM admin_adjustment aa
        JOIN organization org ON aa.to_organization_id = org.organization_id
        JOIN admin_adjustment_status aas ON aa.current_status_id = aas.admin_adjustment_status_id;
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX mv_transaction_aggregate_unique_idx
        ON mv_transaction_aggregate (transaction_id, transaction_type);
        """
    )

    # ----------------------------------------
    # Part 6 Downgrade: drop mv_compliance_report_count
    # ----------------------------------------
    op.execute(
        "DROP TRIGGER IF EXISTS refresh_mv_compliance_report_count_after_change ON compliance_report;"
    )
    op.execute("DROP FUNCTION IF EXISTS refresh_mv_compliance_report_count();")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_compliance_report_count;")

    # ----------------------------------------
    # Part 5 Downgrade: drop update_count_transfers_in_progress
    # ----------------------------------------
    op.execute(
        "DROP TRIGGER IF EXISTS update_count_transfers_in_progress_trigger ON transfer;"
    )
    op.execute("DROP FUNCTION IF EXISTS update_count_transfers_in_progress();")

    # ----------------------------------------
    # Part 4 Downgrade: revert update_organization_balance to original
    #   (Matches the base migration’s logic)
    # ----------------------------------------
    op.execute(
        """DROP TRIGGER IF EXISTS update_organization_balance_trigger ON "transaction";"""
    )
    op.execute("""DROP FUNCTION IF EXISTS update_organization_balance();""")
    # Recreate the original from the base script
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
    op.execute(
        """
        CREATE TRIGGER update_organization_balance_trigger
        AFTER INSERT OR UPDATE OR DELETE ON "transaction"
        FOR EACH ROW EXECUTE FUNCTION update_organization_balance();
        """
    )

    # ----------------------------------------
    # Part 3 Downgrade: Drop Materialized Views and Triggers
    # ----------------------------------------
    drop_materialized_views_and_triggers()

    # ----------------------------------------
    # Part 2 Downgrade: Drop Audit Log Functions and Triggers
    # ----------------------------------------
    drop_audit_log_functions_and_triggers()


# ---------------------------------------------------------------------
# Helper Functions (original base)
# ---------------------------------------------------------------------


def drop_existing_triggers_functions_views():
    # (same as original base)
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

    op.execute("""DROP FUNCTION IF EXISTS refresh_transaction_aggregate();""")
    op.execute("""DROP FUNCTION IF EXISTS refresh_mv_transaction_count();""")
    op.execute(
        """DROP FUNCTION IF EXISTS refresh_mv_director_review_transaction_count();"""
    )
    op.execute("""DROP FUNCTION IF EXISTS refresh_mv_org_compliance_report_count();""")

    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_transaction_aggregate;""")
    op.execute("""DROP VIEW IF EXISTS transaction_status_view;""")
    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_transaction_count;""")
    op.execute(
        """DROP MATERIALIZED VIEW IF EXISTS mv_director_review_transaction_count;"""
    )
    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_org_compliance_report_count;""")


def create_audit_log_functions_and_triggers():
    # (same as original base)
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

    # Attach triggers to each relevant table
    op.execute(
        """
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN SELECT tablename
                     FROM pg_tables
                     WHERE schemaname = 'public'
                       AND tablename IN (
                         'transaction','compliance_report','compliance_report_history','compliance_report_status',
                         'compliance_report_summary','compliance_period','initiative_agreement','initiative_agreement_status',
                         'initiative_agreement_history','allocation_agreement','allocation_transaction_type','custom_fuel_type',
                         'fuel_code','fuel_code_prefix','fuel_code_status','fuel_category','fuel_instance','fuel_type',
                         'fuel_export','organization','organization_address','organization_attorney_address','organization_status',
                         'organization_type','transfer','transfer_category','transfer_history','transfer_status','internal_comment',
                         'user_profile','user_role','role','notification_message','notification_type','admin_adjustment',
                         'admin_adjustment_status','admin_adjustment_history','provision_of_the_act','supplemental_report',
                         'final_supply_equipment','notional_transfer','fuel_supply','additional_carbon_intensity','document',
                         'end_use_type','energy_density','energy_effectiveness_ratio','transport_mode','final_supply_equipment',
                         'level_of_equipment','user_login_history','unit_of_measure','target_carbon_intensity'
                       )
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
    # (same as original base)
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

    op.execute(
        """
        CREATE UNIQUE INDEX mv_transaction_aggregate_unique_idx
        ON mv_transaction_aggregate (transaction_id, transaction_type);
        """
    )

    op.execute(
        """
        CREATE OR REPLACE VIEW transaction_status_view AS
        SELECT status::text, create_date, update_date
        FROM initiative_agreement_status
        UNION
        SELECT status::text, create_date, update_date
        FROM admin_adjustment_status
        UNION
        SELECT status::text, create_date, update_date
        FROM transfer_status;
        """
    )

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

    # Triggers for mv_transaction_aggregate
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

    # mv_transaction_count
    op.execute(
        """
        CREATE MATERIALIZED VIEW mv_transaction_count AS
        SELECT
            'transfers' AS transaction_type,
            COUNT(*) FILTER (
                WHERE t.current_status_id IN (4,5)
            ) AS count_in_progress
        FROM transfer t
        UNION ALL
        SELECT
            'initiative_agreements' AS transaction_type,
            COUNT(*) FILTER (
                WHERE ia.current_status_id IN (1,2)
            ) AS count_in_progress
        FROM initiative_agreement ia
        UNION ALL
        SELECT
            'admin_adjustments' AS transaction_type,
            COUNT(*) FILTER (
                WHERE aa.current_status_id IN (1,2)
            ) AS count_in_progress
        FROM admin_adjustment aa;
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX mv_transaction_count_unique_idx
        ON mv_transaction_count (transaction_type);
        """
    )
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

    # mv_director_review_transaction_count
    op.execute(
        """
        CREATE MATERIALIZED VIEW mv_director_review_transaction_count AS
        SELECT
            'transfers' AS transaction_type,
            COUNT(*) FILTER (
                WHERE t.current_status_id = 5
            ) AS count_for_review
        FROM transfer t
        UNION ALL
        SELECT
            'compliance_reports' AS transaction_type,
            COUNT(*) FILTER (
                WHERE cr.current_status_id = 4
            ) AS count_for_review
        FROM compliance_report cr
        UNION ALL
        SELECT
            'initiative_agreements' AS transaction_type,
            COUNT(*) FILTER (
                WHERE ia.current_status_id = 2
            ) AS count_for_review
        FROM initiative_agreement ia
        UNION ALL
        SELECT
            'admin_adjustments' AS transaction_type,
            COUNT(*) FILTER (
                WHERE aa.current_status_id = 2
            ) AS count_for_review
        FROM admin_adjustment aa;
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX mv_director_review_transaction_count_unique_idx
        ON mv_director_review_transaction_count (transaction_type);
        """
    )
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

    # mv_org_compliance_report_count
    op.execute(
        """
        CREATE MATERIALIZED VIEW mv_org_compliance_report_count AS
        SELECT
            organization_id,
            COUNT(*) FILTER (WHERE current_status_id = 1) AS count_in_progress,
            COUNT(*) FILTER (WHERE current_status_id = 2) AS count_awaiting_gov_review
        FROM compliance_report
        GROUP BY organization_id;
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX mv_org_compliance_report_count_org_id_idx
        ON mv_org_compliance_report_count (organization_id);
        """
    )
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
    op.execute(
        """
        CREATE TRIGGER refresh_mv_org_compliance_report_count_after_compliance_report
        AFTER INSERT OR UPDATE OR DELETE ON compliance_report
        FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_org_compliance_report_count();
        """
    )


def create_update_organization_balance_function_and_trigger():
    """
    Final version of update_organization_balance() from 5163af6ba4a4.

    Summaries:
      - total_balance = sum of 'Adjustment'
      - reserved_balance = sum of 'Reserved' with compliance_units < 0
    """
    # Drop if exists (in case older version was created above).
    op.execute(
        """DROP TRIGGER IF EXISTS update_organization_balance_trigger ON "transaction";"""
    )
    op.execute("""DROP FUNCTION IF EXISTS update_organization_balance();""")

    op.execute(
        """
        CREATE OR REPLACE FUNCTION update_organization_balance()
        RETURNS TRIGGER AS $$
        DECLARE
            new_total_balance BIGINT;
            new_reserved_balance BIGINT;
            org_id INT := COALESCE(NEW.organization_id, OLD.organization_id);
        BEGIN
            SELECT COALESCE(SUM(compliance_units), 0)
            INTO new_total_balance
            FROM "transaction"
            WHERE organization_id = org_id
              AND transaction_action = 'Adjustment';

            SELECT COALESCE(SUM(compliance_units), 0)
            INTO new_reserved_balance
            FROM "transaction"
            WHERE organization_id = org_id
              AND transaction_action = 'Reserved'
              AND compliance_units < 0;

            UPDATE organization
            SET total_balance = new_total_balance,
                reserved_balance = new_reserved_balance
            WHERE organization_id = org_id;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER update_organization_balance_trigger
        AFTER INSERT OR UPDATE OR DELETE ON "transaction"
        FOR EACH ROW EXECUTE FUNCTION update_organization_balance();
        """
    )


# ---------------------------------------------------------------------
# Part 5: add update_count_transfers_in_progress (9329e38396e1)
# ---------------------------------------------------------------------
def create_update_count_transfers_in_progress():
    # Create or replace the function
    op.execute(
        """
        CREATE OR REPLACE FUNCTION update_count_transfers_in_progress()
        RETURNS TRIGGER AS $$
        BEGIN
            UPDATE organization o
            SET count_transfers_in_progress = (
                SELECT COUNT(DISTINCT t.transfer_id)
                FROM transfer t
                WHERE 
                    t.current_status_id IN (3, 4) -- Sent, Submitted
                    AND (
                        t.from_organization_id = o.organization_id
                        OR t.to_organization_id = o.organization_id
                    )
            )
            WHERE o.organization_id = COALESCE(NEW.from_organization_id, OLD.from_organization_id)
               OR o.organization_id = COALESCE(NEW.to_organization_id, OLD.to_organization_id);

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    # Trigger after insert/update/delete on transfer
    op.execute(
        """
        CREATE TRIGGER update_count_transfers_in_progress_trigger
        AFTER INSERT OR UPDATE OR DELETE ON transfer
        FOR EACH ROW
        EXECUTE FUNCTION update_count_transfers_in_progress();
        """
    )

    # Update existing counts
    op.execute(
        """
        UPDATE organization o
        SET count_transfers_in_progress = COALESCE(sub.total_transfer_count, 0)
        FROM (
            SELECT
                org.organization_id,
                COUNT(DISTINCT t.transfer_id) AS total_transfer_count
            FROM organization org
            LEFT JOIN transfer t
                ON org.organization_id = t.from_organization_id
                OR org.organization_id = t.to_organization_id
            WHERE t.current_status_id IN (3, 4) -- Sent, Submitted
            GROUP BY org.organization_id
        ) sub
        WHERE o.organization_id = sub.organization_id;
        """
    )


# ---------------------------------------------------------------------
# Part 6: mv_compliance_report_count (10863452ccd2)
# ---------------------------------------------------------------------
def create_mv_compliance_report_count():
    op.execute(
        """
        CREATE MATERIALIZED VIEW mv_compliance_report_count AS
        SELECT 
            CASE current_status_id 
                WHEN 2 THEN 'Submitted'
                WHEN 3 THEN 'Recommended by Analysts'
                WHEN 4 THEN 'Recommended by Manager'
            END as status,
            COUNT(*) as count
        FROM compliance_report
        WHERE current_status_id IN (2,3,4)
        GROUP BY current_status_id;
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX mv_compliance_report_count_idx
        ON mv_compliance_report_count (status);
        """
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION refresh_mv_compliance_report_count()
        RETURNS TRIGGER AS $$
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_compliance_report_count;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER refresh_mv_compliance_report_count_after_change
        AFTER INSERT OR UPDATE OR DELETE ON compliance_report
        FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_compliance_report_count();
        """
    )


# ---------------------------------------------------------------------
# Part 7: Re-create mv_transaction_aggregate with CR (f78e53370ed2)
# ---------------------------------------------------------------------
def recreate_mv_transaction_aggregate_with_compliance_report():
    op.execute("DROP MATERIALIZED VIEW mv_transaction_aggregate;")
    op.execute(
        """
        CREATE MATERIALIZED VIEW mv_transaction_aggregate AS
        SELECT
            t.transfer_id AS transaction_id,
            'Transfer' AS transaction_type,
            NULL AS description,
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
                WHERE th.transfer_id = t.transfer_id
                  AND th.transfer_status_id = 6
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
            NULL AS description,
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
                WHERE iah.initiative_agreement_id = ia.initiative_agreement_id
                  AND iah.initiative_agreement_status_id = 3
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
            NULL AS description,
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
                WHERE aah.admin_adjustment_id = aa.admin_adjustment_id
                  AND aah.admin_adjustment_status_id = 3
            ) AS approved_date,
            aa.transaction_effective_date,
            aa.update_date,
            aa.create_date
        FROM admin_adjustment aa
        JOIN organization org ON aa.to_organization_id = org.organization_id
        JOIN admin_adjustment_status aas ON aa.current_status_id = aas.admin_adjustment_status_id

        UNION ALL

        SELECT
            cr.compliance_report_id AS transaction_id,
            'ComplianceReport' AS transaction_type,
            cr.nickname AS description,
            NULL AS from_organization_id,
            NULL AS from_organization,
            org.organization_id AS to_organization_id,
            org.name AS to_organization,
            tr.compliance_units AS quantity,
            NULL AS price_per_unit,
            crs.status::text AS status,
            cp.description AS compliance_period,
            NULL AS comment,
            NULL AS category,
            NULL AS recorded_date,
            NULL AS approved_date,
            NULL AS transaction_effective_date,
            cr.update_date,
            cr.create_date
        FROM compliance_report cr
        JOIN organization org ON cr.organization_id = org.organization_id
        JOIN compliance_report_status crs ON cr.current_status_id = crs.compliance_report_status_id
        JOIN compliance_period cp ON cr.compliance_period_id = cp.compliance_period_id
        JOIN "transaction" tr ON cr.transaction_id = tr.transaction_id
           AND cr.transaction_id IS NOT NULL
        WHERE crs.status IN ('Assessed', 'Reassessed');
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX mv_transaction_aggregate_unique_idx
        ON mv_transaction_aggregate (transaction_id, description, transaction_type);
        """
    )


# ---------------------------------------------------------------------
# Part 8: mv_fuel_code_count (8119d12538df)
# ---------------------------------------------------------------------
def create_mv_fuel_code_count():
    op.execute(
        """
        CREATE MATERIALIZED VIEW mv_fuel_code_count AS
        SELECT 
            CASE fuel_status_id 
                WHEN 1 THEN 'Draft'
            END as status,
            COUNT(*) as count
        FROM fuel_code
        WHERE fuel_status_id = 1
        GROUP BY fuel_status_id;
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX mv_fuel_code_count_idx
        ON mv_fuel_code_count (status);
        """
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION refresh_mv_fuel_code_count()
        RETURNS TRIGGER AS $$
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fuel_code_count;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER refresh_mv_fuel_code_count_after_change
        AFTER INSERT OR UPDATE OR DELETE ON fuel_code
        FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_fuel_code_count();
        """
    )
    op.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fuel_code_count;")


def drop_materialized_views_and_triggers():
    # (same as original base)
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

    op.execute("""DROP FUNCTION IF EXISTS refresh_transaction_aggregate();""")
    op.execute("""DROP FUNCTION IF EXISTS refresh_mv_transaction_count();""")
    op.execute(
        """DROP FUNCTION IF EXISTS refresh_mv_director_review_transaction_count();"""
    )
    op.execute("""DROP FUNCTION IF EXISTS refresh_mv_org_compliance_report_count();""")

    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_transaction_aggregate;""")
    op.execute("""DROP VIEW IF EXISTS transaction_status_view;""")
    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_transaction_count;""")
    op.execute(
        """DROP MATERIALIZED VIEW IF EXISTS mv_director_review_transaction_count;"""
    )
    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_org_compliance_report_count;""")


def drop_audit_log_functions_and_triggers():
    # (same as original base)
    op.execute(
        """
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN SELECT tablename
                     FROM pg_tables
                     WHERE schemaname = 'public'
                       AND tablename IN (
                         'transaction','compliance_report','compliance_report_history','compliance_report_status',
                         'compliance_report_summary','compliance_period','initiative_agreement','initiative_agreement_status',
                         'initiative_agreement_history','allocation_agreement','allocation_transaction_type','custom_fuel_type',
                         'fuel_code','fuel_code_prefix','fuel_code_status','fuel_category','fuel_instance','fuel_type',
                         'fuel_export','organization','organization_address','organization_attorney_address','organization_status',
                         'organization_type','transfer','transfer_category','transfer_history','transfer_status','internal_comment',
                         'user_profile','user_role','role','notification_message','notification_type','admin_adjustment',
                         'admin_adjustment_status','admin_adjustment_history','provision_of_the_act','supplemental_report',
                         'final_supply_equipment','notional_transfer','fuel_supply','additional_carbon_intensity','document',
                         'end_use_type','energy_density','energy_effectiveness_ratio','transport_mode','final_supply_equipment',
                         'level_of_equipment','user_login_history','unit_of_measure','target_carbon_intensity'
                       )
            LOOP
                EXECUTE format('
                    DROP TRIGGER IF EXISTS audit_%I_insert_update_delete ON %I;',
                    r.tablename, r.tablename);
            END LOOP;
        END $$;
        """
    )
    op.execute("DROP FUNCTION IF EXISTS audit_trigger_func;")
    op.execute("DROP FUNCTION IF EXISTS generate_json_delta;")
    op.execute("DROP FUNCTION IF EXISTS jsonb_diff;")
