/*
Migrate Orphaned Allocation Agreements from TFRS to LCFS

Overview:
1. Identify TFRS compliance reports marked as 'exclusion reports' that do not have a
   corresponding 'main' compliance report in the same compliance period/organization.
2. For each orphaned TFRS exclusion report:
    a. Check if an LCFS compliance report with legacy_id = TFRS report ID already exists.
    b. If not, create a new minimal LCFS compliance report (type='Supplemental', status='Draft').
    c. Fetch the allocation agreement records linked to the TFRS exclusion_agreement_id.
    d. Insert these records into LCFS allocation_agreement, linked to the new LCFS report.
*/

import groovy.transform.Field
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.util.UUID

// -------------------------
// Controller Service Lookups
// -------------------------
def sourceDbcpService = context.controllerServiceLookup.getControllerService('3245b078-0192-1000-ffff-ffffba20c1eb')
def destinationDbcpService = context.controllerServiceLookup.getControllerService('3244bf63-0192-1000-ffff-ffffc8ec6d93')

// -------------------------
// Global Field Declarations & Query Strings
// -------------------------
@Field Map<Integer, String> recordUuidMap = [:] // Maps TFRS allocation agreement record ID to a stable group UUID

// Query to find TFRS exclusion reports without a sibling report, including director status
@Field String SELECT_ORPHANED_EXCLUSION_REPORTS_QUERY = '''
    SELECT
        cr_excl.id AS tfrs_exclusion_report_id,
        cr_excl.organization_id AS tfrs_organization_id,
        cr_excl.compliance_period_id AS tfrs_compliance_period_id,
        cr_excl.exclusion_agreement_id,
        ws.director_status_id AS tfrs_director_status -- Get the director status
    FROM compliance_report cr_excl
    JOIN compliance_report_workflow_state ws ON cr_excl.status_id = ws.id -- Join to get status
    WHERE cr_excl.exclusion_agreement_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM compliance_report cr_main
        WHERE cr_main.organization_id = cr_excl.organization_id
          AND cr_main.compliance_period_id = cr_excl.compliance_period_id
          AND cr_main.id != cr_excl.id
    );
'''

// Query to check if an LCFS report with a specific legacy_id exists
@Field String CHECK_LCFS_REPORT_EXISTS_QUERY = '''
    SELECT 1 FROM compliance_report WHERE legacy_id = ? LIMIT 1
'''

// Query to get TFRS organization name based on TFRS organization ID
@Field String SELECT_TFRS_ORG_NAME_QUERY = '''
    SELECT name FROM organization WHERE id = ? LIMIT 1
'''

// Query to get LCFS organization ID based on organization name
@Field String SELECT_LCFS_ORG_ID_QUERY = '''
    SELECT organization_id FROM organization WHERE name = ? LIMIT 1
'''

// Query to get TFRS compliance period description based on TFRS period ID
@Field String SELECT_TFRS_PERIOD_DESC_QUERY = '''
    SELECT description FROM compliance_period WHERE id = ? LIMIT 1
'''

// Query to get LCFS compliance period ID based on description
@Field String SELECT_LCFS_PERIOD_ID_QUERY = '''
    SELECT compliance_period_id FROM compliance_period WHERE description = ? LIMIT 1
'''

// Query to get LCFS compliance report status ID (e.g., for 'Draft')
@Field String SELECT_LCFS_REPORT_STATUS_ID_QUERY = '''
    SELECT compliance_report_status_id FROM compliance_report_status WHERE status = ?::compliancereportstatusenum LIMIT 1
'''

// Insert statement for the new minimal LCFS compliance report
// *** Placeholder: Adjust column names as needed ***
@Field String INSERT_LCFS_COMPLIANCE_REPORT_SQL = '''
    INSERT INTO compliance_report (
        organization_id, compliance_period_id, current_status_id, reporting_frequency,
        compliance_report_group_uuid, version, legacy_id, create_user, update_user,
        nickname
    ) VALUES (?, ?, ?, ?::reportingfrequency, ?, ?, ?, 'ETL', 'ETL', ?)
    RETURNING compliance_report_id;
'''

