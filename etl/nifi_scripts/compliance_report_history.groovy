import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.sql.Timestamp

log.warn('**** STARTING COMPLIANCE REPORT HISTORY ETL ****')

// =========================================
// Configuration: Controller Services
// =========================================
// Replace these IDs with your actual source and destination DB Controller Service identifiers.
def sourceDbcpService = context.controllerServiceLookup.getControllerService('3245b078-0192-1000-ffff-ffffba20c1eb')
def destinationDbcpService = context.controllerServiceLookup.getControllerService('3244bf63-0192-1000-ffff-ffffc8ec6d93')

// =========================================
// SQL Query to retrieve history records from the source database.
// This query joins the compliance_report_history table with the workflow state table
// so that all relevant status fields (analyst, director, fuel supplier, manager) are available.
def SOURCE_HISTORY_QUERY = """
    SELECT
        crh.id AS history_id,
        crh.compliance_report_id,
        crh.create_timestamp,
        crh.update_timestamp,
        crh.create_user_id,
        crh.status_id AS original_status_id,
        crh.update_user_id,
        cws.analyst_status_id,
        cws.director_status_id,
        cws.fuel_supplier_status_id,
        cws.manager_status_id
    FROM compliance_report_history crh
    JOIN compliance_report_workflow_state cws ON crh.status_id = cws.id
    ORDER BY crh.compliance_report_id, crh.create_timestamp;
"""

// =========================================
// Helper Function: Load Reference Data for Status Mapping
// =========================================
def loadReferenceData(Connection conn) {
    def statusMap = [:]
    def idToName = [:]
    def stmt = conn.createStatement()
    def rs = stmt.executeQuery("SELECT compliance_report_status_id, status FROM compliance_report_status")
    while (rs.next()) {
        def status = rs.getString("status").toLowerCase()
        statusMap[status] = rs.getInt("compliance_report_status_id")
        idToName[rs.getInt("compliance_report_status_id")] = status
    }
    rs.close()
    stmt.close()
    return [statusMap: statusMap, statusIdToName: idToName]
}

// =========================================
// Updated Mapping Function: Map Workflow Statuses to a Final Status ID
// =========================================
def mapFinalStatus(String fuelStatus, String analystStatus, String managerStatus, String directorStatus, Map referenceData) {
    // Normalize all statuses to lower-case.
    fuelStatus = fuelStatus?.toLowerCase()
    analystStatus = analystStatus?.toLowerCase()
    managerStatus = managerStatus?.toLowerCase()
    directorStatus = directorStatus?.toLowerCase()
    
    // Exclude records if any field contains "requested supplemental"
    if (fuelStatus?.contains("requested supplemental") ||
        analystStatus?.contains("requested supplemental") ||
        managerStatus?.contains("requested supplemental") ||
        directorStatus?.contains("requested supplemental")) {
        log.debug("Record marked as 'Requested Supplemental'; skipping history record.")
        return null
    }
    
    // Exclude records with a draft status.
    if (fuelStatus == "draft") {
        log.debug("Record marked as 'Draft'; skipping history record.")
        return null
    }
    
    // Compute the stage for this history record.
    // The intended order is:
    // Stage 1: Submitted
    // Stage 2: Recommended by Analyst
    // Stage 3: Recommended by Manager
    // Stage 4: Accepted by Director (Assessed)
    int computedStage = 1  // default to Submitted
    if (analystStatus == "recommended") {
        computedStage = Math.max(computedStage, 2)
    }
    if (managerStatus == "recommended") {
        computedStage = Math.max(computedStage, 3)
    }
    if (directorStatus == "accepted") {
        computedStage = Math.max(computedStage, 4)
    }
    
    // Map the computed stage to a status name.
    String statusName = null
    switch (computedStage) {
        case 1: statusName = "submitted"; break;
        case 2: statusName = "recommended_by_analyst"; break;
        case 3: statusName = "recommended_by_manager"; break;
        case 4: statusName = "assessed"; break;
        default: statusName = null;
    }
    
    // Return the corresponding status ID from the reference data.
    return (statusName ? referenceData.statusMap[statusName] : null)
}

// =========================================
// Main Execution
// =========================================
Connection sourceConn = null
Connection destinationConn = null
PreparedStatement insertStmt = null

