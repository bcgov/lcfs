import groovy.json.JsonSlurper
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet

// Define Database Connections
def sourceDbcpService = context.controllerServiceLookup.getControllerService('3245b078-0192-1000-ffff-ffffba20c1eb')
def destinationDbcpService = context.controllerServiceLookup.getControllerService('3244bf63-0192-1000-ffff-ffffc8ec6d93')

log.warn('**** BEGIN OTHER USES (SCHEDULE C) VALIDATION ****')

Connection sourceConn = null
Connection destinationConn = null

try {
    sourceConn = sourceDbcpService.getConnection()
    destinationConn = destinationDbcpService.getConnection()
    
    // 1. Validate source database structure first
    def sourceTableCheckStmt = sourceConn.prepareStatement("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'compliance_report_schedule_c_record'
        ) AS table_exists
    """)
    def sourceTableCheckRS = sourceTableCheckStmt.executeQuery()
    def tableExists = false
    if (sourceTableCheckRS.next()) {
        tableExists = sourceTableCheckRS.getBoolean("table_exists")
    }
    sourceTableCheckRS.close()
    sourceTableCheckStmt.close()
    
    if (!tableExists) {
        log.error("ERROR: 'compliance_report_schedule_c_record' table does not exist in source database")
        throw new Exception("Table 'compliance_report_schedule_c_record' does not exist")
    }
    
    // Check expected_use table exists in source
    def expectedUseTableCheckStmt = sourceConn.prepareStatement("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'expected_use'
        ) AS table_exists
    """)
    def expectedUseTableCheckRS = expectedUseTableCheckStmt.executeQuery()
    def expectedUseTableExists = false
    if (expectedUseTableCheckRS.next()) {
        expectedUseTableExists = expectedUseTableCheckRS.getBoolean("table_exists")
    }
    expectedUseTableCheckRS.close()
    expectedUseTableCheckStmt.close()
    
    // 1. Compare source and destination record counts
    def sourceCountStmt = sourceConn.prepareStatement("""
        SELECT COUNT(*) AS count 
        FROM compliance_report_schedule_c_record
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
        FROM other_uses
        WHERE create_user::text = 'ETL'
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
    
    // 2. Skip sample validation if destination has no records
    if (destCount > 0) {
        // 2. Sample validation: Check several records for data integrity
        def sampleSize = 10
        
        // Modify query if expected_use table does not exist
        def sourceRecordsQuery = """
            SELECT 
                scr.id AS schedule_c_record_id,
                cr.id AS cr_legacy_id,
                scr.quantity,
                aft.name AS fuel_type,
                fc.fuel_class AS fuel_category
        """
        
        if (expectedUseTableExists) {
            sourceRecordsQuery += """,
                eu.description AS expected_use,
                scr.rationale"""
        } else {
            sourceRecordsQuery += """,
                'Other' AS expected_use,
                scr.rationale"""
        }
        
        sourceRecordsQuery += """
            FROM compliance_report_schedule_c_record scr
            JOIN compliance_report_schedule_c sc ON sc.id = scr.schedule_id
            JOIN compliance_report cr ON cr.schedule_c_id = sc.id
            JOIN approved_fuel_type aft ON aft.id = scr.fuel_type_id
            JOIN fuel_class fc ON fc.id = scr.fuel_class_id
        """
        
        if (expectedUseTableExists) {
            sourceRecordsQuery += "JOIN expected_use eu ON eu.id = scr.expected_use_id"
        }
        
        sourceRecordsQuery += """
            ORDER BY cr.id
            LIMIT ${sampleSize}
        """
        
        def sourceRecordsStmt = sourceConn.prepareStatement(sourceRecordsQuery)
        def sourceRecordsRS = sourceRecordsStmt.executeQuery()
        def matchCount = 0
        
        log.warn("\nValidating sample records...")
        while (sourceRecordsRS.next()) {
            def legacyId = sourceRecordsRS.getInt("cr_legacy_id")
            def fuelType = sourceRecordsRS.getString("fuel_type")
            def quantity = sourceRecordsRS.getBigDecimal("quantity")
            
            // Find matching record in LCFS
            def destRecordStmt = destinationConn.prepareStatement("""
                SELECT ou.*, cr.legacy_id, ft.fuel_type, et.name AS expected_use_type
                FROM other_uses ou
                JOIN compliance_report cr ON cr.compliance_report_id = ou.compliance_report_id
                JOIN fuel_type ft ON ft.fuel_type_id = ou.fuel_type_id
                JOIN expected_use_type et ON et.expected_use_type_id = ou.expected_use_type_id
                WHERE cr.legacy_id = ?
                AND ft.fuel_type = ?
                AND ABS(ou.quantity_supplied - ?) < 0.01
                AND ou.create_user::text = 'ETL'
                LIMIT 1
            """)
            destRecordStmt.setInt(1, legacyId)
            destRecordStmt.setString(2, fuelType)
            destRecordStmt.setBigDecimal(3, quantity)
            
            def destRecordRS = destRecordStmt.executeQuery()
            if (destRecordRS.next()) {
                matchCount++
                log.warn("✓ Record for compliance report ${legacyId}, fuel type ${fuelType} matches")
            } else {
                log.warn("✗ No match found for compliance report ${legacyId}, fuel type ${fuelType}")
            }
            destRecordRS.close()
            destRecordStmt.close()
        }
        sourceRecordsRS.close()
        sourceRecordsStmt.close()
        
        log.warn("Found ${matchCount}/${sampleSize} matching records")
        
        // 3. Check mapping integrity - expected_use_type_id mapping
        def useMapStmt = destinationConn.prepareStatement("""
            SELECT et.name, COUNT(*) AS count
            FROM other_uses ou
            JOIN expected_use_type et ON et.expected_use_type_id = ou.expected_use_type_id
            WHERE ou.create_user::text = 'ETL'
            GROUP BY et.name
            ORDER BY count DESC
        """)
        def useMapRS = useMapStmt.executeQuery()
        
        log.warn("\nExpected use mapping distribution:")
        while (useMapRS.next()) {
            log.warn("${useMapRS.getString('name')}: ${useMapRS.getInt('count')} records")
        }
        useMapRS.close()
        useMapStmt.close()
        
        // 4. Check for data anomalies - NULL values in key fields
        def nullCheckStmt = destinationConn.prepareStatement("""
            SELECT 
                SUM(CASE WHEN fuel_category_id IS NULL THEN 1 ELSE 0 END) as null_fuel_category,
                SUM(CASE WHEN fuel_type_id IS NULL THEN 1 ELSE 0 END) as null_fuel_type,
                SUM(CASE WHEN expected_use_type_id IS NULL THEN 1 ELSE 0 END) as null_expected_use,
                SUM(CASE WHEN quantity_supplied IS NULL THEN 1 ELSE 0 END) as null_quantity
            FROM other_uses
            WHERE create_user::text = 'ETL'
        """)
        def nullCheckRS = nullCheckStmt.executeQuery()
        if (nullCheckRS.next()) {
            log.warn("\nData anomalies check:")
            log.warn("Records with NULL fuel_category_id: ${nullCheckRS.getInt('null_fuel_category')}")
            log.warn("Records with NULL fuel_type_id: ${nullCheckRS.getInt('null_fuel_type')}")
            log.warn("Records with NULL expected_use_type_id: ${nullCheckRS.getInt('null_expected_use')}")
            log.warn("Records with NULL quantity_supplied: ${nullCheckRS.getInt('null_quantity')}")
        }
        nullCheckRS.close()
        nullCheckStmt.close()
        
        // 5. Version integrity check
        def versionCheckStmt = destinationConn.prepareStatement("""
            SELECT group_uuid, COUNT(*) as version_count, MIN(version) as min_version, MAX(version) as max_version
            FROM other_uses
            WHERE create_user::text = 'ETL'
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
                SELECT version FROM other_uses WHERE group_uuid = ? ORDER BY version
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
            SELECT action_type::text, COUNT(*) as count
            FROM other_uses
            WHERE create_user::text = 'ETL'
            GROUP BY action_type
        """)
        def actionTypeRS = actionTypeStmt.executeQuery()
        
        log.warn("\nAction type distribution:")
        while (actionTypeRS.next()) {
            log.warn("${actionTypeRS.getString(1)}: ${actionTypeRS.getInt('count')} records")
        }
        actionTypeRS.close()
        actionTypeStmt.close()
        
        // 7. Ensure no new-period records were impacted
        def newPeriodCheckStmt = destinationConn.prepareStatement("""
            SELECT COUNT(*) as count
            FROM other_uses ou
            JOIN compliance_report cr ON cr.compliance_report_id = ou.compliance_report_id
            WHERE ou.create_user::text != 'ETL'
            AND ou.update_user::text = 'ETL'
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
    } else {
        log.warn("\nNo other_uses records found in destination - skipping validation checks")
    }
    
} catch (Exception e) {
    log.error('Error in other uses validation', e)
    throw e
} finally {
    sourceConn?.close()
    destinationConn?.close()
}

log.warn('**** END OTHER USES (SCHEDULE C) VALIDATION ****')