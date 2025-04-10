import groovy.json.JsonSlurper
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet

// Define Database Connections
def sourceDbcpService = context.controllerServiceLookup.getControllerService('3245b078-0192-1000-ffff-ffffba20c1eb')
def destinationDbcpService = context.controllerServiceLookup.getControllerService('3244bf63-0192-1000-ffff-ffffc8ec6d93')

log.warn('**** BEGIN FUEL SUPPLY VALIDATION ****')

Connection sourceConn = null
Connection destinationConn = null

try {
    sourceConn = sourceDbcpService.getConnection()
    destinationConn = destinationDbcpService.getConnection()
    
    // 1. Validate source database structure first to avoid errors
    def sourceTableCheckStmt = sourceConn.prepareStatement("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'compliance_report_schedule_b_record'
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
        log.error("ERROR: 'compliance_report_schedule_b_record' table does not exist in source database")
        throw new Exception("Table 'compliance_report_schedule_b_record' does not exist")
    }
    
    // 2. Compare source and destination record counts
    def sourceCountStmt = sourceConn.prepareStatement("""
        SELECT COUNT(*) AS count 
        FROM compliance_report_schedule_b_record crsbr
        JOIN compliance_report cr ON cr.schedule_b_id = crsbr.schedule_id
    """)
    def sourceCountRS = sourceCountStmt.executeQuery()
    def sourceCount = 0
    if (sourceCountRS.next()) {
        sourceCount = sourceCountRS.getInt("count")
    }
    sourceCountRS.close()
    sourceCountStmt.close()
    
    // 2.1 Check GHGenius records specifically
    def ghGeniusCountStmt = sourceConn.prepareStatement("""
        SELECT COUNT(*) AS count 
        FROM compliance_report_schedule_b_record crsbr
        JOIN carbon_intensity_fuel_determination cifd 
            ON cifd.fuel_id = crsbr.fuel_type_id 
            AND cifd.provision_act_id = crsbr.provision_of_the_act_id
        JOIN determination_type dt ON dt.id = cifd.determination_type_id
        WHERE dt.the_type = 'GHGenius'
    """)
    def ghGeniusCountRS = ghGeniusCountStmt.executeQuery()
    def ghGeniusSourceCount = 0
    if (ghGeniusCountRS.next()) {
        ghGeniusSourceCount = ghGeniusCountRS.getInt("count")
    }
    ghGeniusCountRS.close()
    ghGeniusCountStmt.close()
    
    def destCountStmt = destinationConn.prepareStatement("""
        SELECT COUNT(*) AS count 
        FROM fuel_supply
        WHERE create_user = 'ETL'
    """)
    def destCountRS = destCountStmt.executeQuery()
    def destCount = 0
    if (destCountRS.next()) {
        destCount = destCountRS.getInt("count")
    }
    destCountRS.close()
    destCountStmt.close()
    
    // Get GHGenius records count in destination
    def ghGeniusDestCountStmt = destinationConn.prepareStatement("""
        SELECT COUNT(*) AS count 
        FROM fuel_supply fs
        JOIN provision_of_the_act pota ON pota.provision_of_the_act_id = fs.provision_of_the_act_id
        WHERE fs.create_user = 'ETL' 
        AND pota.name = 'GHGenius modelled - Section 6 (5) (d) (ii) (A)'
    """)
    def ghGeniusDestCountRS = ghGeniusDestCountStmt.executeQuery()
    def ghGeniusDestCount = 0
    if (ghGeniusDestCountRS.next()) {
        ghGeniusDestCount = ghGeniusDestCountRS.getInt("count")
    }
    ghGeniusDestCountRS.close()
    ghGeniusDestCountStmt.close()
    
    log.warn("Source record count: ${sourceCount}")
    log.warn("Destination record count: ${destCount}")
    log.warn("Difference: ${destCount - sourceCount}")
    log.warn("\nGHGenius specific records:")
    log.warn("GHGenius source count: ${ghGeniusSourceCount}")
    log.warn("GHGenius destination count: ${ghGeniusDestCount}")
    log.warn("GHGenius difference: ${ghGeniusDestCount - ghGeniusSourceCount}")
    
    // 3. Sample validation: Check several records for data integrity
    def sampleSize = 10
    def sourceRecordsStmt = sourceConn.prepareStatement("""
        WITH schedule_b AS (
            SELECT crsbr.id as fuel_supply_id,
                cr.id as cr_legacy_id,
                crsbr.quantity,
                uom.name as unit_of_measure,
                fc.fuel_class as fuel_category,
                fc1.fuel_code as fuel_code_prefix,
                aft.name as fuel_type,
                CONCAT(TRIM(pa.description), ' - ', TRIM(pa.provision)) as provision_act
            FROM compliance_report_schedule_b_record crsbr
            INNER JOIN fuel_class fc ON fc.id = crsbr.fuel_class_id
            INNER JOIN approved_fuel_type aft ON aft.id = crsbr.fuel_type_id
            INNER JOIN provision_act pa ON pa.id = crsbr.provision_of_the_act_id
            INNER JOIN compliance_report cr ON cr.schedule_b_id = crsbr.schedule_id
            LEFT JOIN unit_of_measure uom ON uom.id = aft.unit_of_measure_id
            LEFT JOIN fuel_code fc1 ON fc1.id = crsbr.fuel_code_id
            ORDER BY cr.id
            LIMIT ${sampleSize}
        )
        SELECT * FROM schedule_b
    """)
    def sourceRecordsRS = sourceRecordsStmt.executeQuery()
    def matchCount = 0
    
    log.warn("\nValidating sample records...")
    while (sourceRecordsRS.next()) {
        def legacyId = sourceRecordsRS.getInt("cr_legacy_id")
        def fuelType = sourceRecordsRS.getString("fuel_type")
        def quantity = sourceRecordsRS.getBigDecimal("quantity")
        
        // Find matching record in LCFS
        def destRecordStmt = destinationConn.prepareStatement("""
            SELECT fs.*, cr.legacy_id
            FROM fuel_supply fs
            JOIN compliance_report cr ON cr.compliance_report_id = fs.compliance_report_id
            JOIN fuel_type ft ON ft.fuel_type_id = fs.fuel_type_id
            WHERE cr.legacy_id = ?
            AND ft.fuel_type = ?
            AND ABS(fs.quantity - ?) < 0.01
            AND fs.create_user = 'ETL'
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
    
    // 4. Check for data anomalies - NULL values in key fields
    def nullCheckStmt = destinationConn.prepareStatement("""
        SELECT 
            SUM(CASE WHEN fuel_category_id IS NULL THEN 1 ELSE 0 END) as null_fuel_category,
            SUM(CASE WHEN fuel_type_id IS NULL THEN 1 ELSE 0 END) as null_fuel_type,
            SUM(CASE WHEN provision_of_the_act_id IS NULL THEN 1 ELSE 0 END) as null_provision,
            SUM(CASE WHEN quantity IS NULL THEN 1 ELSE 0 END) as null_quantity
        FROM fuel_supply
        WHERE create_user = 'ETL'
    """)
    def nullCheckRS = nullCheckStmt.executeQuery()
    if (nullCheckRS.next()) {
        log.warn("\nData anomalies check:")
        log.warn("Records with NULL fuel_category_id: ${nullCheckRS.getInt('null_fuel_category')}")
        log.warn("Records with NULL fuel_type_id: ${nullCheckRS.getInt('null_fuel_type')}")
        log.warn("Records with NULL provision_of_the_act_id: ${nullCheckRS.getInt('null_provision')}")
        log.warn("Records with NULL quantity: ${nullCheckRS.getInt('null_quantity')}")
    }
    nullCheckRS.close()
    nullCheckStmt.close()
    
    // 5. Check calculation consistency
    def calcCheckStmt = destinationConn.prepareStatement("""
        SELECT 
            compliance_report_id,
            quantity,
            energy_density,
            energy,
            ci_of_fuel,
            target_ci,
            eer,
            compliance_units,
            ABS(energy - (quantity * energy_density)) > 0.01 as energy_calc_error,
            ABS(compliance_units - ((((target_ci * eer) - ci_of_fuel) * (energy_density * quantity)) / 1000000)) > 0.1 as compliance_unit_calc_error
        FROM fuel_supply
        WHERE create_user = 'ETL'
        LIMIT 20
    """)
    def calcCheckRS = calcCheckStmt.executeQuery()
    
    int energyErrors = 0
    int cuErrors = 0
    int totalChecked = 0
    
    while (calcCheckRS.next()) {
        totalChecked++
        if (calcCheckRS.getBoolean("energy_calc_error")) energyErrors++
        if (calcCheckRS.getBoolean("compliance_unit_calc_error")) cuErrors++
    }
    calcCheckRS.close()
    calcCheckStmt.close()
    
    log.warn("\nCalculation validation (from 20 sample records):")
    log.warn("Energy calculation errors: ${energyErrors}/${totalChecked}")
    log.warn("Compliance units calculation errors: ${cuErrors}/${totalChecked}")
    
    // 5.1 Check specific GHGenius records
    def ghGeniusRecordsStmt = destinationConn.prepareStatement("""
        SELECT fs.*, pota.name AS provision_name
        FROM fuel_supply fs
        JOIN provision_of_the_act pota ON pota.provision_of_the_act_id = fs.provision_of_the_act_id
        WHERE pota.name = 'GHGenius modelled - Section 6 (5) (d) (ii) (A)'
        AND fs.create_user = 'ETL'
        LIMIT 10
    """)
    def ghGeniusRecordsRS = ghGeniusRecordsStmt.executeQuery()
    
    log.warn("\nGHGenius record validation:")
    def ghGeniusCount = 0
    def ghGeniusWithCICount = 0
    while (ghGeniusRecordsRS.next()) {
        ghGeniusCount++
        def reportId = ghGeniusRecordsRS.getInt("compliance_report_id")
        def ciOfFuel = ghGeniusRecordsRS.getBigDecimal("ci_of_fuel")
        
        if (ciOfFuel != null && ciOfFuel != 0) {
            ghGeniusWithCICount++
            log.warn("✓ GHGenius record for compliance report ${reportId} has CI: ${ciOfFuel}")
        } else {
            log.warn("✗ GHGenius record for compliance report ${reportId} missing CI value")
        }
    }
    ghGeniusRecordsRS.close()
    ghGeniusRecordsStmt.close()
    
    log.warn("Found ${ghGeniusWithCICount}/${ghGeniusCount} GHGenius records with correct CI values")
    
    // 6. Check for duplicate records
    def duplicateCheckStmt = destinationConn.prepareStatement("""
        SELECT compliance_report_id, fuel_type_id, quantity, COUNT(*) as count
        FROM fuel_supply
        WHERE create_user = 'ETL'
        GROUP BY compliance_report_id, fuel_type_id, quantity
        HAVING COUNT(*) > 1
        LIMIT 10
    """)
    def duplicateCheckRS = duplicateCheckStmt.executeQuery()
    
    int duplicateCount = 0
    while (duplicateCheckRS.next()) {
        duplicateCount++
        log.warn("Duplicate found: CR:${duplicateCheckRS.getInt('compliance_report_id')}, " +
                 "fuel_type:${duplicateCheckRS.getInt('fuel_type_id')}, " +
                 "quantity:${duplicateCheckRS.getBigDecimal('quantity')}, " +
                 "count:${duplicateCheckRS.getInt('count')}")
    }
    duplicateCheckRS.close()
    duplicateCheckStmt.close()
    
    log.warn("\nDuplicate records check: ${duplicateCount > 0 ? duplicateCount + ' duplicates found' : 'No duplicates found'}")
    
    // 7. Ensure no new-period records were impacted
    def newPeriodCheckStmt = destinationConn.prepareStatement("""
        SELECT COUNT(*) as count
        FROM fuel_supply fs
        JOIN compliance_report cr ON cr.compliance_report_id = fs.compliance_report_id
        WHERE fs.create_user != 'ETL'
        AND fs.update_user = 'ETL'
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
    log.error('Error in fuel supply validation', e)
    throw e
} finally {
    sourceConn?.close()
    destinationConn?.close()
}

log.warn('**** END FUEL SUPPLY VALIDATION ****')