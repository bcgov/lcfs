import groovy.transform.Field
import java.sql.Types
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.util.UUID

@Field
Map<Integer, String> recordUuidMap = [:]

@Field String SELECT_LCFS_IMPORTED_REPORTS = """
    SELECT compliance_report_id, legacy_id
    FROM compliance_report
    WHERE legacy_id IS NOT NULL
"""

@Field String SELECT_ROOT_REPORT_ID = """
    SELECT root_report_id
    FROM compliance_report
    WHERE id = ?
"""

@Field String SELECT_REPORT_CHAIN = """
    SELECT
      c.id AS tfrs_report_id,
      c.traversal
    FROM compliance_report c
    WHERE c.root_report_id = ?
    ORDER BY c.traversal, c.id
"""

@Field String SELECT_SCHEDULE_C_RECORDS = """
    SELECT
      scr.id AS schedule_c_record_id,
      scr.quantity,
      scr.fuel_type_id,
      scr.fuel_class_id,
      scr.expected_use_id,
      scr.rationale,
      cr.id AS compliance_report_id,
      uom.name AS unit_of_measure,
      dci.density AS default_ci_of_fuel
    FROM compliance_report_schedule_c_record scr
    JOIN compliance_report_schedule_c sc ON sc.id = scr.schedule_id
    JOIN compliance_report cr ON cr.schedule_c_id = sc.id
    LEFT JOIN approved_fuel_type aft ON aft.id = scr.fuel_type_id
    LEFT JOIN default_carbon_intensity dci ON dci.category_id = aft.default_carbon_intensity_category_id
    LEFT JOIN unit_of_measure uom ON uom.id = aft.unit_of_measure_id
    WHERE cr.id = ?
"""

@Field String SELECT_LCFS_COMPLIANCE_REPORT = """
    SELECT compliance_report_id
    FROM compliance_report
    WHERE legacy_id = ?
"""

@Field String SELECT_CURRENT_VERSION = """
    SELECT version
    FROM other_uses
    WHERE group_uuid = ?
    ORDER BY version DESC
    LIMIT 1
"""

@Field String INSERT_OTHER_USES = """
    INSERT INTO other_uses (
        compliance_report_id,
        fuel_type_id,
        fuel_category_id,
        provision_of_the_act_id,
        ci_of_fuel,
        quantity_supplied,
        units,
        expected_use_id,
        rationale,
        group_uuid,
        version,
        action_type,
        create_user,
        update_user
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::actiontypeenum, 'ETL', 'ETL')
""";

def sourceDbcpService = context.controllerServiceLookup.getControllerService("3245b078-0192-1000-ffff-ffffba20c1eb")
def destinationDbcpService = context.controllerServiceLookup.getControllerService("3244bf63-0192-1000-ffff-ffffc8ec6d93")

// Helper Functions
/**
 * Maps a TFRS fuel_class_id => LCFS fuel_category_id
 */
def mapFuelCategoryId(Integer fuelClassId) {
    switch(fuelClassId) {
        case 1: return 2 // Diesel
        case 2: return 1 // Gasoline
        default: return null
    }
}

def mapFuelTypeId(Integer tfrsTypeId) {
    def mapping = [
        // Direct matches
        1: 1,    // Biodiesel
        2: 2,    // CNG
        3: 3,    // Electricity
        4: 4,    // Ethanol
        5: 5,    // HDRD
        6: 6,    // Hydrogen
        7: 7,    // LNG
        8: 13,   // Propane
        9: 5,   // Renewable diesel -> HDRD
        10: 14,  // Renewable gasoline
        11: 17,  // Natural gas-based gasoline -> Fossil-derived gasoline
        19: 16,  // Petroleum-based diesel -> Fossil-derived diesel
        20: 17,  // Petroleum-based gasoline -> Fossil-derived gasoline
        21: 15   // Renewable naphtha
    ]

    return mapping[tfrsTypeId] ?: 19 // Default to 'Other' if no match found
}

