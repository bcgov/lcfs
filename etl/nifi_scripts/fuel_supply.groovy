import groovy.json.JsonSlurper
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.sql.Timestamp
import java.util.UUID
import java.nio.charset.StandardCharsets
import java.time.OffsetDateTime
import java.time.Instant

// Define Database Connections
def sourceDbcpService = context.controllerServiceLookup.getControllerService('3245b078-0192-1000-ffff-ffffba20c1eb')
def destinationDbcpService = context.controllerServiceLookup.getControllerService('3244bf63-0192-1000-ffff-ffffc8ec6d93')

log.warn('**** BEGIN FUEL SUPPLY MIGRATION ****')
// Declare connection variables at script level so they're visible in finally block
// Connections will be managed per-report inside the loop
// Connection sourceConn = null 
// Connection destinationConn = null 
// Track records with null quantity issues
def failedRecords = []

try {
    // Validate database connections can be established
    try {
        sourceConn = sourceDbcpService.getConnection()
        log.warn('Successfully connected to source database')
    } catch (Exception e) {
        log.error('Failed to connect to source database: ' + e.getMessage())
        throw e
    }
    
    try {
        destinationConn = destinationDbcpService.getConnection()
        log.warn('Successfully connected to destination database')
    } catch (Exception e) {
        log.error('Failed to connect to destination database: ' + e.getMessage())
        throw e
    }
    
    // Validate source database structure
    def sourceTableCheckStmt = sourceConn.prepareStatement('''
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'compliance_report_schedule_b_record'
        ) AS table_exists
    ''')
    def sourceTableCheckRS = sourceTableCheckStmt.executeQuery()
    def tableExists = false
    if (sourceTableCheckRS.next()) {
        tableExists = sourceTableCheckRS.getBoolean('table_exists')
    }
    sourceTableCheckRS.close()
    sourceTableCheckStmt.close()
    
    if (!tableExists) {
        throw new Exception("Table 'compliance_report_schedule_b_record' does not exist in source database")
    }

    // Unit mapping dictionary
    def unitMapping = [
        'L': 'Litres',
        'kg': 'Kilograms',
        'kWh': 'Kilowatt_hour',
        'm³': 'Cubic_metres'
    ]

    // Fetch compliance reports with non-null legacy_id from TFRS (source)
    def complianceReports = destinationConn.createStatement().executeQuery('''
        SELECT compliance_report_id, legacy_id, compliance_report_group_uuid, version
        FROM compliance_report
        WHERE legacy_id IS NOT NULL
    ''')

    while (complianceReports.next()) {
        def legacyId = complianceReports.getInt('legacy_id')
        def complianceReportId = complianceReports.getInt('compliance_report_id')
        def groupUuid = complianceReports.getString('compliance_report_group_uuid')
        def version = complianceReports.getInt('version')

        // --- Manage Connections Per Report --- 
        Connection sourceConn = null      // Define here
        Connection destinationConn = null // Define here
        try {
            // Get fresh connections for this report
            sourceConn = sourceDbcpService.getConnection()
            destinationConn = destinationDbcpService.getConnection()
            
            // Validate connections
            if (sourceConn == null || sourceConn.isClosed()) {
                 throw new Exception("Failed to get valid SOURCE connection for source CR ID ${legacyId}")
            }
            if (destinationConn == null || destinationConn.isClosed()) {
                 throw new Exception("Failed to get valid DESTINATION connection for source CR ID ${legacyId}")
            }
            log.warn("Acquired connections for source CR ID ${legacyId}")

            // --- Start processing logic for this report --- 

            // Fetch the corresponding snapshot record from compliance_report_snapshot in TFRS
            def snapshotStmt = sourceConn.prepareStatement('''
                SELECT snapshot
                FROM compliance_report_snapshot
                WHERE compliance_report_id = ?
            ''')
            snapshotStmt.setInt(1, legacyId)
            def snapshotResult = snapshotStmt.executeQuery()

            def useSnapshot = false
            def scheduleBRecords = []

            if (snapshotResult.next()) {
                // Parse JSON snapshot
                def snapshotJson = new JsonSlurper().parseText(snapshotResult.getString('snapshot'))
                if (snapshotJson.schedule_b && snapshotJson.schedule_b.records) {
                    scheduleBRecords = snapshotJson.schedule_b.records
                    useSnapshot = true
                }
            } else {
                log.warn("No snapshot found for source CR ID ${legacyId}. Using direct SQL query fallback.")
                useSnapshot = false
                // Fallback: Retrieve fuel supply data from TFRS using Sql.eachRow
                def fuelSupplySQL = """
                WITH schedule_b AS (
                        SELECT crsbr.id as fuel_supply_id,
                            cr.id as cr_legacy_id,
                            crsbr.quantity,
                            uom.name as unit_of_measure,
                            (SELECT cil.density
                            FROM carbon_intensity_limit cil
                            WHERE cil.fuel_class_id = crsbr.fuel_class_id
                                AND cil.effective_date <= cp.effective_date
                                AND cil.expiration_date > cp.effective_date
                            ORDER BY cil.effective_date DESC, cil.update_timestamp DESC
                            LIMIT 1) as ci_limit,
                            CASE
                                WHEN dt.the_type = 'Alternative' THEN crsbr.intensity
                                WHEN dt.the_type = 'GHGenius' THEN crsbr.intensity -- TODO fix intensity to extract from Schedule-D sheets
                                WHEN dt.the_type = 'Fuel Code' THEN fc1.carbon_intensity
                                WHEN dt.the_type IN ('Default Carbon Intensity', 'Carbon Intensity')
                                    THEN (SELECT dci.density
                                        FROM default_carbon_intensity dci
                                        JOIN default_carbon_intensity_category dcic
                                            ON dcic.id = aft.default_carbon_intensity_category_id
                                        WHERE dci.effective_date <= cp.effective_date
                                            AND dci.expiration_date > cp.effective_date
                                        ORDER BY dci.effective_date DESC, dci.update_timestamp DESC
                                        LIMIT 1)
                                ELSE NULL
                            END as ci_of_fuel,
                            (SELECT ed.density
                            FROM energy_density ed
                            JOIN energy_density_category edc
                                ON edc.id = aft.energy_density_category_id
                            WHERE ed.effective_date <= cp.effective_date
                                AND ed.expiration_date > cp.effective_date
                            ORDER BY ed.effective_date DESC, ed.update_timestamp DESC
                            LIMIT 1) as energy_density,
                            (SELECT eer.ratio
                            FROM energy_effectiveness_ratio eer
                            JOIN energy_effectiveness_ratio_category eerc
                                ON eerc.id = aft.energy_effectiveness_ratio_category_id
                            WHERE eer.effective_date <= cp.effective_date
                                AND eer.expiration_date > cp.effective_date
                            ORDER BY eer.effective_date DESC, eer.update_timestamp DESC
                            LIMIT 1) as eer,
                            fc.fuel_class as fuel_category,
                            fc1.fuel_code as fuel_code_prefix,
                            CAST(CONCAT(fc1.fuel_code_version, '.', fc1.fuel_code_version_minor) AS CHAR) as fuel_code_suffix,
                            aft.name as fuel_type,
                            CONCAT(TRIM(pa.description), ' - ', TRIM(pa.provision)) as provision_act,
                            cr.create_timestamp as create_date,
                            cr.update_timestamp as update_date,
                            'ETL' as create_user,
                            'ETL' as update_user,
                            'SUPPLIER' as user_type,
                            'CREATE' as action_type
                        FROM compliance_report_schedule_b_record crsbr
                        INNER JOIN fuel_class fc ON fc.id = crsbr.fuel_class_id
                        INNER JOIN approved_fuel_type aft ON aft.id = crsbr.fuel_type_id
                        INNER JOIN provision_act pa ON pa.id = crsbr.provision_of_the_act_id
                        LEFT JOIN carbon_intensity_fuel_determination cifd
                            ON cifd.fuel_id = aft.id AND cifd.provision_act_id = pa.id
                        LEFT JOIN determination_type dt ON dt.id = cifd.determination_type_id
                        INNER JOIN compliance_report cr ON cr.schedule_b_id = crsbr.schedule_id
                        INNER JOIN compliance_period cp ON cp.id = cr.compliance_period_id
                        LEFT JOIN fuel_code fc1 ON fc1.id = crsbr.fuel_code_id
                        LEFT JOIN unit_of_measure uom ON uom.id = aft.unit_of_measure_id
                        WHERE cr.id = ?
                    )
                    SELECT b.*, (b.energy_density * b.quantity) AS energy_content,
                        ((((b.ci_limit * b.eer) - b.ci_of_fuel) * (b.energy_density * b.quantity)) / 1000000) AS compliance_units
                    FROM schedule_b b
                """
                
                // Use Groovy Sql for robust row iteration
                def sql = new groovy.sql.Sql(sourceConn)
                try {
                    sql.eachRow(fuelSupplySQL, [legacyId]) { record ->
                        // --- Process Each SQL Record --- 
                        // The 'record' object here is a GroovyRowResult, supports .get()
                        log.warn("Processing SQL fallback record for source CR ID ${legacyId}")
                        processScheduleBRecord(record, useSnapshot, complianceReportId, legacyId, groupUuid, version, unitMapping, destinationConn, failedRecords, log)
                    } // end sql.eachRow
                } finally {
                    sql.close() // Close the groovy.sql.Sql instance
                }
            }

            // --- Process Snapshot Records (if applicable) --- 
            if (useSnapshot) {
                log.warn("Processing ${scheduleBRecords.size()} records from snapshot for source CR ID ${legacyId}")
                 // Add validation to ensure we have valid records before iterating
                if (scheduleBRecords == null || scheduleBRecords.isEmpty()) {
                    log.warn("Snapshot record list is null or empty for source CR ID ${legacyId} - skipping.")
                    continue
                }

                scheduleBRecords.each { record ->
                    // The 'record' object here is a LazyMap
                    processScheduleBRecord(record, useSnapshot, complianceReportId, legacyId, groupUuid, version, unitMapping, destinationConn, failedRecords, log)
                }
            }

            // --- End processing logic for this report --- 

        } catch (Exception reportEx) {
            // Log errors specific to processing this single report
            log.error("Error processing source compliance report ID ${legacyId}: ${reportEx.getMessage()}")
            failedRecords << [
                 crId: legacyId,
                 complianceReportId: complianceReportId,
                 recordType: 'Report Level',
                 reason: "Exception during report processing: ${reportEx.getMessage()}",
                 recordData: "N/A"
            ]
            // Continue to the next report
        } finally {
            // --- Ensure Connections are Closed for this Report --- 
            if (sourceConn != null) {
                try {
                    sourceConn.close()
                    // log.warn("Closed source connection for source CR ID ${legacyId}") // Optional: reduces log noise
                } catch (Exception e) {
                    log.error("Error closing source connection for source CR ID ${legacyId}: " + e.getMessage())
                }
            }
             if (destinationConn != null) {
                try {
                    destinationConn.close()
                    // log.warn("Closed destination connection for source CR ID ${legacyId}") // Optional: reduces log noise
                } catch (Exception e) {
                    log.error("Error closing destination connection for source CR ID ${legacyId}: " + e.getMessage())
                }
            }
        }
        // --- End Connection Management for this Report --- 

    } // end while (complianceReports.next())
    complianceReports.close()
    
} catch (Exception e) {
    log.error('Error running Fuel Supply migration: ' + e.getMessage())
    log.error('Stack trace: ' + e.getStackTrace().join("\n"))
    throw e
}

