import groovy.json.JsonSlurper
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet

// Define Database Connections
def sourceDbcpService = context.controllerServiceLookup.getControllerService('3245b078-0192-1000-ffff-ffffba20c1eb')
def destinationDbcpService = context.controllerServiceLookup.getControllerService('3244bf63-0192-1000-ffff-ffffc8ec6d93')

log.warn('**** BEGIN ALLOCATION AGREEMENT VALIDATION ****')

Connection sourceConn = null
Connection destinationConn = null

try {
    sourceConn = sourceDbcpService.getConnection()
    destinationConn = destinationDbcpService.getConnection()
    
    // 1. Compare source and destination record counts
    def sourceCountStmt = sourceConn.prepareStatement("""
        SELECT COUNT(*) AS count 
        FROM compliance_report_exclusion_agreement_record
    """)
    def sourceCountRS = sourceCountStmt.executeQuery()
    def sourceCount = 0
    if (sourceCountRS.next()) {
        sourceCount = sourceCountRS.getInt("count")
    }
    sourceCountRS.close()
    sourceCountStmt.close()
    
    def destCountStmt = destinationConn.prepareStatement("""
        SELECT COUNT(*) AS count 
        FROM allocation_agreement
        WHERE user_type = 'SUPPLIER'
    """)
    def destCountRS = destCountStmt.executeQuery()
    def destCount = 0
    if (destCountRS.next()) {
        destCount = destCountRS.getInt("count")
    }
    destCountRS.close()
    destCountStmt.close()
    
    log.warn("Source record count: ${sourceCount}")
    log.warn("Destination record count: ${destCount}")
    log.warn("Difference: ${destCount - sourceCount}")
    
    // 2. Sample validation: Check several records for data integrity
    def sampleSize = 10
    def sourceRecordsStmt = sourceConn.prepareStatement("""
        SELECT 
            crear.id AS agreement_record_id,
            cr.id AS cr_legacy_id,
            CASE WHEN tt.the_type = 'Purchased' THEN 'Allocated from' ELSE 'Allocated to' END AS responsibility,
            aft.name AS fuel_type,
            crear.transaction_partner,
            crear.postal_address,
            crear.quantity,
            crear.quantity_not_sold
        FROM compliance_report cr
        JOIN compliance_report_exclusion_agreement crea ON cr.exclusion_agreement_id = crea.id
        JOIN compliance_report_exclusion_agreement_record crear ON crear.exclusion_agreement_id = crea.id
        JOIN transaction_type tt ON crear.transaction_type_id = tt.id
        JOIN approved_fuel_type aft ON crear.fuel_type_id = aft.id
        WHERE cr.exclusion_agreement_id IS NOT NULL
        ORDER BY cr.id
        LIMIT ${sampleSize}
    """)
    def sourceRecordsRS = sourceRecordsStmt.executeQuery()
    def matchCount = 0
    
    log.warn("\nValidating sample records...")
    while (sourceRecordsRS.next()) {
        def legacyId = sourceRecordsRS.getInt("cr_legacy_id")
        def partner = sourceRecordsRS.getString("transaction_partner")
        def quantity = sourceRecordsRS.getBigDecimal("quantity")
        def fuelType = sourceRecordsRS.getString("fuel_type")
        
        // Find matching record in LCFS
        def destRecordStmt = destinationConn.prepareStatement("""
            SELECT aa.*, cr.legacy_id, ft.fuel_type, att.type AS allocation_type
            FROM allocation_agreement aa
            JOIN compliance_report cr ON cr.compliance_report_id = aa.compliance_report_id
            JOIN fuel_type ft ON ft.fuel_type_id = aa.fuel_type_id
            JOIN allocation_transaction_type att ON att.allocation_transaction_type_id = aa.allocation_transaction_type_id
            WHERE cr.legacy_id = ?
            AND aa.transaction_partner = ?
            AND ABS(aa.quantity - ?) < 0.01
            AND ft.fuel_type = ?
            LIMIT 1
        """)
        destRecordStmt.setInt(1, legacyId)
        destRecordStmt.setString(2, partner)
        destRecordStmt.setBigDecimal(3, quantity)
        destRecordStmt.setString(4, fuelType)
        
        def destRecordRS = destRecordStmt.executeQuery()
        if (destRecordRS.next()) {
            matchCount++
            log.warn("✓ Record for compliance report ${legacyId}, partner ${partner} matches")
        } else {
            log.warn("✗ No match found for compliance report ${legacyId}, partner ${partner}")
        }
        destRecordRS.close()
        destRecordStmt.close()
    }
    sourceRecordsRS.close()
    sourceRecordsStmt.close()
    
    log.warn("Found ${matchCount}/${sampleSize} matching records")
    
    // 3. Check transaction type mapping integrity
    def transTypeStmt = destinationConn.prepareStatement("""
        SELECT att.type, COUNT(*) AS count
        FROM allocation_agreement aa
        JOIN allocation_transaction_type att ON att.allocation_transaction_type_id = aa.allocation_transaction_type_id
        WHERE aa.user_type = 'SUPPLIER'
        GROUP BY att.type
        ORDER BY count DESC
    """)
    def transTypeRS = transTypeStmt.executeQuery()
    
    log.warn("\nAllocation transaction type distribution:")
    while (transTypeRS.next()) {
        log.warn("${transTypeRS.getString('type')}: ${transTypeRS.getInt('count')} records")
    }
    transTypeRS.close()
    transTypeStmt.close()
    
    // 4. Check for data anomalies - NULL values in key fields
    def nullCheckStmt = destinationConn.prepareStatement("""
        SELECT 
            SUM(CASE WHEN fuel_type_id IS NULL THEN 1 ELSE 0 END) as null_fuel_type,
            SUM(CASE WHEN allocation_transaction_type_id IS NULL THEN 1 ELSE 0 END) as null_transaction_type,
            SUM(CASE WHEN transaction_partner IS NULL OR transaction_partner = '' THEN 1 ELSE 0 END) as null_partner,
            SUM(CASE WHEN quantity IS NULL THEN 1 ELSE 0 END) as null_quantity,
            SUM(CASE WHEN quantity_not_sold IS NULL THEN 1 ELSE 0 END) as null_quantity_not_sold
        FROM allocation_agreement
        WHERE user_type = 'SUPPLIER'
    """)
    def nullCheckRS = nullCheckStmt.executeQuery()
    if (nullCheckRS.next()) {
        log.warn("\nData anomalies check:")
        log.warn("Records with NULL fuel_type_id: ${nullCheckRS.getInt('null_fuel_type')}")
        log.warn("Records with NULL allocation_transaction_type_id: ${nullCheckRS.getInt('null_transaction_type')}")
        log.warn("Records with NULL/empty transaction_partner: ${nullCheckRS.getInt('null_partner')}")
        log.warn("Records with NULL quantity: ${nullCheckRS.getInt('null_quantity')}")
        log.warn("Records with NULL quantity_not_sold: ${nullCheckRS.getInt('null_quantity_not_sold')}")
    }
    nullCheckRS.close()
    nullCheckStmt.close()
    
    // 5. Version integrity check
    def versionCheckStmt = destinationConn.prepareStatement("""
        SELECT group_uuid, COUNT(*) as version_count, MIN(version) as min_version, MAX(version) as max_version
        FROM allocation_agreement
        WHERE user_type = 'SUPPLIER'
        GROUP BY group_uuid
        HAVING COUNT(*) > 1
        ORDER BY version_count DESC
        LIMIT 10
    """)
    def versionCheckRS = versionCheckStmt.executeQuery()
    
    log.warn("\nVersion chain validation:")
    int versionChainCount = 0
    while (versionCheckRS.next()) {
        versionChainCount++
        def groupUuid = versionCheckRS.getString("group_uuid")
        def versionCount = versionCheckRS.getInt("version_count")
        def minVersion = versionCheckRS.getInt("min_version")
        def maxVersion = versionCheckRS.getInt("max_version")
        
        log.warn("Group ${groupUuid}: ${versionCount} versions (${minVersion} to ${maxVersion})")
        
        // Check if versions are sequential
        def versionsStmt = destinationConn.prepareStatement("""
            SELECT version FROM allocation_agreement WHERE group_uuid = ? ORDER BY version
        """)
        versionsStmt.setString(1, groupUuid)
        def versionsRS = versionsStmt.executeQuery()
        
        def versions = []
        while (versionsRS.next()) {
            versions.add(versionsRS.getInt("version"))
        }
        versionsRS.close()
        versionsStmt.close()
        
        def isSequential = versions.size() == (versions[-1] - versions[0] + 1)
        log.warn("  Versions are ${isSequential ? 'sequential' : 'non-sequential'}: ${versions.join(', ')}")
    }
    versionCheckRS.close()
    versionCheckStmt.close()
    
    if (versionChainCount == 0) {
        log.warn("No version chains found")
    }
    
    // 6. Action type verification
    def actionTypeStmt = destinationConn.prepareStatement("""
        SELECT action_type, COUNT(*) as count
        FROM allocation_agreement
        WHERE user_type = 'SUPPLIER'
        GROUP BY action_type
    """)
    def actionTypeRS = actionTypeStmt.executeQuery()
    
    log.warn("\nAction type distribution:")
    while (actionTypeRS.next()) {
        log.warn("${actionTypeRS.getString('action_type')}: ${actionTypeRS.getInt('count')} records")
    }
    actionTypeRS.close()
    actionTypeStmt.close()
    
    // 7. Ensure no new-period records were impacted
    def newPeriodCheckStmt = destinationConn.prepareStatement("""
        SELECT COUNT(*) as count
        FROM allocation_agreement aa
        JOIN compliance_report cr ON cr.compliance_report_id = aa.compliance_report_id
        WHERE aa.user_type != 'SUPPLIER'
        AND EXISTS (
            SELECT 1 FROM allocation_agreement aa2 
            WHERE aa2.group_uuid = aa.group_uuid 
            AND aa2.user_type = 'SUPPLIER'
        )
    """)
    def newPeriodCheckRS = newPeriodCheckStmt.executeQuery()
    if (newPeriodCheckRS.next()) {
        int newPeriodUpdates = newPeriodCheckRS.getInt("count")
        log.warn("\nNew period records impacted: ${newPeriodUpdates}")
        if (newPeriodUpdates > 0) {
            log.error("WARNING: ${newPeriodUpdates} records from the latest reporting period were modified by ETL process")
        } else {
            log.warn("✓ No latest reporting period records were modified")
        }
    }
    newPeriodCheckRS.close()
    newPeriodCheckStmt.close()
    
} catch (Exception e) {
    log.error('Error in allocation agreement validation', e)
} finally {
    sourceConn?.close()
    destinationConn?.close()
}

log.warn('**** END ALLOCATION AGREEMENT VALIDATION ****')
