"""Add audit triggers to LCFS tables

Revision ID: 1f32fe8b7d58
Revises: d3ae15379cfc
Create Date: 2024-10-21 10:57:56.177237

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "1f32fe8b7d58"
down_revision = "d3ae15379cfc"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
    DO $$
    DECLARE
        r RECORD;
    BEGIN
        FOR r IN SELECT tablename
                 FROM pg_tables
                 WHERE schemaname = 'public'
                   AND tablename IN ('transaction','compliance_report', 'compliance_report_history',
                   'compliance_report_status','compliance_report_summary','compliance_period',
                   'initiative_agreement','initiative_agreement_status',
                   'initiative_agreement_history','allocation_agreement',
                   'allocation_transaction_type','custom_fuel_type','fuel_code','fuel_code_prefix',
                   'fuel_code_status','fuel_category','fuel_instance',
                   'fuel_type','fuel_export','organization','organization_address',
                   'organization_attorney_address','organization_status','organization_type',
                   'transfer','transfer_category','transfer_history','transfer_status',
                   'internal_comment','user_profile','user_role','role',
                   'notification_message','notification_type',
                   'admin_adjustment','admin_adjustment_status','admin_adjustment_history',
                   'provision_of_the_act','supplemental_report','final_supply_equipment',
                   'notional_transfer','fuel_supply','additional_carbon_intensity',
                   'document','end_use_type','energy_density','energy_effectiveness_ratio',
                   'transport_mode','final_supply_equipment','level_of_equipment',
                   'user_login_history','unit_of_measure','target_carbon_intensity')
        LOOP
            -- Create a trigger for each table
            EXECUTE format('
                CREATE TRIGGER audit_%I_insert_update_delete
                AFTER INSERT OR UPDATE OR DELETE ON %I
                FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();',
                r.tablename, r.tablename);
        END LOOP;
    END $$;
    """
    )


def downgrade():
    op.execute(
        """
    DO $$
    DECLARE
        r RECORD;
    BEGIN
        FOR r IN SELECT tablename
                 FROM pg_tables
                 WHERE schemaname = 'public'
                   AND tablename IN ('transaction','compliance_report', 'compliance_report_history',
                   'compliance_report_status','compliance_report_summary','compliance_period',
                   'initiative_agreement','initiative_agreement_status',
                   'initiative_agreement_history','allocation_agreement',
                   'allocation_transaction_type','custom_fuel_type','fuel_code','fuel_code_prefix',
                   'fuel_code_status','fuel_category','fuel_instance',
                   'fuel_type','fuel_export','organization','organization_address',
                   'organization_attorney_address','organization_status','organization_type',
                   'transfer','transfer_category','transfer_history','transfer_status',
                   'internal_comment','user_profile','user_role','role',
                   'notification_message','notification_type',
                   'admin_adjustment','admin_adjustment_status','admin_adjustment_history',
                   'provision_of_the_act','supplemental_report','final_supply_equipment',
                   'notional_transfer','fuel_supply','additional_carbon_intensity',
                   'document','end_use_type','energy_density','energy_effectiveness_ratio',
                   'transport_mode','final_supply_equipment','level_of_equipment',
                   'user_login_history','unit_of_measure','target_carbon_intensity')
        LOOP
            -- Drop the trigger for each table
            EXECUTE format('
                DROP TRIGGER IF EXISTS audit_%I_insert_update_delete ON %I;',
                r.tablename, r.tablename);
        END LOOP;
    END $$;
    """
    )