// Query to get allocation agreement records directly via exclusion_agreement_id
@Field String SELECT_ALLOCATION_RECORDS_BY_AGREEMENT_ID_QUERY = '''
    SELECT
        crear.id AS agreement_record_id,
        CASE WHEN tt.the_type = 'Purchased' THEN 'Allocated from' ELSE 'Allocated to' END AS responsibility,
        aft.name AS fuel_type,
        aft.id AS tfrs_fuel_type_id, -- Note: TFRS fuel type ID
        crear.transaction_partner,
        crear.postal_address,
        crear.quantity,
        uom.name AS units,
        crear.quantity_not_sold,
        tt.id AS transaction_type_id
    FROM compliance_report_exclusion_agreement_record crear
    INNER JOIN transaction_type tt ON crear.transaction_type_id = tt.id
    INNER JOIN approved_fuel_type aft ON crear.fuel_type_id = aft.id
    INNER JOIN unit_of_measure uom ON aft.unit_of_measure_id = uom.id
    WHERE crear.exclusion_agreement_id = ?
    ORDER BY crear.id;
'''

// --- Reusing logic from allocation_agreement.groovy ---
// To support versioning we check the current highest version for a given group_uuid.
@Field String SELECT_CURRENT_ALLOCATION_VERSION_QUERY = '''
    SELECT version FROM allocation_agreement WHERE group_uuid = ? ORDER BY version DESC LIMIT 1
'''

// INSERT statement for allocation_agreement.
@Field String INSERT_ALLOCATION_AGREEMENT_SQL = '''
    INSERT INTO allocation_agreement(
      compliance_report_id,
      transaction_partner,
      postal_address,
      quantity,
      quantity_not_sold,
      units,
      allocation_transaction_type_id,
      fuel_type_id,          -- LCFS Fuel Type ID
      fuel_category_id,      -- LCFS Fuel Category ID
      -- ci_of_fuel,         -- Not available from source
      -- provision_of_the_act_id, -- Not available from source
      -- fuel_code_id,       -- Not available from source
      group_uuid,
      version,
      action_type,
      create_user,
      update_user
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::actiontypeenum, ?, ?) -- Use placeholders for ETL users
'''

// --- Lookups ---
@Field Map<String, Integer> responsibilityToTransactionTypeCache = [:]
@Field String SELECT_LCFS_TRANSACTION_TYPE_ID_QUERY = '''
    SELECT allocation_transaction_type_id FROM allocation_transaction_type WHERE type = ?
'''

// @Field Map<Integer, Integer> tfrsFuelTypeToLcfsFuelTypeCache = [:] // Removed TFRS ID based cache
@Field Map<String, Integer> tfrsFuelNameToLcfsFuelTypeCache = [:] // Cache based on TFRS Fuel Name -> LCFS ID
@Field String SELECT_LCFS_FUEL_TYPE_ID_BY_NAME_QUERY = '''
    SELECT fuel_type_id FROM fuel_type WHERE fuel_type = ? -- Lookup by LCFS fuel_type name
'''

