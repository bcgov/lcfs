-- Create Transfer Summary View
CREATE OR REPLACE VIEW vw_fuel_supply_fuel_code AS
SELECT
      "source"."compliance_report_id" AS "compliance_report_id",
      "source"."organization_id" AS "organization_id",
      "source"."organization" AS "organization",
      "source"."compliance_period" AS "compliance_period",
      "source"."report_status" AS "report_status",
      "source"."fuel_supply_id" AS "fuel_supply_id",
      "source"."fuel_type_id" AS "fuel_type_id",
      "source"."fuel_type" AS "fuel_type",
      "source"."renewable" AS "renewable",
      "source"."fuel_category_id" AS "fuel_category_id",
      "source"."fuel_category" AS "fuel_category",
      "source"."fuel_code_id" AS "fuel_code_id",
      "source"."quantity" AS "quantity",
      "source"."units" AS "units",
      "source"."compliance_units" AS "compliance_units",
      "source"."provision_of_the_act_id" AS "provision_of_the_act_id",
      "source"."provision_of_the_act" AS "provision_of_the_act",
      "source"."end_use_id" AS "end_use_id",
      "source"."end_use_type" AS "end_use_type",
      "source"."ci_of_fuel" AS "ci_of_fuel",
      "source"."target_ci" AS "target_ci",
      "source"."uci" AS "uci",
      "source"."energy_density" AS "energy_density",
      "source"."eer" AS "eer",
      "source"."energy" AS "energy",
      "source"."fuel_type_other" AS "fuel_type_other",
      "source"."group_uuid" AS "group_uuid",
      "source"."version" AS "version",
      "source"."action_type" AS "action_type",
      "source"."create_date" AS "create_date",
      "source"."create_user" AS "create_user",
      "source"."create_user_full_name" AS "create_user_full_name",
      "source"."update_date" AS "update_date",
      "source"."update_user" AS "update_user",
      "source"."update_user_full_name" AS "update_user_full_name",
      "Fuel Code - fuel_code_id"."fuel_code_id" AS "Fuel Code - fuel_code_id__fuel_code_id",
      "Fuel Code - fuel_code_id"."fuel_status_id" AS "Fuel Code - fuel_code_id__fuel_status_id",
      "Fuel Code - fuel_code_id"."prefix_id" AS "Fuel Code - fuel_code_id__prefix_id",
      "Fuel Code - fuel_code_id"."fuel_suffix" AS "Fuel Code - fuel_code_id__fuel_suffix",
      "Fuel Code - fuel_code_id"."company" AS "Fuel Code - fuel_code_id__company",
      "Fuel Code - fuel_code_id"."contact_name" AS "Fuel Code - fuel_code_id__contact_name",
      "Fuel Code - fuel_code_id"."contact_email" AS "Fuel Code - fuel_code_id__contact_email",
      "Fuel Code - fuel_code_id"."carbon_intensity" AS "Fuel Code - fuel_code_id__carbon_intensity",
      "Fuel Code - fuel_code_id"."edrms" AS "Fuel Code - fuel_code_id__edrms",
      "Fuel Code - fuel_code_id"."last_updated" AS "Fuel Code - fuel_code_id__last_updated",
      "Fuel Code - fuel_code_id"."application_date" AS "Fuel Code - fuel_code_id__application_date",
      "Fuel Code - fuel_code_id"."approval_date" AS "Fuel Code - fuel_code_id__approval_date",
      "Fuel Code - fuel_code_id"."fuel_type_id" AS "Fuel Code - fuel_code_id__fuel_type_id",
      "Fuel Code - fuel_code_id"."feedstock" AS "Fuel Code - fuel_code_id__feedstock",
      "Fuel Code - fuel_code_id"."feedstock_location" AS "Fuel Code - fuel_code_id__feedstock_location",
      "Fuel Code - fuel_code_id"."feedstock_misc" AS "Fuel Code - fuel_code_id__feedstock_misc",
      "Fuel Code - fuel_code_id"."fuel_production_facility_city" AS "Fuel Code - fuel_code_id__fuel_production_facility_city",
      "Fuel Code - fuel_code_id"."fuel_production_facility_province_state" AS "Fuel Code - fuel_code_id__fuel_production_facility__c31b5d39",
      "Fuel Code - fuel_code_id"."fuel_production_facility_country" AS "Fuel Code - fuel_code_id__fuel_production_facility_country",
      "Fuel Code - fuel_code_id"."facility_nameplate_capacity" AS "Fuel Code - fuel_code_id__facility_nameplate_capacity",
      "Fuel Code - fuel_code_id"."facility_nameplate_capacity_unit" AS "Fuel Code - fuel_code_id__facility_nameplate_capacity_unit",
      "Fuel Code - fuel_code_id"."former_company" AS "Fuel Code - fuel_code_id__former_company",
      "Fuel Code - fuel_code_id"."notes" AS "Fuel Code - fuel_code_id__notes",
      "Fuel Code - fuel_code_id"."create_date" AS "Fuel Code - fuel_code_id__create_date",
      "Fuel Code - fuel_code_id"."update_date" AS "Fuel Code - fuel_code_id__update_date",
      "Fuel Code - fuel_code_id"."create_user" AS "Fuel Code - fuel_code_id__create_user",
      "Fuel Code - fuel_code_id"."update_user" AS "Fuel Code - fuel_code_id__update_user",
      "Fuel Code - fuel_code_id"."effective_date" AS "Fuel Code - fuel_code_id__effective_date",
      "Fuel Code - fuel_code_id"."effective_status" AS "Fuel Code - fuel_code_id__effective_status",
      "Fuel Code - fuel_code_id"."expiration_date" AS "Fuel Code - fuel_code_id__expiration_date"
    FROM
      (
        WITH latest_fs AS (
          SELECT
            DISTINCT ON (group_uuid) *
          FROM
            fuel_supply
         
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
          compliance_report.current_status_id IN (2, 3, 4, 5)
      ) AS "source"
      LEFT JOIN "fuel_code" AS "Fuel Code - fuel_code_id" ON "source"."fuel_code_id" = "Fuel Code - fuel_code_id"."fuel_code_id";

-- Grant SELECT privileges to the reporting role
GRANT SELECT ON vw_fuel_supply_fuel_code TO basic_lcfs_reporting_role;