// --- Helper Function to Process Schedule B Record (Snapshot Map or SQL GroovyRowResult) --- 
def processScheduleBRecord(record, useSnapshot, complianceReportId, legacyId, groupUuid, version, unitMapping, destinationConn, failedRecords, log) {
    try {
        // Skip null records (paranoid check)
        if (record == null) {
            log.warn("Skipping null record passed to processScheduleBRecord for source CR ID ${legacyId}")
            return
        }

        log.warn("Processing record of type: ${record.getClass().name} for source CR ID ${legacyId}")

        // Safe function to get numeric values - handles snapshot maps and SQL result objects
        def safeGetNumber = { String fieldName ->
            def result = null
            def val = null
            try {
                if (useSnapshot) {
                    // Use .get() for snapshot maps
                    val = record.get(fieldName)
                } else {
                    // Use ['key'] syntax for SQL proxy objects
                    val = record[fieldName]
                }

                // Handle explicit "null" string values.
                if (val instanceof String && val.equalsIgnoreCase("null")) {
                    val = null
                }

                // If the field is missing or null, record the issue for quantity.
                if (val == null) {
                    if (fieldName == "quantity") {
                        def errorMsg = "ERROR: Found null quantity in source data for field '${fieldName}' for CR ID ${legacyId}"
                        log.error(errorMsg)
                        failedRecords << [
                            crId: legacyId,
                            complianceReportId: complianceReportId,
                            recordType: record.getClass().name,
                            reason: "Null quantity value",
                            recordData: "Record data preview unavailable in helper function"
                        ]
                    }
                    return null 
                }

                // Convert to BigDecimal.
                if (val instanceof String) {
                    val = val.trim().replaceAll(",", "")
                    if (val.matches("-?\\d+(\\.\\d+)?")) {
                        result = new BigDecimal(val)
                    } else {
                        log.warn("String value '${val}' for ${fieldName} (CR ID ${legacyId}) is not a valid number")
                        if (fieldName == "quantity") {
                            log.error("ERROR: Invalid quantity value '${val}' in source data for CR ID ${legacyId}.")
                            failedRecords << [
                                crId: legacyId,
                                complianceReportId: complianceReportId,
                                recordType: record.getClass().name,
                                reason: "Non-numeric quantity value: '${val}'",
                                recordData: "Record data preview unavailable in helper function"
                            ]
                            return null
                        }
                        result = null
                    }
                } else if (val instanceof Number) {
                    result = new BigDecimal(val.toString())
                } else {
                    log.warn("Unknown type for ${fieldName} (CR ID ${legacyId}): ${val.getClass().name}")
                    if (fieldName == "quantity") {
                        log.error("ERROR: Quantity has unexpected type: ${val.getClass().name} for CR ID ${legacyId}. Cannot convert.")
                        failedRecords << [
                            crId: legacyId,
                            complianceReportId: complianceReportId,
                            recordType: record.getClass().name,
                            reason: "Quantity has unexpected type: ${val.getClass().name}",
                            recordData: "Record data preview unavailable in helper function"
                        ]
                        return null
                    }
                    result = null
                }
            } catch (Exception e) {
                log.warn("Error accessing/converting ${fieldName} for CR ID ${legacyId}: " + e.getMessage())
                if (fieldName == "quantity") {
                    log.error("ERROR: Exception while processing quantity value for CR ID ${legacyId}: ${e.getMessage()}")
                    failedRecords << [
                        crId: legacyId,
                        complianceReportId: complianceReportId,
                        recordType: record.getClass().name,
                        reason: "Exception while processing quantity: ${e.getMessage()}",
                        recordData: "Record data preview unavailable in helper function"
                    ]
                    return null
                }
            }
            return result
        }

        // --- Lookups using appropriate access method --- 
        // Unit of Measure
        def unitOfMeasure = null
        try {
            unitOfMeasure = useSnapshot ? record.get('unit_of_measure') : record['unit_of_measure']
        } catch (Exception e) {
             log.warn("Error accessing unit_of_measure for CR ID ${legacyId}: " + e.getMessage())
        }
        def unitFullForm = unitOfMeasure != null ? unitMapping.get(unitOfMeasure, unitOfMeasure) : null

        // Provision of the Act
        def provisionLookupValue = null
        try {
            if (useSnapshot) {
                def description = record.get('provision_of_the_act_description')
                def provision = record.get('provision_of_the_act')
                if (description != null && provision != null) { provisionLookupValue = "${description} - ${provision}" }
            } else {
                provisionLookupValue = record["provision_act"]
            }
        } catch (Exception e) {
             log.warn("Error determining provision value for CR ID ${legacyId}: " + e.getMessage())
        }
        def provisionId = null
        if (provisionLookupValue != null) {
            // Check connection before preparing statement
            if (destinationConn == null || destinationConn.isClosed()) { throw new Exception("Destination connection is null or closed before provision lookup!") }
            def provisionStmt = destinationConn.prepareStatement('''SELECT provision_of_the_act_id FROM provision_of_the_act WHERE name = ?''')
            try {
                provisionStmt.setString(1, provisionLookupValue)
                def provisionResult = provisionStmt.executeQuery()
                provisionId = provisionResult.next() ? provisionResult.getInt('provision_of_the_act_id') : null
                provisionResult.close()
            } finally {
                provisionStmt.close()
            }
        } else {
            log.warn("Provision lookup value is null for source CR ID ${legacyId}")
        }

        // Fuel Category
        def fuelCategoryLookupValue = null
        try {
            fuelCategoryLookupValue = useSnapshot ? record.get('fuel_class') : record['fuel_category']
        } catch (Exception e) {
             log.warn("Error determining fuel category for CR ID ${legacyId}: " + e.getMessage())
        }
        def fuelCategoryId = null
        if (fuelCategoryLookupValue != null) {
            // Check connection before preparing statement
            if (destinationConn == null || destinationConn.isClosed()) { throw new Exception("Destination connection is null or closed before fuel category lookup!") }
            def fuelCategoryStmt = destinationConn.prepareStatement('''SELECT fuel_category_id FROM fuel_category WHERE category = ?::fuel_category_enum''')
            try {
                fuelCategoryStmt.setString(1, fuelCategoryLookupValue)
                def fuelCategoryResult = fuelCategoryStmt.executeQuery()
                fuelCategoryId = fuelCategoryResult.next() ? fuelCategoryResult.getInt('fuel_category_id') : null
                fuelCategoryResult.close()
            } finally {
                fuelCategoryStmt.close()
            }
        } else {
            log.warn("Fuel category lookup value is null for CR ID ${legacyId}")
        }

        // Fuel Code
        def fuelCodeLookupValue = null
        def fuelCodeSuffixValue = null
        def fuelCodeId = null
        try {
            if (useSnapshot) {
                def fullFuelCode = record.get('fuel_code')
                if (fullFuelCode != null) {
                    String fuelCodeStr = fullFuelCode.toString()
                    fuelCodeLookupValue = fuelCodeStr.length() >= 4 ? fuelCodeStr.substring(0, 4) : fuelCodeStr
                    fuelCodeSuffixValue = fuelCodeStr.length() > 4 ? fuelCodeStr.substring(4) : ""
                } else { log.warn("Fuel code is null in snapshot for CR ID ${legacyId}") }
            } else {
                fuelCodeLookupValue = record["fuel_code_prefix"]
                fuelCodeSuffixValue = record["fuel_code_suffix"]
            }
        } catch (Exception e) {
             log.warn("Error determining fuel code components for CR ID ${legacyId}: " + e.getMessage())
        }
        if (fuelCodeLookupValue != null) {
            // Check connection before preparing statement
            if (destinationConn == null || destinationConn.isClosed()) { throw new Exception("Destination connection is null or closed before fuel code lookup!") }
            def fuelCodeStmt = destinationConn.prepareStatement('''SELECT fuel_code_id FROM fuel_code fc JOIN fuel_code_prefix fcp ON fcp.fuel_code_prefix_id = fc.prefix_id WHERE fcp.prefix = ? AND fc.fuel_suffix = ?''')
            try {
                fuelCodeStmt.setString(1, fuelCodeLookupValue)
                fuelCodeStmt.setString(2, fuelCodeSuffixValue ?: "") 
                def fuelCodeResult = fuelCodeStmt.executeQuery()
                fuelCodeId = fuelCodeResult.next() ? fuelCodeResult.getInt('fuel_code_id') : null
                fuelCodeResult.close()
            } finally {
                fuelCodeStmt.close()
            }
        } else {
            log.warn("Fuel code prefix is null for CR ID ${legacyId}")
        }

        // Fuel Type
        def fuelTypeLookupValue = null
        try {
             fuelTypeLookupValue = useSnapshot ? record.get('fuel_type') : record['fuel_type']
        } catch (Exception e) {
             log.warn("Error determining fuel type for CR ID ${legacyId}: " + e.getMessage())
        }
        def fuelTypeId = null
        if (fuelTypeLookupValue != null) {
            // Check connection before preparing statement
            if (destinationConn == null || destinationConn.isClosed()) { throw new Exception("Destination connection is null or closed before fuel type lookup!") }
            def fuelTypeStmt = destinationConn.prepareStatement('''SELECT fuel_type_id FROM fuel_type WHERE fuel_type = ?''')
            try {
                fuelTypeStmt.setString(1, fuelTypeLookupValue)
                def fuelTypeResult = fuelTypeStmt.executeQuery()
                fuelTypeId = fuelTypeResult.next() ? fuelTypeResult.getInt('fuel_type_id') : null
                fuelTypeResult.close()
            } finally {
                fuelTypeStmt.close()
            }
        } else {
            log.warn("Fuel type lookup value is null for CR ID ${legacyId}")
        }

        // --- Get Numeric Values --- 
        def quantity = safeGetNumber("quantity")
        def complianceUnits = null
        if (useSnapshot) {
            def credits = safeGetNumber("credits")
            def debits = safeGetNumber("debits")
            if (credits != null) { complianceUnits = credits.negate() }
            else if (debits != null) { complianceUnits = debits }
        } else {
            complianceUnits = safeGetNumber("compliance_units")
        }
        def ciLimit = safeGetNumber("ci_limit")
        def ciOfFuel = safeGetNumber("ci_of_fuel")
        def energyDensity = safeGetNumber("energy_density")
        def eer = safeGetNumber("eer")
        def energyContent = safeGetNumber("energy_content") 

        // --- PRE-INSERT VALIDATION --- 
        boolean canInsert = true
        List<String> validationErrors = []
        if (quantity == null) {
            canInsert = false
            validationErrors.add("Quantity is NULL or invalid")
        }
        if (unitFullForm == null) {
            canInsert = false
            validationErrors.add("Units (unit_of_measure) is NULL or could not be determined")
        }
        
        if (!canInsert) {
            log.error("Skipping insert for CR ID ${legacyId} (LCFS ID: ${complianceReportId}) due to validation errors: ${validationErrors.join(', ')}")
            if (!validationErrors.contains("Quantity is NULL or invalid")) {
                 failedRecords << [
                    crId: legacyId,
                    complianceReportId: complianceReportId,
                    recordType: record.getClass().name,
                    reason: "Validation failed: ${validationErrors.join(', ')}",
                    recordData: "Record data preview unavailable in helper function"
                 ]
            }
            return // Skip this record
        }
        
        // --- Insert Record --- 
        // Check connection before preparing final insert statement
        if (destinationConn == null || destinationConn.isClosed()) { throw new Exception("Destination connection is null or closed before final insert!") }
        def fuelSupplyInsertStmt = destinationConn.prepareStatement('''
            INSERT INTO public.fuel_supply (
                compliance_report_id, quantity, units, compliance_units, target_ci, ci_of_fuel,
                energy_density, eer, energy, fuel_type_other, fuel_category_id, fuel_code_id,
                fuel_type_id, provision_of_the_act_id, end_use_id, create_date, update_date,
                create_user, update_user, group_uuid, version, action_type
            ) VALUES (?, ?, ?::quantityunitsenum, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::actiontypeenum)
        ''')
        try {
            // Bind parameters
            fuelSupplyInsertStmt.setInt(1, complianceReportId)
            fuelSupplyInsertStmt.setBigDecimal(2, quantity)
            fuelSupplyInsertStmt.setString(3, unitFullForm)
            // ... (Bind remaining parameters 4-22 using setNull appropriately) ...
            if (complianceUnits != null) { fuelSupplyInsertStmt.setBigDecimal(4, complianceUnits) } else { fuelSupplyInsertStmt.setNull(4, java.sql.Types.NUMERIC) }
            if (ciLimit != null) { fuelSupplyInsertStmt.setBigDecimal(5, ciLimit) } else { fuelSupplyInsertStmt.setNull(5, java.sql.Types.NUMERIC) }
            if (ciOfFuel != null) { fuelSupplyInsertStmt.setBigDecimal(6, ciOfFuel) } else { fuelSupplyInsertStmt.setNull(6, java.sql.Types.NUMERIC) }
            if (energyDensity != null) { fuelSupplyInsertStmt.setBigDecimal(7, energyDensity) } else { fuelSupplyInsertStmt.setNull(7, java.sql.Types.NUMERIC) }
            if (eer != null) { fuelSupplyInsertStmt.setBigDecimal(8, eer) } else { fuelSupplyInsertStmt.setNull(8, java.sql.Types.NUMERIC) }
            if (energyContent != null) { fuelSupplyInsertStmt.setBigDecimal(9, energyContent) } else { fuelSupplyInsertStmt.setNull(9, java.sql.Types.NUMERIC) }
            fuelSupplyInsertStmt.setNull(10, java.sql.Types.VARCHAR) // fuel_type_other
            if (fuelCategoryId != null) { fuelSupplyInsertStmt.setInt(11, fuelCategoryId) } else { fuelSupplyInsertStmt.setNull(11, java.sql.Types.INTEGER) }
            if (fuelCodeId != null) { fuelSupplyInsertStmt.setInt(12, fuelCodeId) } else { fuelSupplyInsertStmt.setNull(12, java.sql.Types.INTEGER) }
            if (fuelTypeId != null) { fuelSupplyInsertStmt.setInt(13, fuelTypeId) } else { fuelSupplyInsertStmt.setNull(13, java.sql.Types.INTEGER) }
            if (provisionId != null) { fuelSupplyInsertStmt.setInt(14, provisionId) } else { fuelSupplyInsertStmt.setNull(14, java.sql.Types.INTEGER) }
            fuelSupplyInsertStmt.setNull(15, java.sql.Types.INTEGER) // end_use_id
            fuelSupplyInsertStmt.setNull(16, java.sql.Types.TIMESTAMP) // create_date
            fuelSupplyInsertStmt.setNull(17, java.sql.Types.TIMESTAMP) // update_date
            fuelSupplyInsertStmt.setString(18, 'ETL')
            fuelSupplyInsertStmt.setString(19, 'ETL')
            fuelSupplyInsertStmt.setString(20, groupUuid)
            fuelSupplyInsertStmt.setInt(21, version)
            fuelSupplyInsertStmt.setString(22, 'CREATE') // action_type

            fuelSupplyInsertStmt.executeUpdate()
        } finally {
            fuelSupplyInsertStmt.close()
        }

    } catch (Exception e) {
        log.error("Error processing individual record (CR ID ${legacyId}, LCFS ID: ${complianceReportId}): " + e.getMessage())
        log.error("Stack trace: " + e.getStackTrace().join("\n"))
        // Add to failed records
        failedRecords << [
            crId: legacyId,
            complianceReportId: complianceReportId,
            recordType: record?.getClass()?.name ?: 'Unknown',
            reason: "Exception during processing: ${e.getMessage()}",
            recordData: "Record data preview unavailable in helper function after error"
        ]
    }
} // end of processScheduleBRecord

log.warn('**** DONE: FUEL SUPPLY MIGRATION ****')