// Insert statement for default summary record (Corrected column/value count)
@Field String INSERT_LCFS_SUMMARY_SQL = '''
    INSERT INTO compliance_report_summary (
        compliance_report_id, quarter, is_locked,
        line_1_fossil_derived_base_fuel_gasoline, line_1_fossil_derived_base_fuel_diesel, line_1_fossil_derived_base_fuel_jet_fuel,
        line_2_eligible_renewable_fuel_supplied_gasoline, line_2_eligible_renewable_fuel_supplied_diesel, line_2_eligible_renewable_fuel_supplied_jet_fuel,
        line_3_total_tracked_fuel_supplied_gasoline, line_3_total_tracked_fuel_supplied_diesel, line_3_total_tracked_fuel_supplied_jet_fuel,
        line_4_eligible_renewable_fuel_required_gasoline, line_4_eligible_renewable_fuel_required_diesel, line_4_eligible_renewable_fuel_required_jet_fuel,
        line_5_net_notionally_transferred_gasoline, line_5_net_notionally_transferred_diesel, line_5_net_notionally_transferred_jet_fuel,
        line_6_renewable_fuel_retained_gasoline, line_6_renewable_fuel_retained_diesel, line_6_renewable_fuel_retained_jet_fuel,
        line_7_previously_retained_gasoline, line_7_previously_retained_diesel, line_7_previously_retained_jet_fuel,
        line_8_obligation_deferred_gasoline, line_8_obligation_deferred_diesel, line_8_obligation_deferred_jet_fuel,
        line_9_obligation_added_gasoline, line_9_obligation_added_diesel, line_9_obligation_added_jet_fuel,
        line_10_net_renewable_fuel_supplied_gasoline, line_10_net_renewable_fuel_supplied_diesel, line_10_net_renewable_fuel_supplied_jet_fuel,
        line_11_non_compliance_penalty_gasoline, line_11_non_compliance_penalty_diesel, line_11_non_compliance_penalty_jet_fuel, -- Nullable penalties included
        line_12_low_carbon_fuel_required, line_13_low_carbon_fuel_supplied, line_14_low_carbon_fuel_surplus,
        line_15_banked_units_used, line_16_banked_units_remaining, line_17_non_banked_units_used,
        line_18_units_to_be_banked, line_19_units_to_be_exported, line_20_surplus_deficit_units, line_21_surplus_deficit_ratio,
        line_22_compliance_units_issued,
        line_11_fossil_derived_base_fuel_gasoline, line_11_fossil_derived_base_fuel_diesel, line_11_fossil_derived_base_fuel_jet_fuel, line_11_fossil_derived_base_fuel_total,
        line_21_non_compliance_penalty_payable, total_non_compliance_penalty_payable,
        create_user, update_user,
        early_issuance_credits_q1, early_issuance_credits_q2, early_issuance_credits_q3, early_issuance_credits_q4, historical_snapshot
    ) VALUES (
        ?, null, false, -- compliance_report_id, quarter, is_locked (3)
        -- Lines 1-10 (3*10 = 30 values)
        0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
        0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
        null, null, null, -- Line 11 nullable penalties (3)
        0.0, 0.0, 0.0, -- Lines 12-14 (3)
        0.0, 0.0, 0.0, -- Lines 15-17 (3)
        0.0, 0.0, 0.0, 0.0, -- Lines 18-21 ratio (4)
        0.0, -- Line 22 (1)
        0.0, 0.0, 0.0, 0.0, -- Line 11 fossil derived (renamed in schema?) (4)
        0.0, 0.0, -- Line 21 penalty payable, total (2)
        'ETL', 'ETL', -- users (2)
        null, null, null, null, null -- early issuance, historical snapshot (5)
    ) -- Total values: 3 + 30 + 3 + 3 + 3 + 4 + 1 + 4 + 2 + 2 + 5 = 60
'''

// Query to get LCFS organization details for snapshot
@Field String SELECT_LCFS_ORG_DETAILS_QUERY = '''
    SELECT
        org.name,
        org.operating_name,
        org.email,
        org.phone,
        org.records_address,
        addr.street_address,
        addr.address_other,
        addr.city,
        addr.province_state,
        addr.country,
        addr."postalCode_zipCode" -- Corrected camelCase column name (quoted)
    FROM organization org
    LEFT JOIN organization_address addr ON org.organization_address_id = addr.organization_address_id
    WHERE org.organization_id = ?
'''

// Insert statement for organization snapshot
@Field String INSERT_LCFS_ORG_SNAPSHOT_SQL = '''
    INSERT INTO compliance_report_organization_snapshot (
        compliance_report_id, name, operating_name, email, phone,
        service_address, head_office_address, records_address, is_edited,
        create_user, update_user
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ETL', 'ETL')
'''

@Field Integer GASOLINE_CATEGORY_ID = 1
@Field Integer DIESEL_CATEGORY_ID = 2
// -------------------------
// Helper Functions
// -------------------------

/**
 * Gets LCFS Org ID from TFRS Org Name.
 */
def getLcfsOrgId(Connection destConn, String tfrsOrgName) {
    if (!tfrsOrgName) {
        log.error("Cannot map LCFS organization ID from null TFRS organization name.")
        return null
    }
    PreparedStatement stmt = destConn.prepareStatement(SELECT_LCFS_ORG_ID_QUERY)
    stmt.setString(1, tfrsOrgName)
    ResultSet rs = stmt.executeQuery()
    Integer lcfsId = rs.next() ? rs.getInt("organization_id") : null
    rs.close()
    stmt.close()
    if (!lcfsId) {
        log.error("Could not find LCFS organization mapped to TFRS organization name: ${tfrsOrgName}")
    }
    return lcfsId
}