def mapExpectedUseId(Integer tfrsExpectedUseId) {
    def mapping = [
        2: 1,    // Heating Oil
        1: 2,    // Other
    ]

    return mapping[tfrsExpectedUseId] ?: 2  // Default to 'Other' (id: 2) if no match found
}

/**
 * Checks if any relevant fields in a schedule_b record differ between old and new.
 */
def isRecordChanged(Map oldRow, Map newRow) {
    if (!oldRow || !newRow) return true

    oldRow.quantity?.compareTo(newRow.quantity) != 0 ||
    oldRow.fuel_type_id != newRow.fuel_type_id ||
    oldRow.fuel_class_id != newRow.fuel_class_id ||
    oldRow.expected_use_id != newRow.expected_use_id ||
    oldRow.rationale != newRow.rationale
}

/**
 * Inserts a new row in other_uses with action=CREATE/UPDATE
 * We always do version = oldVersion + 1 or 0 if none yet.
 */
def insertVersionRow(Connection destConn, Integer lcfsCRid, Map rowData, String action) {
    def recordId = rowData.schedule_c_record_id

    // Get/create stable group UUID for version chain
    def groupUuid = recordUuidMap[recordId]
    if (!groupUuid) {
        groupUuid = UUID.randomUUID().toString()
        recordUuidMap[recordId] = groupUuid
    }

    // Get current highest version
    def currentVer = -1
    PreparedStatement verStmt = destConn.prepareStatement(SELECT_CURRENT_VERSION)
    verStmt.setString(1, groupUuid)
    ResultSet verRS = verStmt.executeQuery()
    if (verRS.next()) {
        currentVer = verRS.getInt("version")
    }
    verRS.close()
    verStmt.close()

    def nextVer = (currentVer < 0) ? 0 : currentVer + 1

    // Map TFRS fields => LCFS fields
    def expectedUseId = mapExpectedUseId(rowData.expected_use_id)
    def fuelCatId = mapFuelCategoryId(rowData.fuel_class_id)
    def fuelTypeId= mapFuelTypeId(rowData.fuel_type_id)
    def quantity = rowData.quantity?: 0
    def rationale= rowData.rationale?: ""
    def units = rowData.unit_of_measure?: ""
    def ci_of_fuel = rowData.ci_of_fuel?: 0


    // Map and insert the record
    PreparedStatement insStmt = destConn.prepareStatement(INSERT_OTHER_USES)
    insStmt.with {
        setInt(1, lcfsCRid)
        setInt(2, fuelTypeId)
        setInt(3, fuelCatId)
        setInt(4, 7)  // provision_of_the_act_id
        setBigDecimal(5, ci_of_fuel)
        setBigDecimal(6, quantity)
        setString(7,units)
        setInt(8, expectedUseId)
        setString(9, rationale)
        setString(10, groupUuid)
        setInt(11, nextVer)
        setString(12, action)
        executeUpdate()
        close()
    }

    log.info(" -> other_uses row: recordId=${recordId}, action=${action}, groupUuid=${groupUuid}, version=${nextVer}")
}

// Main Migration Logic
log.warn("**** BEGIN SCHEDULE C MIGRATION ****")

Connection sourceConn = null
Connection destinationConn = null

