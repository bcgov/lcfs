/*
Migrate Notional Transfers from TFRS to LCFS

1. Finds all LCFS compliance reports having a TFRS legacy_id.
2. For each TFRS compliance report, determines its chain (root_report_id).
3. Retrieves schedule_a records for each version in the chain.
4. Computes a diff (CREATE / UPDATE) between consecutive versions.
5. Inserts rows in notional_transfer with a stable, random group_uuid (UUID) per schedule_a_record_id.
6. Versions these notional_transfer entries so that subsequent changes increment the version.
7. Logs the actions taken for easier traceability.
*/

import groovy.transform.Field
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.util.UUID

@Field
Map<Integer, String> recordUuidMap = [:]

@Field
String SELECT_LCFS_IMPORTED_REPORTS_QUERY = """
    SELECT compliance_report_id, legacy_id
    FROM compliance_report
    WHERE legacy_id IS NOT NULL
"""

@Field
String SELECT_ROOT_REPORT_ID_QUERY = """
    SELECT root_report_id
    FROM compliance_report
    WHERE id = ?
"""

@Field
String SELECT_REPORT_CHAIN_QUERY = """
    SELECT
      c.id AS tfrs_report_id,
      c.traversal
    FROM compliance_report c
    WHERE c.root_report_id = ?
    ORDER BY c.traversal, c.id
"""

@Field
String SELECT_SCHEDULE_A_RECORDS_QUERY = """
    SELECT
      sar.id AS schedule_a_record_id,
      sar.quantity,
      sar.trading_partner,
      sar.postal_address,
      sar.fuel_class_id,
      sar.transfer_type_id
    FROM compliance_report_schedule_a_record sar
    JOIN compliance_report_schedule_a sa ON sa.id = sar.schedule_id
    JOIN compliance_report c ON c.schedule_a_id = sa.id
    WHERE c.id = ?
    ORDER BY sar.id
"""

@Field
String SELECT_LCFS_COMPLIANCE_REPORT_BY_TFRSID_QUERY = """
    SELECT compliance_report_id
    FROM compliance_report
    WHERE legacy_id = ?
"""

@Field
String SELECT_CURRENT_VERSION_QUERY = """
    SELECT version
    FROM notional_transfer
    WHERE group_uuid = ?
    ORDER BY version DESC
    LIMIT 1
"""

@Field
String INSERT_NOTIONAL_TRANSFER_SQL = """
    INSERT INTO notional_transfer (
        compliance_report_id,
        quantity,
        legal_name,
        address_for_service,
        fuel_category_id,
        received_or_transferred,
        group_uuid,
        version,
        action_type,
        create_user, 
        update_user
    ) VALUES (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?::receivedOrTransferredEnum,
        ?,
        ?,
        ?::actiontypeenum,
        ?,
        ?
    )
"""

// =========================================
// NiFi Controller Services
// =========================================
def sourceDbcpService      = context.controllerServiceLookup.getControllerService("3245b078-0192-1000-ffff-ffffba20c1eb")
def destinationDbcpService = context.controllerServiceLookup.getControllerService("3244bf63-0192-1000-ffff-ffffc8ec6d93")

// =========================================
// Helper Functions
// =========================================

/**
 * Maps TFRS transfer_type_id => 'Received' or 'Transferred'
 * TFRS: 1=Transferred, 2=Received
 */
def mapReceivedOrTransferred(Integer transferTypeId) {
    if (transferTypeId == 1) {
        return "Received"
    }
    return "Transferred"
}

/**
 * Maps a TFRS fuel_class_id => LCFS fuel_category_id
 */
def mapFuelCategoryId(Integer fuelClassId) {
    switch (fuelClassId) {
        case 1: return 2
        case 2: return 1
    }
}

/**
 * Checks if any relevant fields in a schedule_a record differ between old and new.
 */
def isRecordChanged(Map oldRow, Map newRow) {
    if (oldRow == null || newRow == null) return true

    if (oldRow.quantity?.compareTo(newRow.quantity) != 0) return true
    if (oldRow.fuel_class_id != newRow.fuel_class_id) return true
    if (oldRow.transfer_type_id != newRow.transfer_type_id) return true
    if (oldRow.trading_partner != newRow.trading_partner) return true
    if (oldRow.postal_address != newRow.postal_address) return true

    return false
}

/**
 * Inserts a new row in notional_transfer with action=CREATE/UPDATE
 * We always do version = oldVersion + 1 or 0 if none yet.
 */