/**
 * Gets LCFS Period ID from TFRS Period Description.
 */
def getLcfsPeriodId(Connection destConn, String tfrsPeriodDesc) {
    if (!tfrsPeriodDesc) {
        log.error("Cannot map LCFS compliance period ID from null TFRS period description.")
        return null
    }
    PreparedStatement stmt = destConn.prepareStatement(SELECT_LCFS_PERIOD_ID_QUERY)
    stmt.setString(1, tfrsPeriodDesc)
    ResultSet rs = stmt.executeQuery()
    Integer lcfsId = rs.next() ? rs.getInt("compliance_period_id") : null
    rs.close()
    stmt.close()
    if (!lcfsId) {
        log.error("Could not find LCFS compliance period mapped to TFRS description: ${tfrsPeriodDesc}")
    }
    return lcfsId
}

/**
 * Gets LCFS Report Status ID by name.
 */
def getLcfsReportStatusId(Connection destConn, String statusName) {
    // Caching recommended for performance
    PreparedStatement stmt = destConn.prepareStatement(SELECT_LCFS_REPORT_STATUS_ID_QUERY)
    stmt.setString(1, statusName)
    ResultSet rs = stmt.executeQuery()
    Integer statusId = rs.next() ? rs.getInt("compliance_report_status_id") : null
    rs.close()
    stmt.close()
    if (!statusId) {
        log.error("Could not find LCFS compliance report status ID for status: ${statusName}")
    }
    return statusId
}

/**
 * Gets LCFS Transaction Type ID from TFRS Responsibility string.
 */
def getLcfsTransactionTypeId(Connection destConn, String responsibility) {
    if (responsibilityToTransactionTypeCache.containsKey(responsibility)) {
        return responsibilityToTransactionTypeCache[responsibility]
    }
    PreparedStatement stmt = destConn.prepareStatement(SELECT_LCFS_TRANSACTION_TYPE_ID_QUERY)
    stmt.setString(1, responsibility)
    ResultSet rs = stmt.executeQuery()
    Integer typeId = rs.next() ? rs.getInt("allocation_transaction_type_id") : null
    rs.close()
    stmt.close()
    if (typeId != null) {
        responsibilityToTransactionTypeCache[responsibility] = typeId
    } else {
        log.warn("No LCFS transaction type found for responsibility: ${responsibility}; returning null.")
    }
    return typeId
}

/**
 * Gets LCFS Fuel Type ID from TFRS Fuel Type Name.
 */
def getLcfsFuelTypeIdByName(Connection destConn, String tfrsFuelTypeName) {
     if (!tfrsFuelTypeName) {
        log.error("Cannot map LCFS fuel type ID from null TFRS fuel type name.")
        return null
     }
     if (tfrsFuelNameToLcfsFuelTypeCache.containsKey(tfrsFuelTypeName)) {
        return tfrsFuelNameToLcfsFuelTypeCache[tfrsFuelTypeName]
     }
    // Assumes TFRS fuel name (e.g., 'Biodiesel') matches LCFS fuel_type column value
    PreparedStatement stmt = destConn.prepareStatement(SELECT_LCFS_FUEL_TYPE_ID_BY_NAME_QUERY)
    stmt.setString(1, tfrsFuelTypeName)
    ResultSet rs = stmt.executeQuery()
    Integer lcfsId = rs.next() ? rs.getInt("fuel_type_id") : null
    rs.close()
    stmt.close()
    if (lcfsId != null) {
        tfrsFuelNameToLcfsFuelTypeCache[tfrsFuelTypeName] = lcfsId
    } else {
        log.warn("No LCFS fuel type found mapped for TFRS fuel type name: ${tfrsFuelTypeName}; returning null.")
    }
    return lcfsId
}

/**
 * Creates a minimal LCFS Compliance Report record, default summary, and org snapshot.
 */
