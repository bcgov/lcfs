-- Create Transfer Summary View
CREATE OR REPLACE VIEW public.vw_fuel_supply AS
WITH latest_fs AS (
      SELECT
        DISTINCT ON (group_uuid) *
      FROM
        public.fuel_supply
     
ORDER BY
        group_uuid,
        VERSION DESC
    )
    SELECT
      -----------------------------------------------------
      -- compliance_report, organization, compliance_period
      -----------------------------------------------------
      compliance_report.compliance_report_id,
      compliance_report.organization_id,
      organization.name AS organization,
      compliance_period.description AS compliance_period,
      compliance_report_status.status AS report_status,
      -------------------------------------------------
      -- fuel_supply
      -------------------------------------------------
      fuel_supply.fuel_supply_id,
      fuel_supply.fuel_type_id,
      fuel_type.fuel_type,
      fuel_type.renewable,
      fuel_supply.fuel_category_id,
      fuel_category.category AS fuel_category,
      fuel_supply.fuel_code_id,
      fuel_supply.quantity,
      fuel_supply.units,
      fuel_supply.compliance_units,
      fuel_supply.provision_of_the_act_id,
      provision_of_the_act.name AS provision_of_the_act,
      fuel_supply.end_use_id,
      end_use_type.type AS end_use_type,
      fuel_supply.ci_of_fuel,
      fuel_supply.target_ci,
      fuel_supply.uci,
      fuel_supply.energy_density,
      fuel_supply.eer,
      fuel_supply.energy,
      fuel_supply.fuel_type_other,
      -------------------------------------------------
      -- Versioning columns
      -------------------------------------------------
      fuel_supply.group_uuid,
      fuel_supply.version,
      fuel_supply.action_type,
      -------------------------------------------------
      -- Timestamps & user references
      -------------------------------------------------
      fuel_supply.create_date,
      fuel_supply.create_user,
      up_create.first_name || ' ' || up_create.last_name AS create_user_full_name,
      fuel_supply.update_date,
      fuel_supply.update_user,
      up_update.first_name || ' ' || up_update.last_name AS update_user_full_name
    FROM
      compliance_report
      JOIN compliance_report_status ON compliance_report.current_status_id = compliance_report_status.compliance_report_status_id
      JOIN organization ON compliance_report.organization_id = organization.organization_id
      JOIN compliance_period ON compliance_report.compliance_period_id = compliance_period.compliance_period_id
      JOIN latest_fs fuel_supply ON compliance_report.compliance_report_id = fuel_supply.compliance_report_id
      JOIN fuel_type ON fuel_supply.fuel_type_id = fuel_type.fuel_type_id
      JOIN fuel_category ON fuel_supply.fuel_category_id = fuel_category.fuel_category_id
     
LEFT JOIN provision_of_the_act ON fuel_supply.provision_of_the_act_id = provision_of_the_act.provision_of_the_act_id
      LEFT JOIN end_use_type ON fuel_supply.end_use_id = end_use_type.end_use_type_id
      LEFT JOIN user_profile up_create ON fuel_supply.create_user = up_create.keycloak_username
      LEFT JOIN user_profile up_update ON fuel_supply.update_user = up_update.keycloak_username
   
WHERE
      compliance_report.current_status_id IN (2, 3, 4, 5);

-- Grant SELECT privileges to the reporting role
GRANT SELECT ON public.vw_fuel_supply TO basic_lcfs_reporting_role;