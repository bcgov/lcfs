/*
Migrate Allocation Agreements from TFRS to LCFS

Overview:
1. Retrieve LCFS compliance reports that have a TFRS legacy_id.
2. For each LCFS report, use its legacy_id to query the source for allocation agreement records.
3. For each allocation record found, insert a new row into LCFS's allocation_agreement table.
4. A stable group_uuid is generated (or reused) per allocation record, and version is computed.
5. Actions are logged for traceability.
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
@Field Map<Integer, String> recordUuidMap = [:]  // Maps TFRS allocation agreement record ID to a stable group UUID

@Field String SELECT_LCFS_IMPORTED_REPORTS_QUERY = """
    SELECT compliance_report_id, legacy_id
    FROM compliance_report
    WHERE legacy_id IS NOT NULL
"""

// This query gets allocation agreement records for a given TFRS compliance report (foreign key: cr.id)
@Field String SELECT_ALLOCATION_AGREEMENTS_QUERY = """
    SELECT
        crear.id AS agreement_record_id,
        CASE WHEN tt.the_type = 'Purchased' THEN 'Allocated from' ELSE 'Allocated to' END AS responsibility,
        aft.name AS fuel_type,
        aft.id AS fuel_type_id,
        crear.transaction_partner,
        crear.postal_address,
        crear.quantity,
        uom.name AS units,
        crear.quantity_not_sold,
        tt.id AS transaction_type_id
    FROM compliance_report legacy_cr -- Alias for the report identified by the legacy_id passed in
    -- Find the related report within the same org/period that has the exclusion agreement
    INNER JOIN compliance_report exclusion_cr
        ON legacy_cr.organization_id = exclusion_cr.organization_id
       AND legacy_cr.compliance_period_id = exclusion_cr.compliance_period_id
       AND exclusion_cr.exclusion_agreement_id IS NOT NULL
    -- Now join from the exclusion report to the agreement tables
    INNER JOIN compliance_report_exclusion_agreement crea
        ON exclusion_cr.exclusion_agreement_id = crea.id
    INNER JOIN compliance_report_exclusion_agreement_record crear
        ON crea.id = crear.exclusion_agreement_id -- Corrected join condition here
    -- Standard joins for details
    INNER JOIN transaction_type tt
        ON crear.transaction_type_id = tt.id
    INNER JOIN approved_fuel_type aft
        ON crear.fuel_type_id = aft.id
    INNER JOIN unit_of_measure uom
        ON aft.unit_of_measure_id = uom.id
    WHERE
        legacy_cr.id = ? -- The parameter is the ID of the TFRS report that has the legacy_id
    ORDER BY
        crear.id;
"""

// Use this query to get the LCFS compliance report by a legacy (TFRS) ID.
@Field String SELECT_LCFS_COMPLIANCE_REPORT_BY_TFRSID_QUERY = """
    SELECT compliance_report_id
    FROM compliance_report
    WHERE legacy_id = ?
"""

// To support versioning we check the current highest version for a given group_uuid.
@Field String SELECT_CURRENT_VERSION_QUERY = """
    SELECT version
    FROM allocation_agreement
    WHERE group_uuid = ?
    ORDER BY version DESC
    LIMIT 1
"""

// INSERT statement for allocation_agreement.
@Field String INSERT_ALLOCATION_AGREEMENT_SQL = """
    INSERT INTO allocation_agreement(
      compliance_report_id,
      transaction_partner,
      postal_address,
      quantity,
      quantity_not_sold,
      units,
      allocation_transaction_type_id,
      fuel_type_id,
      fuel_category_id,
      group_uuid,
      version,
      action_type,
      create_user,
      update_user
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::actiontypeenum, ?, ?)
"""

// -------------------------
// Reference Lookup Queries & Caches
// -------------------------
@Field Integer GASOLINE_CATEGORY_ID = 1
@Field Integer DIESEL_CATEGORY_ID = 2

@Field Map<String, Integer> responsibilityToTransactionTypeCache = [:]
@Field String SELECT_TRANSACTION_TYPE_ID_QUERY = """
    SELECT allocation_transaction_type_id 
    FROM allocation_transaction_type 
    WHERE type = ?
"""

@Field Map<String, Integer> fuelTypeNameToIdCache = [:]
@Field String SELECT_FUEL_TYPE_ID_QUERY = """
    SELECT fuel_type_id 
    FROM fuel_type 
    WHERE fuel_type = ?
"""

/**
 * Returns the allocation transaction type ID for a given responsibility.
 * Uses an in-memory cache.
 */