def insertVersionRow(Connection destConn, Integer lcfsCRid, Map rowData, String action) {
    def recordId = rowData.schedule_a_record_id

    // Retrieve or generate the stable random group uuid for this record
    def groupUuid = recordUuidMap[recordId]
    if (!groupUuid) {
        groupUuid = UUID.randomUUID().toString()
        recordUuidMap[recordId] = groupUuid
    }

    // Find current highest version in notional_transfer for that group_uuid
    def currentVer = -1
    PreparedStatement verStmt = destConn.prepareStatement(SELECT_CURRENT_VERSION_QUERY)
    verStmt.setString(1, groupUuid)
    ResultSet verRS = verStmt.executeQuery()
    if (verRS.next()) {
        currentVer = verRS.getInt("version")
    }
    verRS.close()
    verStmt.close()

    def nextVer = (currentVer < 0) ? 0 : currentVer + 1

    // Map TFRS fields => LCFS fields
    def recOrXfer = mapReceivedOrTransferred(rowData.transfer_type_id)
    def fuelCatId = mapFuelCategoryId(rowData.fuel_class_id)
    def quantity  = rowData.quantity ?: 0
    def tradePrt  = rowData.trading_partner ?: ""
    def postAddr  = rowData.postal_address ?: ""

    // Insert the new row
    PreparedStatement insStmt = destConn.prepareStatement(INSERT_NOTIONAL_TRANSFER_SQL)
    insStmt.setInt(1, lcfsCRid)
    insStmt.setBigDecimal(2, quantity)
    insStmt.setString(3, tradePrt)
    insStmt.setString(4, postAddr)
    insStmt.setInt(5, fuelCatId)
    insStmt.setString(6, recOrXfer)
    insStmt.setString(7, groupUuid)
    insStmt.setInt(8, nextVer)
    insStmt.setString(9, action)
    insStmt.setString(10, 'ETL')
    insStmt.setString(11, 'ETL')
    insStmt.executeUpdate()
    insStmt.close()

    log.info(" -> notional_transfer row: recordId=${recordId}, action=${action}, groupUuid=${groupUuid}, version=${nextVer}")
}

// =========================================
// Main Execution
// =========================================

log.warn("**** BEGIN NOTIONAL TRANSFER MIGRATION ****")

Connection sourceConn = null
Connection destinationConn = null

try {
    sourceConn = sourceDbcpService.getConnection()
    destinationConn = destinationDbcpService.getConnection()

    // 1) Find all LCFS compliance reports that have TFRS legacy_id
    log.info("Retrieving LCFS compliance_report with legacy_id != null")
    PreparedStatement lcfsStmt = destinationConn.prepareStatement(SELECT_LCFS_IMPORTED_REPORTS_QUERY)
    ResultSet lcfsRS = lcfsStmt.executeQuery()

    def tfrsIds = []
    while (lcfsRS.next()) {
        def tfrsId = lcfsRS.getInt("legacy_id")
        tfrsIds << tfrsId
    }
    lcfsRS.close()
    lcfsStmt.close()

    // For each TFRS compliance_report ID, follow the chain approach
    tfrsIds.each { tfrsId ->
        log.info("Processing TFRS compliance_report.id = ${tfrsId}")

        // 2) Find the root_report_id
        PreparedStatement rootStmt = sourceConn.prepareStatement(SELECT_ROOT_REPORT_ID_QUERY)
        rootStmt.setInt(1, tfrsId)
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

        // 3) Gather the chain in ascending order
        PreparedStatement chainStmt = sourceConn.prepareStatement(SELECT_REPORT_CHAIN_QUERY)
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

        // Keep the old version's schedule_a data in memory so we can do diffs
        Map<Integer,Map> previousRecords = [:]

        chainIds.eachWithIndex { chainTfrsId, idx ->
            log.info("TFRS #${chainTfrsId} (chain idx=${idx})")

            // 4) Fetch current TFRS schedule_a records
            Map<Integer,Map> currentRecords = [:]
            PreparedStatement schedStmt = sourceConn.prepareStatement(SELECT_SCHEDULE_A_RECORDS_QUERY)
            schedStmt.setInt(1, chainTfrsId)
            ResultSet sarRS = schedStmt.executeQuery()
            while (sarRS.next()) {
                def recId = sarRS.getInt("schedule_a_record_id")
                currentRecords[recId] = [
                    schedule_a_record_id: recId,
                    quantity           : sarRS.getBigDecimal("quantity"),
                    trading_partner    : sarRS.getString("trading_partner"),
                    postal_address     : sarRS.getString("postal_address"),
                    fuel_class_id      : sarRS.getInt("fuel_class_id"),
                    transfer_type_id   : sarRS.getInt("transfer_type_id")
                ]
            }
            sarRS.close()
            schedStmt.close()

            // 5) Find the matching LCFS compliance_report
            Integer lcfsCRid = null
            PreparedStatement findCRstmt = destinationConn.prepareStatement(SELECT_LCFS_COMPLIANCE_REPORT_BY_TFRSID_QUERY)
            findCRstmt.setInt(1, chainTfrsId)
            ResultSet findCRrs = findCRstmt.executeQuery()
            if (findCRrs.next()) {
                lcfsCRid = findCRrs.getInt("compliance_report_id")
            }
            findCRrs.close()
            findCRstmt.close()

            if (!lcfsCRid) {
                log.warn("TFRS #${chainTfrsId} not found in LCFS? Skipping diff, just storing previousRecords.")
                previousRecords = currentRecords
                return
            }

            // Compare old vs new

            // A) For each record in currentRecords
            currentRecords.each { recId, newData ->
                if (!previousRecords.containsKey(recId)) {
                    // wasn't in old => CREATE
                    insertVersionRow(destinationConn, lcfsCRid, newData, "CREATE")
                } else {
                    // existed => check if changed
                    def oldData = previousRecords[recId]
                    if (isRecordChanged(oldData, newData)) {
                        insertVersionRow(destinationConn, lcfsCRid, newData, "UPDATE")
                    }
                }
            }

            // Update previousRecords for the next version
            previousRecords = currentRecords
        } // end chain loop
    } // end each tfrsId

} catch (Exception e) {
    log.error("Error running notional transfer migration", e)
} finally {
    if (sourceConn != null) sourceConn.close()
    if (destinationConn != null) destinationConn.close()
}

log.warn("**** DONE: NOTIONAL TRANSFER ****")
