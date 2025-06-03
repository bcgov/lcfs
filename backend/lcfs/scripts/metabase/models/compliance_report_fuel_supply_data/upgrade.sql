-- Create Transfer Summary View
CREATE OR REPLACE VIEW public.vw_compliance_report_fuel_supply_data AS
SELECT
      "source"."fuel_supply_id" AS "fuel_supply_id",
      "source"."compliance_report_id" AS "compliance_report_id",
      "source"."quantity" AS "quantity",
      "source"."units" AS "units",
      "source"."compliance_units" AS "compliance_units",
      "source"."target_ci" AS "target_ci",
      "source"."ci_of_fuel" AS "ci_of_fuel",
      "source"."energy_density" AS "energy_density",
      "source"."eer" AS "eer",
      "source"."uci" AS "uci",
      "source"."energy" AS "energy",
      "source"."fuel_type_other" AS "fuel_type_other",
      "source"."fuel_category_id" AS "fuel_category_id",
      "source"."fuel_code_id" AS "fuel_code_id",
      "source"."fuel_type_id" AS "fuel_type_id",
      "source"."provision_of_the_act_id" AS "provision_of_the_act_id",
      "source"."end_use_id" AS "end_use_id",
      "source"."create_date" AS "create_date",
      "source"."update_date" AS "update_date",
      "source"."create_user" AS "create_user",
      "source"."update_user" AS "update_user",
      "source"."group_uuid" AS "group_uuid",
      "source"."version" AS "version",
      "source"."action_type" AS "action_type",
      "source"."q1_quantity" AS "q1_quantity",
      "source"."q2_quantity" AS "q2_quantity",
      "source"."q3_quantity" AS "q3_quantity",
      "source"."q4_quantity" AS "q4_quantity",
      "source"."Latest Fuel Supply per Group - Version__group_uuid" AS "Latest Fuel Supply per Group - Version__group_uuid",
      "source"."Latest Fuel Supply per Group - Version__max" AS "Latest Fuel Supply per Group - Version__max",
      "Compliance Report groups - Compliance Report"."compliance_report_id" AS "Compliance Report groups - Compliance Report__compl_07c52e81",
      "Compliance Report groups - Compliance Report"."compliance_report_group_uuid" AS "Compliance Report groups - Compliance Report__compl_a1e6d749",
      "Compliance Report groups - Compliance Report"."version" AS "Compliance Report groups - Compliance Report__version",
      "Compliance Report groups - Compliance Report"."compliance_period" AS "Compliance Report groups - Compliance Report__compl_127e8174",
      "Compliance Report groups - Compliance Report"."organization_name" AS "Compliance Report groups - Compliance Report__organ_5cf42f45",
      "Compliance Report groups - Compliance Report"."report_status" AS "Compliance Report groups - Compliance Report__report_status"
    FROM
      (
        SELECT
          "public"."fuel_supply"."fuel_supply_id" AS "fuel_supply_id",
          "public"."fuel_supply"."compliance_report_id" AS "compliance_report_id",
          "public"."fuel_supply"."quantity" AS "quantity",
          "public"."fuel_supply"."units" AS "units",
          "public"."fuel_supply"."compliance_units" AS "compliance_units",
          "public"."fuel_supply"."target_ci" AS "target_ci",
          "public"."fuel_supply"."ci_of_fuel" AS "ci_of_fuel",
          "public"."fuel_supply"."energy_density" AS "energy_density",
          "public"."fuel_supply"."eer" AS "eer",
          "public"."fuel_supply"."uci" AS "uci",
          "public"."fuel_supply"."energy" AS "energy",
          "public"."fuel_supply"."fuel_type_other" AS "fuel_type_other",
          "public"."fuel_supply"."fuel_category_id" AS "fuel_category_id",
          "public"."fuel_supply"."fuel_code_id" AS "fuel_code_id",
          "public"."fuel_supply"."fuel_type_id" AS "fuel_type_id",
          "public"."fuel_supply"."provision_of_the_act_id" AS "provision_of_the_act_id",
          "public"."fuel_supply"."end_use_id" AS "end_use_id",
          "public"."fuel_supply"."create_date" AS "create_date",
          "public"."fuel_supply"."update_date" AS "update_date",
          "public"."fuel_supply"."create_user" AS "create_user",
          "public"."fuel_supply"."update_user" AS "update_user",
          "public"."fuel_supply"."group_uuid" AS "group_uuid",
          "public"."fuel_supply"."version" AS "version",
          "public"."fuel_supply"."action_type" AS "action_type",
          "public"."fuel_supply"."q1_quantity" AS "q1_quantity",
          "public"."fuel_supply"."q2_quantity" AS "q2_quantity",
          "public"."fuel_supply"."q3_quantity" AS "q3_quantity",
          "public"."fuel_supply"."q4_quantity" AS "q4_quantity",
          "Latest Fuel Supply per Group - Version"."group_uuid" AS "Latest Fuel Supply per Group - Version__group_uuid",
          "Latest Fuel Supply per Group - Version"."max" AS "Latest Fuel Supply per Group - Version__max"
        FROM
          "public"."fuel_supply"
          INNER JOIN (
            SELECT
              "public"."fuel_supply"."group_uuid" AS "group_uuid",
              MAX("public"."fuel_supply"."version") AS "max"
            FROM
              "public"."fuel_supply"
           
GROUP BY
              "public"."fuel_supply"."group_uuid"
           
ORDER BY
              "public"."fuel_supply"."group_uuid" ASC
          ) AS "Latest Fuel Supply per Group - Version" ON (
            "public"."fuel_supply"."group_uuid" = "Latest Fuel Supply per Group - Version"."group_uuid"
          )
         
   AND (
            "public"."fuel_supply"."version" = "Latest Fuel Supply per Group - Version"."max"
          )
       
WHERE
          "public"."fuel_supply"."action_type" = CAST('CREATE' AS "actiontypeenum")
      ) AS "source"
     