def createLcfsPlaceholderReport(Connection destConn, Integer lcfsOrgId, Integer lcfsPeriodId, Integer statusId, String reportingFrequency, Integer tfrsLegacyId) {
    String groupUuid = UUID.randomUUID().toString()
    Integer version = 0 // Initial version
    Integer newLcfsReportId = null

    // 1. Create Compliance Report
    try {
        PreparedStatement stmt = destConn.prepareStatement(INSERT_LCFS_COMPLIANCE_REPORT_SQL)
        stmt.setInt(1, lcfsOrgId)
        stmt.setInt(2, lcfsPeriodId)
        stmt.setInt(3, statusId)
        stmt.setString(4, reportingFrequency)
        stmt.setString(5, groupUuid)
        stmt.setInt(6, version)
        stmt.setInt(7, tfrsLegacyId)
        stmt.setString(8, "Original Report") // Set nickname
        ResultSet rs = stmt.executeQuery()
        if (rs.next()) {
            newLcfsReportId = rs.getInt("compliance_report_id")
        }
        rs.close()
        stmt.close()

        if (newLcfsReportId) {
            log.info("Created placeholder LCFS compliance report ID: ${newLcfsReportId} for TFRS legacy ID: ${tfrsLegacyId}")
        } else {
            log.error("Failed to create placeholder LCFS compliance report for TFRS legacy ID: ${tfrsLegacyId}")
            return null // Stop if report creation failed
        }
    } catch (Exception e) {
        log.error("Exception creating placeholder LCFS compliance report for TFRS legacy ID: ${tfrsLegacyId}", e)
        return null
    }

    // 2. Create Default Summary Record
    try {
        PreparedStatement summaryStmt = destConn.prepareStatement(INSERT_LCFS_SUMMARY_SQL)
        summaryStmt.setInt(1, newLcfsReportId)
        summaryStmt.executeUpdate()
        summaryStmt.close()
        log.info(" -> Created default summary record for LCFS report ID: ${newLcfsReportId}")
    } catch (Exception e) {
        log.error("Exception creating default summary for LCFS report ID: ${newLcfsReportId}", e)
        // Decide if failure here is critical. Maybe log and continue?
    }

    // 3. Create Organization Snapshot
    try {
        // Fetch org details
        PreparedStatement orgDetailsStmt = destConn.prepareStatement(SELECT_LCFS_ORG_DETAILS_QUERY)
        orgDetailsStmt.setInt(1, lcfsOrgId)
        ResultSet orgDetailsRS = orgDetailsStmt.executeQuery()

        if (orgDetailsRS.next()) {
            String name = orgDetailsRS.getString("name")
            String operatingName = orgDetailsRS.getString("operating_name")
            String email = orgDetailsRS.getString("email")
            String phone = orgDetailsRS.getString("phone")
            String recordsAddr = orgDetailsRS.getString("records_address")
            String street = orgDetailsRS.getString("street_address")
            String other = orgDetailsRS.getString("address_other")
            String city = orgDetailsRS.getString("city")
            String province = orgDetailsRS.getString("province_state")
            String country = orgDetailsRS.getString("country")
            String postal = orgDetailsRS.getString("postalCode_zipCode")

            // Construct addresses (adjust formatting as needed)
            String fullAddress = [street, other, city, province, country, postal].findAll { it != null && !it.isEmpty() }.join(', ')
            // Assuming service and head office address are the same from organization_address for snapshot
            String serviceAddress = fullAddress
            String headOfficeAddress = fullAddress

            // Insert snapshot
            PreparedStatement snapshotStmt = destConn.prepareStatement(INSERT_LCFS_ORG_SNAPSHOT_SQL)
            snapshotStmt.setInt(1, newLcfsReportId)
            snapshotStmt.setString(2, name ?: '') // Use fetched values or defaults
            snapshotStmt.setString(3, operatingName ?: '')
            snapshotStmt.setString(4, email ?: '')
            snapshotStmt.setString(5, phone ?: '')
            snapshotStmt.setString(6, serviceAddress ?: '')
            snapshotStmt.setString(7, headOfficeAddress ?: '')
            snapshotStmt.setString(8, recordsAddr ?: '')
            snapshotStmt.setBoolean(9, false) // is_edited = false
            snapshotStmt.executeUpdate()
            snapshotStmt.close()
            log.info(" -> Created organization snapshot for LCFS report ID: ${newLcfsReportId}")

        } else {
            log.warn(" -> Could not find LCFS organization details for ID: ${lcfsOrgId} to create snapshot.")
        }
        orgDetailsRS.close()
        orgDetailsStmt.close()

    } catch (Exception e) {
        log.error("Exception creating organization snapshot for LCFS report ID: ${newLcfsReportId}", e)
        // Decide if failure here is critical.
    }

    return newLcfsReportId
}