try {
    sourceConn = sourceDbcpService.getConnection()
    destinationConn = destinationDbcpService.getConnection()

    // Get all LCFS compliance reports with legacy IDs
    log.info("Retrieving LCFS compliance_report with legacy_id != null")
    PreparedStatement lcfsStmt = destinationConn.prepareStatement(SELECT_LCFS_IMPORTED_REPORTS)
    ResultSet lcfsRS = lcfsStmt.executeQuery()

    def tfrsIds = []
    while (lcfsRS.next()) {
        tfrsIds << lcfsRS.getInt("legacy_id")  // Ensure correct column name
    }
    lcfsRS.close()
    lcfsStmt.close()

    // Process each TFRS compliance report
    tfrsIds.each { tfrsId ->
        log.info("Processing TFRS compliance_report.id = ${tfrsId}")

        // Find root report ID for supplemental chain
        PreparedStatement rootStmt = sourceConn.prepareStatement(SELECT_ROOT_REPORT_ID)
        rootStmt.setInt(1, tfrsId)  // Set parameter in the query
        def rootRS = rootStmt.executeQuery()
        def rootId = null
        if (rootRS.next()) {
            rootId = rootRS.getInt("root_report_id")
        }

        rootRS.close()
        rootStmt.close()

        if (!rootId) {
            log.warn("No root_report_id found for TFRS #${tfrsId}; skipping.")
            return
        }

        // Get full chain of reports
        PreparedStatement chainStmt = sourceConn.prepareStatement(SELECT_REPORT_CHAIN)
        chainStmt.setInt(1, rootId)
        def chainRS = chainStmt.executeQuery()

        def chainIds = []
        while (chainRS.next()) {
            chainIds << chainRS.getInt("tfrs_report_id")
        }
        chainRS.close()
        chainStmt.close()

        if (chainIds.isEmpty()) {
            log.warn("Chain empty for root=${rootId}? skipping.")
            return
        }

        // Track previous records for change detection
        Map<Integer, Map> previousRecords = [:]

        // Process each report in the chain
        chainIds.eachWithIndex { chainTfrsId, idx ->
            log.info("TFRS #${chainTfrsId} (chain idx=${idx})")

            // Get current Schedule C records
            Map<Integer, Map> currentRecords = [:]
            PreparedStatement schedStmt = sourceConn.prepareStatement(SELECT_SCHEDULE_C_RECORDS)
            schedStmt.setInt(1, chainTfrsId)
            ResultSet scrRS = schedStmt.executeQuery()
            while (scrRS.next()) {
                currentRecords[scrRS.getInt("schedule_c_record_id")] = [
                    schedule_c_record_id: scrRS.getInt("schedule_c_record_id"),
                    quantity: scrRS.getBigDecimal("quantity"),
                    fuel_type_id: scrRS.getInt("fuel_type_id"),
                    fuel_class_id: scrRS.getInt("fuel_class_id"),
                    expected_use_id: scrRS.getInt("expected_use_id"),
                    rationale: scrRS.getString("rationale"),
                    unit_of_measure: scrRS.getString("unit_of_measure"),
                    ci_of_fuel: scrRS.getBigDecimal("default_ci_of_fuel")
                ]
            }
            scrRS.close()
            schedStmt.close()

            // Find corresponding LCFS compliance report
            PreparedStatement findCRstmt = destinationConn.prepareStatement(SELECT_LCFS_COMPLIANCE_REPORT)
            findCRstmt.setInt(1, chainTfrsId)
            ResultSet findCRrs = findCRstmt.executeQuery()

            def lcfsCRid = null
            if (findCRrs.next()) {
                lcfsCRid = findCRrs.getInt("compliance_report_id")
            }

            findCRrs.close()
            findCRstmt.close()

            if (!lcfsCRid) {
                log.warn("TFRS #${chainTfrsId} not found in LCFS; skipping diff.")
                previousRecords = currentRecords
                return
            }

            // Compare and insert records
            currentRecords.each { recId, newData ->
                if (!previousRecords.containsKey(recId)) {
                    insertVersionRow(destinationConn, lcfsCRid, newData, "CREATE")
                } else if (isRecordChanged(previousRecords[recId], newData)) {
                    insertVersionRow(destinationConn, lcfsCRid, newData, "UPDATE")
                }
            }

            previousRecords = currentRecords
        }
    }

} catch (Exception e) {
    log.error("Error running Schedule C migration", e)
    throw e
} finally {
    sourceConn?.close()
    destinationConn?.close()
}

log.warn("**** DONE: SCHEDULE C MIGRATION ****")