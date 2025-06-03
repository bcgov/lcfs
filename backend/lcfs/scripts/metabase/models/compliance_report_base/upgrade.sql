-- Create Transfer Summary View
CREATE OR REPLACE VIEW public.vw_compliance_report_base AS
SELECT
      "public"."compliance_report"."compliance_report_id" AS "compliance_report_id",
      "public"."compliance_report"."compliance_period_id" AS "compliance_period_id",
      "public"."compliance_report"."organization_id" AS "organization_id",
      "public"."compliance_report"."current_status_id" AS "current_status_id",
      "public"."compliance_report"."transaction_id" AS "transaction_id",
      "public"."compliance_report"."compliance_report_group_uuid" AS "compliance_report_group_uuid",
      "public"."compliance_report"."legacy_id" AS "legacy_id",
      "public"."compliance_report"."version" AS "version",
      "public"."compliance_report"."supplemental_initiator" AS "supplemental_initiator",
      "public"."compliance_report"."reporting_frequency" AS "reporting_frequency",
      "public"."compliance_report"."nickname" AS "nickname",
      "public"."compliance_report"."supplemental_note" AS "supplemental_note",
      "public"."compliance_report"."create_date" AS "create_date",
      "public"."compliance_report"."update_date" AS "update_date",
      "public"."compliance_report"."create_user" AS "create_user",
      "public"."compliance_report"."update_user" AS "update_user",
      "public"."compliance_report"."assessment_statement" AS "assessment_statement",
      CASE
        WHEN "Compliance Report Summary - Compliance Report"."line_11_fossil_derived_base_fuel_total" > 0 THEN 'Not Met'
        ELSE 'Met'
      END AS "Renewable Requirements",
      CASE
        WHEN "Compliance Report Summary - Compliance Report"."line_21_non_compliance_penalty_payable" > 0 THEN 'Not Met'
        ELSE 'Met'
      END AS "Low Carbon Requirements",
      "Compliance Period"."compliance_period_id" AS "Compliance Period__compliance_period_id",
      "Compliance Period"."description" AS "Compliance Period__description",
      "Compliance Period"."display_order" AS "Compliance Period__display_order",
      "Compliance Period"."create_date" AS "Compliance Period__create_date",
      "Compliance Period"."update_date" AS "Compliance Period__update_date",
      "Compliance Period"."effective_date" AS "Compliance Period__effective_date",
      "Compliance Period"."effective_status" AS "Compliance Period__effective_status",
      "Compliance Period"."expiration_date" AS "Compliance Period__expiration_date",
      "Compliance Report Status - Current Status"."compliance_report_status_id" AS "Compliance Report Status - Current Status__complian_8aca39b7",
      "Compliance Report Status - Current Status"."display_order" AS "Compliance Report Status - Current Status__display_order",
      "Compliance Report Status - Current Status"."status" AS "Compliance Report Status - Current Status__status",
      "Compliance Report Status - Current Status"."create_date" AS "Compliance Report Status - Current Status__create_date",
      "Compliance Report Status - Current Status"."update_date" AS "Compliance Report Status - Current Status__update_date",
      "Compliance Report Status - Current Status"."effective_date" AS "Compliance Report Status - Current Status__effective_date",
      "Compliance Report Status - Current Status"."effective_status" AS "Compliance Report Status - Current Status__effective_status",
      "Compliance Report Status - Current Status"."expiration_date" AS "Compliance Report Status - Current Status__expiration_date",
      "Compliance Report Summary - Compliance Report"."summary_id" AS "Compliance Report Summary - Compliance Report__summary_id",
      "Compliance Report Summary - Compliance Report"."compliance_report_id" AS "Compliance Report Summary - Compliance Report__comp_1db2e1e9",
      "Compliance Report Summary - Compliance Report"."quarter" AS "Compliance Report Summary - Compliance Report__quarter",
      "Compliance Report Summary - Compliance Report"."is_locked" AS "Compliance Report Summary - Compliance Report__is_locked",
      "Compliance Report Summary - Compliance Report"."line_1_fossil_derived_base_fuel_gasoline" AS "Compliance Report Summary - Compliance Report__line_2c0818fb",
      "Compliance Report Summary - Compliance Report"."line_1_fossil_derived_base_fuel_diesel" AS "Compliance Report Summary - Compliance Report__line_2ff66c5b",
      "Compliance Report Summary - Compliance Report"."line_1_fossil_derived_base_fuel_jet_fuel" AS "Compliance Report Summary - Compliance Report__line_1fcf7a18",
      "Compliance Report Summary - Compliance Report"."line_2_eligible_renewable_fuel_supplied_gasoline" AS "Compliance Report Summary - Compliance Report__line_d70f8aef",
      "Compliance Report Summary - Compliance Report"."line_2_eligible_renewable_fuel_supplied_diesel" AS "Compliance Report Summary - Compliance Report__line_2773c83c",
      "Compliance Report Summary - Compliance Report"."line_2_eligible_renewable_fuel_supplied_jet_fuel" AS "Compliance Report Summary - Compliance Report__line_e4c8e80c",
      "Compliance Report Summary - Compliance Report"."line_3_total_tracked_fuel_supplied_gasoline" AS "Compliance Report Summary - Compliance Report__line_9cec896d",
      "Compliance Report Summary - Compliance Report"."line_3_total_tracked_fuel_supplied_diesel" AS "Compliance Report Summary - Compliance Report__line_489bea32",
      "Compliance Report Summary - Compliance Report"."line_3_total_tracked_fuel_supplied_jet_fuel" AS "Compliance Report Summary - Compliance Report__line_af2beb8e",
      "Compliance Report Summary - Compliance Report"."line_4_eligible_renewable_fuel_required_gasoline" AS "Compliance Report Summary - Compliance Report__line_a26a000d",
      "Compliance Report Summary - Compliance Report"."line_4_eligible_renewable_fuel_required_diesel" AS "Compliance Report Summary - Compliance Report__line_0ef43e75",
      "Compliance Report Summary - Compliance Report"."line_4_eligible_renewable_fuel_required_jet_fuel" AS "Compliance Report Summary - Compliance Report__line_91ad62ee",
      "Compliance Report Summary - Compliance Report"."line_5_net_notionally_transferred_gasoline" AS "Compliance Report Summary - Compliance Report__line_b1027537",
      "Compliance Report Summary - Compliance Report"."line_5_net_notionally_transferred_diesel" AS "Compliance Report Summary - Compliance Report__line_38be33f3",
      "Compliance Report Summary - Compliance Report"."line_5_net_notionally_transferred_jet_fuel" AS "Compliance Report Summary - Compliance Report__line_82c517d4",
      "Compliance Report Summary - Compliance Report"."line_6_renewable_fuel_retained_gasoline" AS "Compliance Report Summary - Compliance Report__line_6927f733",
      "Compliance Report Summary - Compliance Report"."line_6_renewable_fuel_retained_diesel" AS "Compliance Report Summary - Compliance Report__line_93d805cb",
      "Compliance Report Summary - Compliance Report"."line_6_renewable_fuel_retained_jet_fuel" AS "Compliance Report Summary - Compliance Report__line_5ae095d0",
      "Compliance Report Summary - Compliance Report"."line_7_previously_retained_gasoline" AS "Compliance Report Summary - Compliance Report__line_157d6973",
      "Compliance Report Summary - Compliance Report"."line_7_previously_retained_diesel" AS "Compliance Report Summary - Compliance Report__line_31fd1f1b",
      "Compliance Report Summary - Compliance Report"."line_7_previously_retained_jet_fuel" AS "Compliance Report Summary - Compliance Report__line_26ba0b90",
      "Compliance Report Summary - Compliance Report"."line_8_obligation_deferred_gasoline" AS "Compliance Report Summary - Compliance Report__line_27419684",
      "Compliance Report Summary - Compliance Report"."line_8_obligation_deferred_diesel" AS "Compliance Report Summary - Compliance Report__line_ac263897",
      "Compliance Report Summary - Compliance Report"."line_8_obligation_deferred_jet_fuel" AS "Compliance Report Summary - Compliance Report__line_1486f467",
      "Compliance Report Summary - Compliance Report"."line_9_obligation_added_gasoline" AS "Compliance Report Summary - Compliance Report__line_c12cb8c0",
      "Compliance Report Summary - Compliance Report"."line_9_obligation_added_diesel" AS "Compliance Report Summary - Compliance Report__line_05eb459f",
      "Compliance Report Summary - Compliance Report"."line_9_obligation_added_jet_fuel" AS "Compliance Report Summary - Compliance Report__line_f2ebda23",
      "Compliance Report Summary - Compliance Report"."line_10_net_renewable_fuel_supplied_gasoline" AS "Compliance Report Summary - Compliance Report__line_1be763e7",
      "Compliance Report Summary - Compliance Report"."line_10_net_renewable_fuel_supplied_diesel" AS "Compliance Report Summary - Compliance Report__line_b72177b0",
      "Compliance Report Summary - Compliance Report"."line_10_net_renewable_fuel_supplied_jet_fuel" AS "Compliance Report Summary - Compliance Report__line_28200104",
      "Compliance Report Summary - Compliance Report"."line_11_non_compliance_penalty_gasoline" AS "Compliance Report Summary - Compliance Report__line_53735f1d",
      "Compliance Report Summary - Compliance Report"."line_11_non_compliance_penalty_diesel" AS "Compliance Report Summary - Compliance Report__line_64a07c80",
      "Compliance Report Summary - Compliance Report"."line_11_non_compliance_penalty_jet_fuel" AS "Compliance Report Summary - Compliance Report__line_60b43dfe",
      "Compliance Report Summary - Compliance Report"."line_12_low_carbon_fuel_required" AS "Compliance Report Summary - Compliance Report__line_da2710ad",
      "Compliance Report Summary - Compliance Report"."line_13_low_carbon_fuel_supplied" AS "Compliance Report Summary - Compliance Report__line_b25fca1c",
      "Compliance Report Summary - Compliance Report"."line_14_low_carbon_fuel_surplus" AS "Compliance Report Summary - Compliance Report__line_4b98033f",
      "Compliance Report Summary - Compliance Report"."line_15_banked_units_used" AS "Compliance Report Summary - Compliance Report__line_1d7d6a31",
      "Compliance Report Summary - Compliance Report"."line_16_banked_units_remaining" AS "Compliance Report Summary - Compliance Report__line_684112bb",
      "Compliance Report Summary - Compliance Report"."line_17_non_banked_units_used" AS "Compliance Report Summary - Compliance Report__line_b1d3ad5e",
      "Compliance Report Summary - Compliance Report"."line_18_units_to_be_banked" AS "Compliance Report Summary - Compliance Report__line_e173956e",
      "Compliance Report Summary - Compliance Report"."line_19_units_to_be_exported" AS "Compliance Report Summary - Compliance Report__line_9a885574",
      "Compliance Report Summary - Compliance Report"."line_20_surplus_deficit_units" AS "Compliance Report Summary - Compliance Report__line_8e71546f",
      "Compliance Report Summary - Compliance Report"."line_21_surplus_deficit_ratio" AS "Compliance Report Summary - Compliance Report__line_00d2728d",
      "Compliance Report Summary - Compliance Report"."line_22_compliance_units_issued" AS "Compliance Report Summary - Compliance Report__line_29d9cb9c",
      "Compliance Report Summary - Compliance Report"."line_11_fossil_derived_base_fuel_gasoline" AS "Compliance Report Summary - Compliance Report__line_d8942234",
      "Compliance Report Summary - Compliance Report"."line_11_fossil_derived_base_fuel_diesel" AS "Compliance Report Summary - Compliance Report__line_125e31fc",
      "Compliance Report Summary - Compliance Report"."line_11_fossil_derived_base_fuel_jet_fuel" AS "Compliance Report Summary - Compliance Report__line_eb5340d7",
      "Compliance Report Summary - Compliance Report"."line_11_fossil_derived_base_fuel_total" AS "Compliance Report Summary - Compliance Report__line_bff5157d",
      "Compliance Report Summary - Compliance Report"."line_21_non_compliance_penalty_payable" AS "Compliance Report Summary - Compliance Report__line_7c9c21b1",
      "Compliance Report Summary - Compliance Report"."total_non_compliance_penalty_payable" AS "Compliance Report Summary - Compliance Report__tota_0e1e6fb3",
      "Compliance Report Summary - Compliance Report"."credits_offset_a" AS "Compliance Report Summary - Compliance Report__cred_0f455db6",
      "Compliance Report Summary - Compliance Report"."credits_offset_b" AS "Compliance Report Summary - Compliance Report__cred_964c0c0c",
      "Compliance Report Summary - Compliance Report"."credits_offset_c" AS "Compliance Report Summary - Compliance Report__cred_e14b3c9a",
      "Compliance Report Summary - Compliance Report"."create_date" AS "Compliance Report Summary - Compliance Report__create_date",
      "Compliance Report Summary - Compliance Report"."update_date" AS "Compliance Report Summary - Compliance Report__update_date",
      "Compliance Report Summary - Compliance Report"."create_user" AS "Compliance Report Summary - Compliance Report__create_user",
      "Compliance Report Summary - Compliance Report"."update_user" AS "Compliance Report Summary - Compliance Report__update_user",
      "Compliance Report Summary - Compliance Report"."early_issuance_credits_q1" AS "Compliance Report Summary - Compliance Report__earl_6d4994a4",
      "Compliance Report Summary - Compliance Report"."early_issuance_credits_q2" AS "Compliance Report Summary - Compliance Report__earl_f440c51e",
      "Compliance Report Summary - Compliance Report"."early_issuance_credits_q3" AS "Compliance Report Summary - Compliance Report__earl_8347f588",
      "Compliance Report Summary - Compliance Report"."early_issuance_credits_q4" AS "Compliance Report Summary - Compliance Report__earl_1d23602b",
      "Transaction"."transaction_id" AS "Transaction__transaction_id",
      "Transaction"."compliance_units" AS "Transaction__compliance_units",
      "Transaction"."organization_id" AS "Transaction__organization_id",
      "Transaction"."transaction_action" AS "Transaction__transaction_action",
      "Transaction"."create_date" AS "Transaction__create_date",
      "Transaction"."update_date" AS "Transaction__update_date",
      "Transaction"."create_user" AS "Transaction__create_user",
      "Transaction"."update_user" AS "Transaction__update_user",
      "Transaction"."effective_date" AS "Transaction__effective_date",
      "Transaction"."effective_status" AS "Transaction__effective_status",
      "Transaction"."expiration_date" AS "Transaction__expiration_date",
      "Organization"."organization_id" AS "Organization__organization_id",
      "Organization"."organization_code" AS "Organization__organization_code",
      "Organization"."name" AS "Organization__name",
      "Organization"."operating_name" AS "Organization__operating_name",
      "Organization"."email" AS "Organization__email",
      "Organization"."phone" AS "Organization__phone",
      "Organization"."edrms_record" AS "Organization__edrms_record",
      "Organization"."total_balance" AS "Organization__total_balance",
      "Organization"."reserved_balance" AS "Organization__reserved_balance",
      "Organization"."count_transfers_in_progress" AS "Organization__count_transfers_in_progress",
      "Organization"."organization_status_id" AS "Organization__organization_status_id",
      "Organization"."organization_type_id" AS "Organization__organization_type_id",
      "Organization"."organization_address_id" AS "Organization__organization_address_id",
      "Organization"."organization_attorney_address_id" AS "Organization__organization_attorney_address_id",
      "Organization"."create_date" AS "Organization__create_date",
      "Organization"."update_date" AS "Organization__update_date",
      "Organization"."create_user" AS "Organization__create_user",
      "Organization"."update_user" AS "Organization__update_user",
      "Organization"."effective_date" AS "Organization__effective_date",
      "Organization"."effective_status" AS "Organization__effective_status",
      "Organization"."expiration_date" AS "Organization__expiration_date",
      "Organization"."has_early_issuance" AS "Organization__has_early_issuance",
      "Organization"."records_address" AS "Organization__records_address",
      "Compliance Reports Chained - Compliance Report Group UUID"."group_uuid" AS "Compliance Reports Chained - Compliance Report Grou_1a77e4cb",
      "Compliance Reports Chained - Compliance Report Group UUID"."max_version" AS "Compliance Reports Chained - Compliance Report Grou_480bb7b1"
    FROM
      "public"."compliance_report"
      INNER JOIN "public"."compliance_period" AS "Compliance Period" ON "public"."compliance_report"."compliance_period_id" = "Compliance Period"."compliance_period_id"
      INNER JOIN "public"."compliance_report_status" AS "Compliance Report Status - Current Status" ON "public"."compliance_report"."current_status_id" = "Compliance Report Status - Current Status"."compliance_report_status_id"
      INNER JOIN "public"."compliance_report_summary" AS "Compliance Report Summary - Compliance Report" ON "public"."compliance_report"."compliance_report_id" = "Compliance Report Summary - Compliance Report"."compliance_report_id"
     
LEFT JOIN "public"."transaction" AS "Transaction" ON "public"."compliance_report"."transaction_id" = "Transaction"."transaction_id"
      LEFT JOIN "public"."organization" AS "Organization" ON "public"."compliance_report"."organization_id" = "Organization"."organization_id"
      INNER JOIN (
        SELECT
          compliance_report_group_uuid AS group_uuid,
          max(VERSION) AS max_version
        FROM
          COMPLIANCE_REPORT
       
GROUP BY
          COMPLIANCE_REPORT.compliance_report_group_uuid
      ) AS "Compliance Reports Chained - Compliance Report Group UUID" ON (
        "public"."compliance_report"."compliance_report_group_uuid" = "Compliance Reports Chained - Compliance Report Group UUID"."group_uuid"
      )
     
   AND (
        "public"."compliance_report"."version" = "Compliance Reports Chained - Compliance Report Group UUID"."max_version"
      );

-- Grant SELECT privileges to the reporting role
GRANT SELECT ON public.vw_compliance_report_base TO basic_lcfs_reporting_role;