/**
 * Inserts a new row into LCFS allocation_agreement with proper versioning.
 * Adapted from allocation_agreement.groovy
 */
def insertAllocationAgreementVersionRow(Connection destConn, Integer lcfsCRid, Map rowData, String action) {
    def recordId = rowData.agreement_record_id // TFRS agreement record ID

    // Retrieve or create a stable group_uuid based on TFRS record ID.
    def groupUuid = recordUuidMap[recordId]
    if (!groupUuid) {
        groupUuid = UUID.randomUUID().toString()
        recordUuidMap[recordId] = groupUuid
    }

    // Retrieve current highest version for this group_uuid in LCFS.
    int currentVer = -1
    PreparedStatement verStmt = destConn.prepareStatement(SELECT_CURRENT_ALLOCATION_VERSION_QUERY)
    verStmt.setString(1, groupUuid)
    ResultSet verRS = verStmt.executeQuery()
    if (verRS.next()) {
        currentVer = verRS.getInt("version")
    }
    verRS.close()
    verStmt.close()

    int nextVer = (currentVer < 0) ? 0 : currentVer + 1

    // --- Map source fields to LCFS fields ---
    int lcfsAllocTransactionTypeId = getLcfsTransactionTypeId(destConn, rowData.responsibility)
    // Map Fuel Type ID (TFRS Name -> LCFS ID)
    int lcfsFuelTypeId = getLcfsFuelTypeIdByName(destConn, rowData.fuel_type)
    int quantity = rowData.quantity ?: 0
    int quantityNotSold = rowData.quantity_not_sold ?: 0
    String transactionPartner = rowData.transaction_partner ?: ""
    String postalAddress = rowData.postal_address ?: ""
    String units = rowData.units ?: ""
    String fuelTypeString = rowData.fuel_type // TFRS fuel type name

    // Determine LCFS Fuel Category ID based on TFRS fuel type name
    Integer fuelCategoryId = null
    if (fuelTypeString?.toLowerCase().contains('gasoline')) {
        fuelCategoryId = GASOLINE_CATEGORY_ID
    } else if (fuelTypeString?.toLowerCase().contains('diesel')) {
        fuelCategoryId = DIESEL_CATEGORY_ID
    } else {
        log.warn("Could not determine LCFS fuel category for TFRS fuel type: ${fuelTypeString}. Setting fuel_category_id to NULL.")
    }
    // --- End Mapping ---

    // --- Validation ---
    if (lcfsAllocTransactionTypeId == null || lcfsFuelTypeId == null) {
        log.error("Skipping insert for TFRS record ID ${recordId} due to missing LCFS mapping (TransactionType: ${lcfsAllocTransactionTypeId}, FuelType: ${lcfsFuelTypeId})")
        return // Skip insert if essential foreign keys are missing
    }
    // --- End Validation ---


    PreparedStatement insStmt = destConn.prepareStatement(INSERT_ALLOCATION_AGREEMENT_SQL)
    insStmt.setInt(1, lcfsCRid)
    insStmt.setString(2, transactionPartner)
    insStmt.setString(3, postalAddress)
    insStmt.setInt(4, quantity)
    insStmt.setInt(5, quantityNotSold)
    insStmt.setString(6, units)
    insStmt.setInt(7, lcfsAllocTransactionTypeId)
    insStmt.setInt(8, lcfsFuelTypeId) // LCFS Fuel Type ID
    if (fuelCategoryId != null) {
        insStmt.setInt(9, fuelCategoryId) // LCFS Fuel Category ID
    } else {
        insStmt.setNull(9, java.sql.Types.INTEGER)
    }
    insStmt.setString(10, groupUuid)
    insStmt.setInt(11, nextVer)
    insStmt.setString(12, action) // Should always be 'CREATE' in this script's context
    insStmt.setString(13, 'ETL') // Bind create_user
    insStmt.setString(14, 'ETL') // Bind update_user
    insStmt.executeUpdate()
    insStmt.close()

    log.info(" -> Inserted LCFS allocation_agreement row: TFRS_recordId=${recordId}, LCFS_CR_ID=${lcfsCRid}, action=${action}, groupUuid=${groupUuid}, version=${nextVer}")
}