def getTransactionTypeId(Connection destConn, String responsibility) {
    if (responsibilityToTransactionTypeCache.containsKey(responsibility)) {
        return responsibilityToTransactionTypeCache[responsibility]
    }
    PreparedStatement stmt = destConn.prepareStatement(SELECT_TRANSACTION_TYPE_ID_QUERY)
    try {
        stmt.setString(1, responsibility)
        ResultSet rs = stmt.executeQuery()
        if (rs.next()) {
            int typeId = rs.getInt("allocation_transaction_type_id")
            responsibilityToTransactionTypeCache[responsibility] = typeId
            return typeId
        } else {
            log.warn("No transaction type found for responsibility: ${responsibility}; using default 1.")
            return 1
        }
    } finally {
        stmt.close()
    }
}

/**
 * Returns the fuel type ID for a given fuel type string.
 * Uses an in-memory cache.
 */
def getFuelTypeId(Connection destConn, String fuelType) {
    if (fuelTypeNameToIdCache.containsKey(fuelType)) {
        return fuelTypeNameToIdCache[fuelType]
    }
    PreparedStatement stmt = destConn.prepareStatement(SELECT_FUEL_TYPE_ID_QUERY)
    try {
        stmt.setString(1, fuelType)
        ResultSet rs = stmt.executeQuery()
        if (rs.next()) {
            int typeId = rs.getInt("fuel_type_id")
            fuelTypeNameToIdCache[fuelType] = typeId
            return typeId
        } else {
            log.warn("No fuel type found for: ${fuelType}; using default 1.")
            return 1
        }
    } finally {
        stmt.close()
    }
}

/**
 * Inserts a new row into allocation_agreement with proper versioning.
 * A stable group_uuid is generated (or reused) based on the TFRS agreement record id.
 */
def insertVersionRow(Connection destConn, Integer lcfsCRid, Map rowData, String action) {
    def recordId = rowData.agreement_record_id

    // Retrieve or create a stable group_uuid.
    def groupUuid = recordUuidMap[recordId]
    if (!groupUuid) {
        groupUuid = UUID.randomUUID().toString()
        recordUuidMap[recordId] = groupUuid
    }

    // Retrieve current highest version for this group_uuid.
    int currentVer = -1
    PreparedStatement verStmt = destConn.prepareStatement(SELECT_CURRENT_VERSION_QUERY)
    verStmt.setString(1, groupUuid)
    ResultSet verRS = verStmt.executeQuery()
    if (verRS.next()) {
        currentVer = verRS.getInt("version")
    }
    verRS.close()
    verStmt.close()

    int nextVer = (currentVer < 0) ? 0 : currentVer + 1

    // Map source fields to destination fields.
    int allocTransactionTypeId = getTransactionTypeId(destConn, rowData.responsibility)
    int fuelTypeId = getFuelTypeId(destConn, rowData.fuel_type)
    int quantity = rowData.quantity ?: 0
    int quantityNotSold = rowData.quantity_not_sold ?: 0
    String transactionPartner = rowData.transaction_partner ?: ""
    String postalAddress = rowData.postal_address ?: ""
    String units = rowData.units ?: ""
    String fuelTypeString = rowData.fuel_type // Get the fuel type string

    // ---- START: Determine Fuel Category ID ----
    Integer fuelCategoryId = null // Default to null
    // Adjust these string checks based on your actual source fuel_type names
    if (fuelTypeString?.toLowerCase().contains('gasoline')) {
        fuelCategoryId = GASOLINE_CATEGORY_ID
    } else if (fuelTypeString?.toLowerCase().contains('diesel')) {
        fuelCategoryId = DIESEL_CATEGORY_ID
    } else {
        // Optional: Log a warning if a type doesn't match known categories
        log.warn("Could not determine fuel category for fuel type: ${fuelTypeString}. Setting fuel_category_id to NULL.")
    }
    // ---- END: Determine Fuel Category ID ----

    PreparedStatement insStmt = destConn.prepareStatement(INSERT_ALLOCATION_AGREEMENT_SQL)
    insStmt.setInt(1, lcfsCRid)
    insStmt.setString(2, transactionPartner)
    insStmt.setString(3, postalAddress)
    insStmt.setInt(4, quantity)
    insStmt.setInt(5, quantityNotSold)
    insStmt.setString(6, units)
    insStmt.setInt(7, allocTransactionTypeId)
    insStmt.setInt(8, fuelTypeId)
    if (fuelCategoryId != null) {
        insStmt.setInt(9, fuelCategoryId)
    } else {
        insStmt.setNull(9, java.sql.Types.INTEGER)
    }
    insStmt.setString(10, groupUuid)
    insStmt.setInt(11, nextVer)
    insStmt.setString(12, action)
    insStmt.setString(13, 'ETL')
    insStmt.setString(14, 'ETL')
    insStmt.executeUpdate()
    insStmt.close()

    log.info("Inserted allocation_agreement row: recordId=${recordId}, action=${action}, groupUuid=${groupUuid}, version=${nextVer}")
}

