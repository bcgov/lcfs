-- Script to create compliance report shells for historical transactions (2013-2018)
-- These transactions exist but don't have associated compliance reports
-- Handles multiple transactions per org/year with proper versioning

-- Step 1: Identify orphaned transactions and assign version numbers
WITH orphaned_transactions AS (
    SELECT 
        t.transaction_id,
        t.organization_id,
        t.effective_date,
        EXTRACT(YEAR FROM t.effective_date) as year,
        CASE 
            WHEN EXTRACT(YEAR FROM t.effective_date) = 2013 THEN 4
            WHEN EXTRACT(YEAR FROM t.effective_date) = 2014 THEN 5
            WHEN EXTRACT(YEAR FROM t.effective_date) = 2015 THEN 6
            WHEN EXTRACT(YEAR FROM t.effective_date) = 2016 THEN 7
            WHEN EXTRACT(YEAR FROM t.effective_date) = 2017 THEN 8
            WHEN EXTRACT(YEAR FROM t.effective_date) = 2018 THEN 9
        END as compliance_period_id,
        ROW_NUMBER() OVER (
            PARTITION BY t.organization_id, EXTRACT(YEAR FROM t.effective_date) 
            ORDER BY t.effective_date, t.transaction_id
        ) - 1 as version_number  -- Start from 0 for Original Report
    FROM transaction t
    LEFT JOIN compliance_report cr ON t.transaction_id = cr.transaction_id
    LEFT JOIN admin_adjustment aa ON t.transaction_id = aa.transaction_id
    LEFT JOIN initiative_agreement ia ON t.transaction_id = ia.transaction_id
    LEFT JOIN transfer tr1 ON t.transaction_id = tr1.from_transaction_id
    LEFT JOIN transfer tr2 ON t.transaction_id = tr2.to_transaction_id
    WHERE EXTRACT(YEAR FROM t.effective_date) BETWEEN 2013 AND 2018
      AND cr.transaction_id IS NULL 
      AND aa.transaction_id IS NULL 
      AND ia.transaction_id IS NULL 
      AND tr1.from_transaction_id IS NULL 
      AND tr2.to_transaction_id IS NULL
),
-- Step 2: Create one compliance report per transaction with proper versioning
new_compliance_reports AS (
    INSERT INTO compliance_report (
        compliance_period_id,
        organization_id,
        transaction_id,
        current_status_id,
        compliance_report_group_uuid,
        version,
        reporting_frequency,
        nickname,
        supplemental_initiator,
        create_user,
        update_user
    )
    SELECT 
        ot.compliance_period_id,
        ot.organization_id,
        ot.transaction_id,
        5, -- Assessed status for historical records
        COALESCE(
            (SELECT compliance_report_group_uuid 
             FROM compliance_report cr2 
             WHERE cr2.organization_id = ot.organization_id 
               AND cr2.compliance_period_id = ot.compliance_period_id 
             LIMIT 1),
            gen_random_uuid()::varchar(36)
        ), -- Use existing group UUID if available, otherwise generate new one
        ot.version_number,
        'ANNUAL',
        CASE 
            WHEN ot.version_number = 0 THEN 'Original Report'
            ELSE 'Supplemental Report ' || ot.version_number
        END,
        CASE 
            WHEN ot.version_number = 0 THEN NULL
            ELSE 'GOVERNMENT_REASSESSMENT'::supplementalinitiatortype
        END,
        'system_migration',
        'system_migration'
    FROM orphaned_transactions ot
    RETURNING compliance_report_id, organization_id, compliance_period_id, transaction_id, version, nickname
),
-- Step 3: Create organization snapshots for each new compliance report
new_organization_snapshots AS (
    INSERT INTO compliance_report_organization_snapshot (
        compliance_report_id,
        name,
        operating_name,
        email,
        phone,
        service_address,
        head_office_address,
        records_address,
        is_edited,
        create_user,
        update_user
    )
    SELECT 
        ncr.compliance_report_id,
        o.name,
        o.operating_name,
        o.email,
        o.phone,
        COALESCE(addr1.street_address || ', ' || addr1.city || ', ' || addr1.province_state || ' ' || addr1."postalCode_zipCode", 'N/A') as service_address,
        COALESCE(addr2.street_address || ', ' || addr2.city || ', ' || addr2.province_state || ' ' || addr2."postalCode_zipCode", 'N/A') as head_office_address,
        o.records_address,
        false, -- Not edited
        'system_migration',
        'system_migration'
    FROM new_compliance_reports ncr
    JOIN organization o ON ncr.organization_id = o.organization_id
    LEFT JOIN organization_address addr1 ON o.organization_address_id = addr1.organization_address_id
    LEFT JOIN organization_address addr2 ON o.organization_attorney_address_id = addr2.organization_address_id
    RETURNING organization_snapshot_id, compliance_report_id
),
-- Step 4: Create compliance_report_summary records for each new compliance report
new_summaries AS (
    INSERT INTO compliance_report_summary (
        compliance_report_id,
        is_locked,
        line_1_fossil_derived_base_fuel_gasoline,
        line_1_fossil_derived_base_fuel_diesel,
        line_1_fossil_derived_base_fuel_jet_fuel,
        line_2_eligible_renewable_fuel_supplied_gasoline,
        line_2_eligible_renewable_fuel_supplied_diesel,
        line_2_eligible_renewable_fuel_supplied_jet_fuel,
        line_3_total_tracked_fuel_supplied_gasoline,
        line_3_total_tracked_fuel_supplied_diesel,
        line_3_total_tracked_fuel_supplied_jet_fuel,
        line_4_eligible_renewable_fuel_required_gasoline,
        line_4_eligible_renewable_fuel_required_diesel,
        line_4_eligible_renewable_fuel_required_jet_fuel,
        line_5_net_notionally_transferred_gasoline,
        line_5_net_notionally_transferred_diesel,
        line_5_net_notionally_transferred_jet_fuel,
        line_6_renewable_fuel_retained_gasoline,
        line_6_renewable_fuel_retained_diesel,
        line_6_renewable_fuel_retained_jet_fuel,
        line_7_previously_retained_gasoline,
        line_7_previously_retained_diesel,
        line_7_previously_retained_jet_fuel,
        line_8_obligation_deferred_gasoline,
        line_8_obligation_deferred_diesel,
        line_8_obligation_deferred_jet_fuel,
        line_9_obligation_added_gasoline,
        line_9_obligation_added_diesel,
        line_9_obligation_added_jet_fuel,
        line_10_net_renewable_fuel_supplied_gasoline,
        line_10_net_renewable_fuel_supplied_diesel,
        line_10_net_renewable_fuel_supplied_jet_fuel,
        line_12_low_carbon_fuel_required,
        line_13_low_carbon_fuel_supplied,
        line_14_low_carbon_fuel_surplus,
        line_15_banked_units_used,
        line_16_banked_units_remaining,
        line_17_non_banked_units_used,
        line_18_units_to_be_banked,
        line_19_units_to_be_exported,
        line_20_surplus_deficit_units,
        line_21_surplus_deficit_ratio,
        line_22_compliance_units_issued,
        line_11_fossil_derived_base_fuel_gasoline,
        line_11_fossil_derived_base_fuel_diesel,
        line_11_fossil_derived_base_fuel_jet_fuel,
        line_11_fossil_derived_base_fuel_total,
        line_21_non_compliance_penalty_payable,
        total_non_compliance_penalty_payable,
        create_user,
        update_user
    )
    SELECT 
        ncr.compliance_report_id,
        true, -- Lock these historical reports
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -- All fuel lines set to 0
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -- All calculation lines set to 0
        'system_migration',
        'system_migration'
    FROM new_compliance_reports ncr
    RETURNING summary_id, compliance_report_id
)
-- Show what was created
SELECT 
    ncr.organization_id,
    o.name as organization_name,
    cp.description as year,
    ncr.version,
    ncr.nickname,
    t.compliance_units,
    t.effective_date,
    ncr.compliance_report_id,
    nos.organization_snapshot_id
FROM new_compliance_reports ncr
JOIN organization o ON ncr.organization_id = o.organization_id
JOIN compliance_period cp ON ncr.compliance_period_id = cp.compliance_period_id
JOIN transaction t ON ncr.transaction_id = t.transaction_id
JOIN new_organization_snapshots nos ON ncr.compliance_report_id = nos.compliance_report_id
ORDER BY ncr.organization_id, cp.description, ncr.version;