// -------------------------
// Main Execution
// -------------------------
log.warn("**** BEGIN ORPHANED ALLOCATION AGREEMENT MIGRATION ****")

Connection sourceConn = null
Connection destinationConn = null

try {
    sourceConn = sourceDbcpService.getConnection()
    destinationConn = destinationDbcpService.getConnection()

    // --- Pre-fetch necessary LCFS IDs ---
    // Integer lcfsDraftStatusId = getLcfsReportStatusId(destinationConn, 'Draft')
    String defaultReportingFrequency = 'ANNUAL' // Corrected enum value

    // if (lcfsDraftStatusId == null) { // Adjusted check -- REMOVED
    //     throw new Exception("Failed to retrieve necessary LCFS Status ID. Aborting.")
    // }
    log.info("Using default Reporting Frequency: ${defaultReportingFrequency}")
    // --- End Pre-fetch ---


    // 1) Find orphaned TFRS exclusion reports
    log.info("Querying TFRS for orphaned exclusion reports...")
    PreparedStatement orphanStmt = sourceConn.prepareStatement(SELECT_ORPHANED_EXCLUSION_REPORTS_QUERY)
    ResultSet orphanRS = orphanStmt.executeQuery()

    int orphanedCount = 0
    int processedCount = 0
    int skippedCount = 0

    while (orphanRS.next()) {
        orphanedCount++
        int tfrsExclusionReportId = orphanRS.getInt("tfrs_exclusion_report_id")
        int tfrsOrgId = orphanRS.getInt("tfrs_organization_id")
        int tfrsPeriodId = orphanRS.getInt("tfrs_compliance_period_id")
        int tfrsExclusionAgreementId = orphanRS.getInt("exclusion_agreement_id")
        String tfrsDirectorStatus = orphanRS.getString("tfrs_director_status")

        log.warn("Found orphaned TFRS exclusion report ID: ${tfrsExclusionReportId} (Org: ${tfrsOrgId}, Period: ${tfrsPeriodId}, Agreement: ${tfrsExclusionAgreementId}, DirectorStatus: ${tfrsDirectorStatus})")

        // 2a) Check if already migrated (LCFS report exists with this legacy_id)
        PreparedStatement checkStmt = destinationConn.prepareStatement(CHECK_LCFS_REPORT_EXISTS_QUERY)
        checkStmt.setInt(1, tfrsExclusionReportId)
        ResultSet checkRS = checkStmt.executeQuery()
        boolean alreadyExists = checkRS.next()
        checkRS.close()
        checkStmt.close()

        if (alreadyExists) {
            log.warn(" -> LCFS report with legacy_id ${tfrsExclusionReportId} already exists. Skipping.")
            skippedCount++
            continue // Move to the next orphaned report
        }

        // --- Get TFRS Org Name for Mapping ---
        String tfrsOrgName = null
        PreparedStatement orgNameStmt = sourceConn.prepareStatement(SELECT_TFRS_ORG_NAME_QUERY)
        orgNameStmt.setInt(1, tfrsOrgId)
        ResultSet orgNameRS = orgNameStmt.executeQuery()
        if (orgNameRS.next()) {
            tfrsOrgName = orgNameRS.getString("name")
        }
        orgNameRS.close()
        orgNameStmt.close()
        // --- End Get TFRS Org Name ---

        // --- Get TFRS Period Description for Mapping ---
        String tfrsPeriodDesc = null
        PreparedStatement periodDescStmt = sourceConn.prepareStatement(SELECT_TFRS_PERIOD_DESC_QUERY)
        periodDescStmt.setInt(1, tfrsPeriodId)
        ResultSet periodDescRS = periodDescStmt.executeQuery()
        if (periodDescRS.next()) {
            tfrsPeriodDesc = periodDescRS.getString("description")
        }
        periodDescRS.close()
        periodDescStmt.close()
        // --- End Get TFRS Period Description ---

        // --- Determine Target LCFS Status --- 
        String targetLcfsStatusName = 'Draft' // Default to Draft
        if (tfrsDirectorStatus == 'Accepted') {
            targetLcfsStatusName = 'Assessed'
        } else if (tfrsDirectorStatus == 'Rejected') {
            targetLcfsStatusName = 'Rejected'
        }
        log.info(" -> Mapping TFRS Director Status '${tfrsDirectorStatus}' to LCFS Status '${targetLcfsStatusName}'")
        Integer lcfsStatusId = getLcfsReportStatusId(destinationConn, targetLcfsStatusName)
        if (lcfsStatusId == null) {
             log.error(" -> Failed to find LCFS Status ID for '${targetLcfsStatusName}'. Skipping creation.")
             skippedCount++
             continue
        }
        // --- End Determine Target LCFS Status ---

        // 2b) Create placeholder LCFS report
        log.info(" -> Creating placeholder LCFS report with Status ID: ${lcfsStatusId}...")
        Integer lcfsOrgId = getLcfsOrgId(destinationConn, tfrsOrgName)
        Integer lcfsPeriodId = getLcfsPeriodId(destinationConn, tfrsPeriodDesc)

        if (lcfsOrgId == null || lcfsPeriodId == null) {
            log.error(" -> Failed to map TFRS Org/Period IDs for TFRS report ${tfrsExclusionReportId}. Skipping creation and associated records.")
            skippedCount++
            continue
        }

        Integer newLcfsReportId = createLcfsPlaceholderReport(
            destinationConn,
            lcfsOrgId,
            lcfsPeriodId,
            lcfsStatusId, // Pass the dynamically determined status ID
            defaultReportingFrequency,
            tfrsExclusionReportId
        )

        if (newLcfsReportId == null) {
             log.error(" -> Failed to create placeholder LCFS report for TFRS ID ${tfrsExclusionReportId}. Skipping associated records.")
             skippedCount++
             continue
        }

        // 3) Fetch associated allocation records from TFRS
        log.info(" -> Fetching allocation records from TFRS for agreement ID: ${tfrsExclusionAgreementId}")
        PreparedStatement allocStmt = sourceConn.prepareStatement(SELECT_ALLOCATION_RECORDS_BY_AGREEMENT_ID_QUERY)
        allocStmt.setInt(1, tfrsExclusionAgreementId)
        ResultSet allocRS = allocStmt.executeQuery()

        int agreementRecordsFound = 0
        while (allocRS.next()) {
            agreementRecordsFound++
             def recordData = [
                agreement_record_id : allocRS.getInt("agreement_record_id"),
                responsibility      : allocRS.getString("responsibility"),
                fuel_type           : allocRS.getString("fuel_type"), // TFRS Fuel Type Name
                tfrs_fuel_type_id   : allocRS.getInt("tfrs_fuel_type_id"), // TFRS Fuel Type ID
                transaction_partner : allocRS.getString("transaction_partner"),
                postal_address      : allocRS.getString("postal_address"),
                quantity            : allocRS.getInt("quantity"),
                units               : allocRS.getString("units"),
                quantity_not_sold   : allocRS.getInt("quantity_not_sold"),
                transaction_type_id : allocRS.getInt("transaction_type_id") // TFRS Transaction Type ID (used for responsibility mapping)
            ]

            // 4) Insert into LCFS allocation_agreement table
            insertAllocationAgreementVersionRow(destinationConn, newLcfsReportId, recordData, 'CREATE')
        }
        allocRS.close()
        allocStmt.close()

        if (agreementRecordsFound == 0) {
             log.warn(" -> No allocation records found in TFRS for agreement ID: ${tfrsExclusionAgreementId}")
        }
        processedCount++

    } // End while loop for orphaned reports

    orphanRS.close()
    orphanStmt.close()

     log.warn("Finished processing. Found ${orphanedCount} orphaned TFRS reports. Processed: ${processedCount}. Skipped: ${skippedCount}.")


} catch (Exception e) {
    log.error("Error running Orphaned Allocation Agreement migration", e)
    // Potentially re-throw depending on NiFi error handling requirements
    throw e
} finally {
    if (sourceConn != null) { try { sourceConn.close() } catch (Exception e) { log.error("Error closing source connection: ${e.message}")} }
    if (destinationConn != null) { try { destinationConn.close() } catch (Exception e) { log.error("Error closing destination connection: ${e.message}")} }
}

log.warn("**** DONE: ORPHANED ALLOCATION AGREEMENT MIGRATION ****") 