// -------------------------
// Main Execution
// -------------------------
log.warn("**** BEGIN ALLOCATION AGREEMENT MIGRATION ****")

Connection sourceConn = null
Connection destinationConn = null

try {
    // Establish connections.
    sourceConn = sourceDbcpService.getConnection()
    destinationConn = destinationDbcpService.getConnection()

    // 1) Retrieve all LCFS compliance reports with a non-null legacy_id.
    log.info("Retrieving LCFS compliance reports with legacy_id != NULL")
    PreparedStatement lcfsStmt = destinationConn.prepareStatement(SELECT_LCFS_IMPORTED_REPORTS_QUERY)
    ResultSet lcfsRS = lcfsStmt.executeQuery()

    // Build a list of TFRS IDs using legacy_id.
    def tfrsIds = []
    while (lcfsRS.next()) {
        tfrsIds << lcfsRS.getInt("legacy_id")
    }
    lcfsRS.close()
    lcfsStmt.close()

    // Process each LCFS compliance report.
    tfrsIds.each { tfrsId ->
        log.warn("Processing TFRS compliance_report.id = ${tfrsId}")

        // Look up the original LCFS compliance_report record by legacy_id.
        PreparedStatement crStmt = destinationConn.prepareStatement(SELECT_LCFS_COMPLIANCE_REPORT_BY_TFRSID_QUERY)
        crStmt.setInt(1, tfrsId)
        ResultSet crRS = crStmt.executeQuery()
        def lcfsCRid = crRS.next() ? crRS.getInt("compliance_report_id") : null
        crRS.close()
        crStmt.close()

        if (!lcfsCRid) {
            log.warn("No LCFS compliance_report found for TFRS legacy id ${tfrsId}; skipping allocation agreement processing.")
            return
        }

        // 2) Retrieve allocation agreement records from source for the given TFRS report.
        PreparedStatement alocStmt = sourceConn.prepareStatement(SELECT_ALLOCATION_AGREEMENTS_QUERY)
        alocStmt.setInt(1, tfrsId)
        ResultSet alocRS = alocStmt.executeQuery()

        boolean foundAllocationRecords = false
        // Process each allocation agreement record.
        while (alocRS.next()) {
            foundAllocationRecords = true // Mark that we entered the loop
            int recId = alocRS.getInt("agreement_record_id")
            log.info("Found source allocation record ID: ${recId} for TFRS report ID: ${tfrsId}. Preparing for LCFS insert.")
            def recordData = [
                agreement_record_id : recId,
                responsibility      : alocRS.getString("responsibility"),
                fuel_type           : alocRS.getString("fuel_type"),
                fuel_type_id        : alocRS.getInt("fuel_type_id"),
                transaction_partner : alocRS.getString("transaction_partner"),
                postal_address      : alocRS.getString("postal_address"),
                quantity            : alocRS.getInt("quantity"),
                units               : alocRS.getString("units"),
                quantity_not_sold   : alocRS.getInt("quantity_not_sold"),
                transaction_type_id : alocRS.getInt("transaction_type_id")
            ]
            // Insert each allocation agreement record. Versioning is handled via a stable group UUID.
            insertVersionRow(destinationConn, lcfsCRid, recordData, 'CREATE')
        }
        if (!foundAllocationRecords) {
            log.warn("No allocation agreement records found in source for TFRS report ID: ${tfrsId} (or cr.exclusion_agreement_id was NULL).")
        }
        alocRS.close()
        alocStmt.close()
    }
} catch (Exception e) {
    log.error("Error running allocation agreement migration", e)
    throw e
} finally {
    if (sourceConn != null) { sourceConn.close() }
    if (destinationConn != null) { destinationConn.close() }
}

log.warn("**** DONE: ALLOCATION AGREEMENT MIGRATION ****")