try {
    sourceConn = sourceDbcpService.getConnection()
    destinationConn = destinationDbcpService.getConnection()
    destinationConn.setAutoCommit(false)

    // (Optional) Truncate the destination compliance_report_history table to ensure a clean reload.
    def truncateStmt = destinationConn.createStatement()
    truncateStmt.execute("TRUNCATE TABLE compliance_report_history CASCADE")
    truncateStmt.close()

    // Build a lookup map from the destination compliance_report table.
    // This maps the TFRS id (stored as legacy_id) to the LCFS compliance_report_id.
    def legacyMapping = [:]
    def mappingStmt = destinationConn.createStatement()
    def mappingRs = mappingStmt.executeQuery("SELECT legacy_id, compliance_report_id FROM compliance_report")
    while (mappingRs.next()) {
        int legacyId = mappingRs.getInt("legacy_id")
        int reportId = mappingRs.getInt("compliance_report_id")
        legacyMapping[legacyId] = reportId
    }
    mappingRs.close()
    mappingStmt.close()

    // Load reference data for mapping statuses.
    def referenceData = loadReferenceData(destinationConn)

    // Prepare the INSERT statement for the destination compliance_report_history table.
    // Expected columns: compliance_report_id, status_id, user_profile_id, create_user, create_date, update_user, update_date.
    def INSERT_HISTORY_SQL = """
        INSERT INTO compliance_report_history (
            compliance_report_id,
            status_id,
            user_profile_id,
            create_user,
            create_date,
            update_user,
            update_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    """
    insertStmt = destinationConn.prepareStatement(INSERT_HISTORY_SQL)

    // Execute the query against the source database.
    PreparedStatement sourceStmt = sourceConn.prepareStatement(SOURCE_HISTORY_QUERY)
    ResultSet rs = sourceStmt.executeQuery()

    int recordsProcessed = 0
    while (rs.next()) {
        // Get the TFRS compliance report id from the source history record.
        def legacyId = rs.getInt("compliance_report_id")
        // Look up the corresponding LCFS compliance_report_id using the legacy mapping.
        def destinationReportId = legacyMapping[legacyId]
        if (destinationReportId == null) {
            log.warn("No matching LCFS compliance report found for legacy id: ${legacyId}. Skipping history record.")
            continue
        }
        
        Timestamp createTimestamp = rs.getTimestamp("create_timestamp")
        Timestamp updateTimestamp = rs.getTimestamp("update_timestamp")
        def createUserId = rs.getInt("create_user_id")
        def updateUserId = rs.getInt("update_user_id")
        
        // Retrieve the workflow status values.
        def analystStatus = rs.getString("analyst_status_id")
        def directorStatus = rs.getString("director_status_id")
        def fuelStatus = rs.getString("fuel_supplier_status_id")
        def managerStatus = rs.getString("manager_status_id")
        
        // Recalculate the final status using the updated mapping function.
        def finalStatusId = mapFinalStatus(fuelStatus, analystStatus, managerStatus, directorStatus, referenceData)
        if (finalStatusId == null) {
            log.debug("Skipping history record for legacy id: ${legacyId} due to unmapped status.")
            continue
        }
        
        // Insert the record into the destination using the mapped compliance_report_id.
        insertStmt.setInt(1, destinationReportId)
        insertStmt.setInt(2, finalStatusId)
        // Use the create_user_id as the user_profile_id.
        insertStmt.setInt(3, createUserId)
        // For create_user and update_user, here we simply use the user IDs as strings.
        insertStmt.setString(4, createUserId.toString())
        insertStmt.setTimestamp(5, createTimestamp)
        insertStmt.setString(6, updateUserId ? updateUserId.toString() : null)
        insertStmt.setTimestamp(7, updateTimestamp)
        
        insertStmt.addBatch()
        recordsProcessed++
    }
    rs.close()
    sourceStmt.close()

    // Execute all batched inserts and commit.
    insertStmt.executeBatch()
    destinationConn.commit()
    log.warn("Inserted ${recordsProcessed} compliance report history records successfully.")

} catch (Exception e) {
    log.error("Error processing compliance report history records", e)
    destinationConn?.rollback()
    throw e
} finally {
    if (insertStmt != null) {
        insertStmt.close()
    }
    if (sourceConn != null) {
        sourceConn.close()
    }
    if (destinationConn != null) {
        destinationConn.close()
    }
}

log.warn('**** COMPLETED COMPLIANCE REPORT HISTORY ETL ****')