LEFT JOIN (
        SELECT
          "source"."compliance_report_id" AS "compliance_report_id",
          "source"."compliance_report_group_uuid" AS "compliance_report_group_uuid",
          "source"."version" AS "version",
          "source"."compliance_period" AS "compliance_period",
          "source"."organization_name" AS "organization_name",
          "source"."report_status" AS "report_status",
          "Compliance Report - Compliance Report Group UUID"."compliance_report_id" AS "Compliance Report - Compliance Report Group UUID__c_e4dbf381",
          "Compliance Report - Compliance Report Group UUID"."transaction_id" AS "Compliance Report - Compliance Report Group UUID__t_91b14a03",
          "Compliance Report - Compliance Report Group UUID"."legacy_id" AS "Compliance Report - Compliance Report Group UUID__legacy_id",
          "Compliance Report - Compliance Report Group UUID"."version" AS "Compliance Report - Compliance Report Group UUID__version",
          "Compliance Report - Compliance Report Group UUID"."supplemental_initiator" AS "Compliance Report - Compliance Report Group UUID__s_7c2696a2",
          "Compliance Report - Compliance Report Group UUID"."current_status_id" AS "Compliance Report - Compliance Report Group UUID__c_bc51a06b"
        FROM
          (
            SELECT
              "public"."v_compliance_report"."compliance_report_id" AS "compliance_report_id",
              "public"."v_compliance_report"."compliance_report_group_uuid" AS "compliance_report_group_uuid",
              "public"."v_compliance_report"."version" AS "version",
              "public"."v_compliance_report"."compliance_period_id" AS "compliance_period_id",
              "public"."v_compliance_report"."compliance_period" AS "compliance_period",
              "public"."v_compliance_report"."organization_id" AS "organization_id",
              "public"."v_compliance_report"."organization_name" AS "organization_name",
              "public"."v_compliance_report"."report_type" AS "report_type",
              "public"."v_compliance_report"."report_status_id" AS "report_status_id",
              "public"."v_compliance_report"."report_status" AS "report_status",
              "public"."v_compliance_report"."update_date" AS "update_date",
              "public"."v_compliance_report"."supplemental_initiator" AS "supplemental_initiator"
            FROM
              "public"."v_compliance_report"
            WHERE
              (
                "public"."v_compliance_report"."report_status" <> CAST('Draft' AS "compliancereportstatusenum")
              )
             
    OR (
                "public"."v_compliance_report"."report_status" IS NULL
              )
          ) AS "source"
          INNER JOIN "public"."compliance_report" AS "Compliance Report - Compliance Report Group UUID" ON "source"."compliance_report_group_uuid" = "Compliance Report - Compliance Report Group UUID"."compliance_report_group_uuid"
      ) AS "Compliance Report groups - Compliance Report" ON "Compliance Report groups - Compliance Report"."compliance_report_id" = "Compliance Report groups - Compliance Report"."Compliance Report - Compliance Report Group UUID__c_e4dbf381";
 -- Grant SELECT privileges to the reporting role
GRANT SELECT ON public.vw_compliance_report_fuel_supply_data TO basic_lcfs_reporting_role;