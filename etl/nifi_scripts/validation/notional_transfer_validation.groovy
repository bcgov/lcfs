import groovy.json.JsonSlurper
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet

// Define Database Connections
def sourceDbcpService = context.controllerServiceLookup.getControllerService('3245b078-0192-1000-ffff-ffffba20c1eb')
def destinationDbcpService = context.controllerServiceLookup.getControllerService('3244bf63-0192-1000-ffff-ffffc8ec6d93')

log.warn('**** BEGIN NOTIONAL TRANSFER VALIDATION ****')

Connection sourceConn = null
Connection destinationConn = null

try {
    sourceConn = sourceDbcpService.getConnection()
    destinationConn = destinationDbcpService.getConnection()
    
    // 1. Compare source and destination record counts
    def sourceCountStmt = sourceConn.prepareStatement("""
        SELECT COUNT(*) AS count 
        FROM compliance_report_schedule_a_record
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
        FROM notional_transfer
        WHERE user_type::text = 'SUPPLIER'
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
            sar.id AS schedule_a_record_id,
            cr.id AS cr_legacy_id,
            sar.quantity,
            sar.trading_partner,
            sar.postal_address,
            fc.fuel_class AS fuel_category,
            CASE 
                WHEN sar.transfer_type_id = 1 THEN 'Received'
                ELSE 'Transferred' 
            END AS transfer_type
        FROM compliance_report_schedule_a_record sar
        JOIN compliance_report_schedule_a sa ON sa.id = sar.schedule_id
        JOIN compliance_report cr ON cr.schedule_a_id = sa.id
        JOIN fuel_class fc ON fc.id = sar.fuel_class_id
        ORDER BY cr.id
        LIMIT ${sampleSize}
    """)
    def sourceRecordsRS = sourceRecordsStmt.executeQuery()
    def matchCount = 0
    
    log.warn("\nValidating sample records...")
    while (sourceRecordsRS.next()) {
        def legacyId = sourceRecordsRS.getInt("cr_legacy_id")
        def tradingPartner = sourceRecordsRS.getString("trading_partner")
        def quantity = sourceRecordsRS.getBigDecimal("quantity")
        def transferType = sourceRecordsRS.getString("transfer_type")
        
        // Find matching record in LCFS
        def destRecordStmt = destinationConn.prepareStatement("""
            SELECT nt.*, cr.legacy_id
            FROM notional_transfer nt
            JOIN compliance_report cr ON cr.compliance_report_id = nt.compliance_report_id
            WHERE cr.legacy_id = ?
            AND nt.legal_name = ?
            AND ABS(nt.quantity - ?) < 0.01
            AND nt.received_or_transferred::text = ?
            LIMIT 1
        """)
        destRecordStmt.setInt(1, legacyId)
        destRecordStmt.setString(2, tradingPartner)
        destRecordStmt.setBigDecimal(3, quantity)
        destRecordStmt.setString(4, transferType)
        
        def destRecordRS = destRecordStmt.executeQuery()
        if (destRecordRS.next()) {
            matchCount++
            log.warn("✓ Record for compliance report ${legacyId}, partner ${tradingPartner} matches")
        } else {
            log.warn("✗ No match found for compliance report ${legacyId}, partner ${tradingPartner}")
        }
        destRecordRS.close()
        destRecordStmt.close()
    }
    sourceRecordsRS.close()
    sourceRecordsStmt.close()
    
    log.warn("Found ${matchCount}/${sampleSize} matching records")
    
    // 3. Check for data anomalies - NULL values in key fields
    def nullCheckStmt = destinationConn.prepareStatement("""
        SELECT 
            SUM(CASE WHEN fuel_category_id IS NULL THEN 1 ELSE 0 END) as null_fuel_category,
            SUM(CASE WHEN legal_name IS NULL OR legal_name = '' THEN 1 ELSE 0 END) as null_legal_name,
            SUM(CASE WHEN received_or_transferred IS NULL THEN 1 ELSE 0 END) as null_rec_trans,
            SUM(CASE WHEN quantity IS NULL THEN 1 ELSE 0 END) as null_quantity
        FROM notional_transfer
        WHERE user_type::text = 'SUPPLIER'
    """)
    def nullCheckRS = nullCheckStmt.executeQuery()
    if (nullCheckRS.next()) {
        log.warn("\nData anomalies check:")
        log.warn("Records with NULL fuel_category_id: ${nullCheckRS.getInt('null_fuel_category')}")
        log.warn("Records with NULL/empty legal_name: ${nullCheckRS.getInt('null_legal_name')}")
        log.warn("Records with NULL received_or_transferred: ${nullCheckRS.getInt('null_rec_trans')}")
        log.warn("Records with NULL quantity: ${nullCheckRS.getInt('null_quantity')}")
    }
    nullCheckRS.close()
    nullCheckStmt.close()
    
    // 4. Verify transfer type mapping
    def transferTypeCheckStmt = destinationConn.prepareStatement("""
        SELECT received_or_transferred::text, COUNT(*) as count
        FROM notional_transfer
        WHERE user_type::text = 'SUPPLIER'
        GROUP BY received_or_transferred
    """)
    def transferTypeCheckRS = transferTypeCheckStmt.executeQuery()
    
    log.warn("\nTransfer type distribution:")
    while (transferTypeCheckRS.next()) {
        log.warn("${transferTypeCheckRS.getString(1)}: ${transferTypeCheckRS.getInt('count')} records")
    }
    transferTypeCheckRS.close()
    transferTypeCheckStmt.close()
    
    // 5. Version integrity check
    def versionCheckStmt = destinationConn.prepareStatement("""
        SELECT group_uuid, COUNT(*) as version_count, MIN(version) as min_version, MAX(version) as max_version
        FROM notional_transfer
        WHERE user_type::text = 'SUPPLIER'
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
            SELECT version FROM notional_transfer WHERE group_uuid = ? ORDER BY version
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
    
    // 6. Check for duplicate records within same compliance report
    def duplicateCheckStmt = destinationConn.prepareStatement("""
        SELECT compliance_report_id, legal_name, quantity, received_or_transferred::text, 
               COUNT(*) as count
        FROM notional_transfer
        WHERE version = 0 AND user_type::text = 'SUPPLIER'
        GROUP BY compliance_report_id, legal_name, quantity, received_or_transferred
        HAVING COUNT(*) > 1
        LIMIT 10
    """)
    def duplicateCheckRS = duplicateCheckStmt.executeQuery()
    
    int duplicateCount = 0
    while (duplicateCheckRS.next()) {
        duplicateCount++
        log.warn("Duplicate found: CR:${duplicateCheckRS.getInt('compliance_report_id')}, " +
                 "partner:${duplicateCheckRS.getString('legal_name')}, " +
                 "type:${duplicateCheckRS.getString('received_or_transferred')}, " +
                 "count:${duplicateCheckRS.getInt('count')}")
    }
    duplicateCheckRS.close()
    duplicateCheckStmt.close()
    
    log.warn("\nDuplicate records check: ${duplicateCount > 0 ? duplicateCount + ' duplicates found' : 'No duplicates found'}")
    
    // 7. Ensure no new-period records were impacted
    def newPeriodCheckStmt = destinationConn.prepareStatement("""
        SELECT COUNT(*) as count
        FROM notional_transfer nt
        JOIN compliance_report cr ON cr.compliance_report_id = nt.compliance_report_id
        WHERE nt.user_type::text != 'SUPPLIER'
        AND EXISTS (
            SELECT 1 FROM notional_transfer nt2 
            WHERE nt2.group_uuid = nt.group_uuid 
            AND nt2.user_type::text = 'SUPPLIER'
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
    log.error('Error in notional transfer validation', e)
    throw e
} finally {
    sourceConn?.close()
    destinationConn?.close()
}

log.warn('**** END NOTIONAL TRANSFER VALIDATION ****')