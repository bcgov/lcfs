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
Connection sourceConn = null
Connection destinationConn = null
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
            // Fallback: Retrieve fuel supply data from TFRS if snapshot is missing
            def fuelSupplyStmt = sourceConn.prepareStatement("""
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
            """)
            fuelSupplyStmt.setInt(1, legacyId)
            scheduleBRecords = fuelSupplyStmt.executeQuery().collect { it }
        }

        log.warn("Processing ${scheduleBRecords.size()} schedule B records")
        
        // Add validation to ensure we have valid records before iterating
        if (scheduleBRecords == null) {
            log.warn("scheduleBRecords is null - skipping processing")
            continue
        }
        
        if (scheduleBRecords.isEmpty()) {
            log.warn("No schedule B records found for compliance report ${legacyId}")
            continue
        }
        
        // For debugging special cases
        if (legacyId == 7) {
            log.warn("DEBUG: Examining scheduleBRecords for CR ID 7:")
            scheduleBRecords.eachWithIndex { rec, idx ->
                log.warn("Record #${idx} type: ${rec.getClass().name}")
                if (rec instanceof Map) {
                    log.warn("Keys available: ${rec.keySet()}")
                    // Print first few values to see structure
                    def count = 0
                    rec.each { k, v ->
                        if (count < 5) {
                            log.warn("   $k = $v (${v?.getClass()?.name ?: 'null'})")
                            count++
                        }
                    }
                } else {
                    log.warn("Not a map: ${rec}")
                }
            }
        }
        
        try {
            scheduleBRecords.each { record ->
                // Skip null records
                if (record == null) {
                    log.warn("Skipping null record")
                    return
                }
                
                log.warn("Processing record of type: ${record.getClass().name}")
                
                // Safely access unit_of_measure without defaults
                def unitOfMeasure = null
                try {
                    if (useSnapshot) {
                        unitOfMeasure = record.unit_of_measure
                    } else {
                        // For ResultSet objects, try to get the value safely
                        try {
                            unitOfMeasure = record.getString("unit_of_measure")
                        } catch (Exception e1) {
                            // Try direct property access as fallback
                            try {
                                unitOfMeasure = record.unit_of_measure
                            } catch (Exception e2) {
                                log.warn("Cannot access unit_of_measure: " + e2.getMessage())
                            }
                        }
                    }
                } catch (Exception e) {
                    log.warn("Error accessing unit_of_measure: " + e.getMessage())
                }
            
            // Map unit values - keep original if not in mapping
            def unitFullForm = unitOfMeasure != null ? unitMapping.get(unitOfMeasure, unitOfMeasure) : null

            // Lookup provision_of_the_act_id - safely access properties
            def provisionLookupValue = null
            try {
                if (useSnapshot) {
                    def description = null
                    def provision = null
                    try {
                        description = record.provision_of_the_act_description
                        provision = record.provision_of_the_act
                        if (description != null && provision != null) {
                            provisionLookupValue = "${description} - ${provision}"
                        }
                    } catch (Exception e) {
                        log.warn("Error accessing provision data from snapshot: " + e.getMessage())
                    }
                } else {
                    // Try to get provision_act safely from ResultSet
                    try {
                        provisionLookupValue = record.getString("provision_act")
                    } catch (Exception e1) {
                        try {
                            provisionLookupValue = record.provision_act
                        } catch (Exception e2) {
                            log.warn("Cannot access provision_act: " + e2.getMessage())
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Error determining provision value: " + e.getMessage())
            }
            
            def provisionId = null
            if (provisionLookupValue != null) {
                def provisionStmt = destinationConn.prepareStatement('''
                    SELECT provision_of_the_act_id FROM provision_of_the_act WHERE name = ?
                ''')
                provisionStmt.setString(1, provisionLookupValue)
                def provisionResult = provisionStmt.executeQuery()
                provisionId = provisionResult.next() ? provisionResult.getInt('provision_of_the_act_id') : null
            }

            // Lookup fuel_category_id - safely access properties
            def fuelCategoryLookupValue = null
            try {
                if (useSnapshot) {
                    try {
                        fuelCategoryLookupValue = record.fuel_class
                    } catch (Exception e) {
                        log.warn("Cannot access fuel_class from snapshot: " + e.getMessage())
                    }
                } else {
                    // Try to get fuel_category safely from ResultSet
                    try {
                        fuelCategoryLookupValue = record.getString("fuel_category")
                    } catch (Exception e1) {
                        try {
                            fuelCategoryLookupValue = record.fuel_category
                        } catch (Exception e2) {
                            log.warn("Cannot access fuel_category: " + e2.getMessage())
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Error determining fuel category: " + e.getMessage())
            }
            
            def fuelCategoryId = null
            if (fuelCategoryLookupValue != null) {
                def fuelCategoryStmt = destinationConn.prepareStatement('''
                    SELECT fuel_category_id FROM fuel_category WHERE category = ?::fuel_category_enum
                ''')
                fuelCategoryStmt.setString(1, fuelCategoryLookupValue)
                def fuelCategoryResult = fuelCategoryStmt.executeQuery()
                fuelCategoryId = fuelCategoryResult.next() ? fuelCategoryResult.getInt('fuel_category_id') : null
            }

            // Lookup fuel_code_id
            def fuelCodeStmt = destinationConn.prepareStatement('''
                select * from fuel_code fc, fuel_code_prefix fcp where fcp.fuel_code_prefix_id  = fc.prefix_id and fcp.prefix = ? and fc.fuel_suffix = ?
            ''')
            def fuelCodeId = null
            def fuelCode = null
            
            // Safely access fuel_code or fuel_code_prefix
            try {
                if (useSnapshot) {
                    try {
                        fuelCode = record.fuel_code
                    } catch (Exception e) {
                        log.warn("Cannot access fuel_code from snapshot: " + e.getMessage())
                    }
                } else {
                    // For SQL data, try to get fuel_code_prefix
                    try {
                        fuelCode = record.getString("fuel_code_prefix")
                    } catch (Exception e1) {
                        try {
                            fuelCode = record.fuel_code_prefix
                        } catch (Exception e2) {
                            log.warn("Cannot access fuel_code_prefix: " + e2.getMessage())
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Error determining fuel code: " + e.getMessage())
            }
            
            if (fuelCode != null) {
                try {
                    // Convert to string if it's not already a string
                    String fuelCodeStr = fuelCode.toString()
                    
                    def prefix = fuelCodeStr.length() >= 4 ? fuelCodeStr.substring(0, 4) : fuelCodeStr
                    def suffix = fuelCodeStr.length() > 4 ? fuelCodeStr.substring(4) : ""
                    
                    fuelCodeStmt.setString(1, prefix)
                    try {
                        // Try to parse suffix as BigDecimal
                        fuelCodeStmt.setBigDecimal(2, new BigDecimal(suffix))
                    } catch (Exception e) {
                        // If parsing fails, use the string as is
                        fuelCodeStmt.setString(2, suffix)
                    }
                    
                    def fuelCodeResult = fuelCodeStmt.executeQuery()
                    fuelCodeId = fuelCodeResult.next() ? fuelCodeResult.getInt('fuel_code_id') : null
                    log.warn("fuelCodeId: " + fuelCodeId)
                } catch (Exception e) {
                    log.warn("Error processing fuel code: " + e.getMessage())
                }
            }
            // Lookup fuel_type_id - safely access properties
            def fuelTypeValue = null
            try {
                if (useSnapshot) {
                    try {
                        fuelTypeValue = record.fuel_type
                    } catch (Exception e) {
                        log.warn("Cannot access fuel_type from snapshot: " + e.getMessage())
                    }
                } else {
                    // Try to get fuel_type safely from ResultSet
                    try {
                        fuelTypeValue = record.getString("fuel_type")
                    } catch (Exception e1) {
                        try {
                            fuelTypeValue = record.fuel_type
                        } catch (Exception e2) {
                            log.warn("Cannot access fuel_type: " + e2.getMessage())
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Error determining fuel type: " + e.getMessage())
            }
            
            def fuelTypeId = null
            if (fuelTypeValue != null) {
                def fuelTypeStmt = destinationConn.prepareStatement('''
                    SELECT fuel_type_id FROM fuel_type WHERE fuel_type = ?
                ''')
                fuelTypeStmt.setString(1, fuelTypeValue)
                def fuelTypeResult = fuelTypeStmt.executeQuery()
                fuelTypeId = fuelTypeResult.next() ? fuelTypeResult.getInt('fuel_type_id') : null
                log.warn("fuelTypeId: " + fuelTypeId)
            }

            // Insert records into fuel_supply table in LCFS (destination)
            def fuelSupplyInsertStmt = destinationConn.prepareStatement('''
                INSERT INTO public.fuel_supply (
                    compliance_report_id, quantity, units, compliance_units, target_ci, ci_of_fuel,
                    energy_density, eer, energy, fuel_type_other, fuel_category_id, fuel_code_id,
                    fuel_type_id, provision_of_the_act_id, end_use_id, create_date, update_date,
                    create_user, update_user, group_uuid, version, action_type
                ) VALUES (?, ?, ?::quantityunitsenum, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::actiontypeenum)
            ''')
            log.warn("record.complianceReportId: " + (complianceReportId ?: "NULL"))

            // Safe function to get numeric values - improved for snapshot handling
            def safeGetNumber = { fieldName ->
            def result = null
            def val = null
            try {
                if (useSnapshot) {
                    // For JSON snapshot records, access the key directly.
                    val = record[fieldName]
                } else {
                    // For SQL ResultSet objects, try multiple variants.
                    try {
                        val = record.getString(fieldName)
                    } catch (Exception e1) {
                        // Try direct property access.
                        try {
                            val = record."$fieldName"
                        } catch (Exception e2) {
                            // Try alternative key formats.
                            def altFieldNames = [
                                fieldName,
                                fieldName.toUpperCase(),
                                fieldName.toLowerCase(),
                                fieldName.replaceAll(/([A-Z])/, '_$1').toLowerCase(),
                                fieldName.replaceAll(/_([a-z])/) { _, c -> c.toUpperCase() }
                            ]
                            for (alt in altFieldNames) {
                                try {
                                    val = record.getString(alt)
                                    if (val != null) {
                                        log.warn("Using alternative field name '${alt}' for ${fieldName}: ${val}")
                                        break
                                    }
                                } catch (Exception ignore) {
                                    // Continue trying other alternatives.
                                }
                            }
                        }
                    }
                }
                
                // Handle explicit "null" string values.
                if (val == "null") {
                    val = null
                }
                
                // If the field is missing or null, record the issue for quantity.
                if (val == null) {
                    if (fieldName == "quantity") {
                        def errorMsg = "ERROR: Found null quantity in source data for field '${fieldName}'"
                        log.error(errorMsg)
                        failedRecords << [
                            crId: legacyId,
                            complianceReportId: complianceReportId,
                            recordType: record.getClass().name,
                            reason: "Null quantity value",
                            recordData: useSnapshot ?
                                record.toString().take(200) + "..." :
                                "SQL ResultSet (details unavailable)"
                        ]
                    }
                    return new BigDecimal(0)
                }
                
                // Convert to BigDecimal.
                if (val instanceof String) {
                    val = val.trim().replaceAll(",", "")
                    if (val.matches("-?\\d+(\\.\\d+)?")) {
                        result = new BigDecimal(val)
                    } else {
                        log.warn("String value '${val}' for ${fieldName} is not a valid number")
                        if (fieldName == "quantity") {
                            log.error("ERROR: Invalid quantity value '${val}' in source data.")
                            failedRecords << [
                                crId: legacyId,
                                complianceReportId: complianceReportId,
                                recordType: record.getClass().name,
                                reason: "Non-numeric quantity value: '${val}'",
                                recordData: useSnapshot ?
                                    record.toString().take(200) + "..." :
                                    "SQL ResultSet (details unavailable)"
                            ]
                            return new BigDecimal(0)
                        }
                        result = null
                    }
                } else if (val instanceof Number) {
                    result = new BigDecimal(val.toString())
                } else {
                    log.warn("Unknown type for ${fieldName}: ${val.getClass().name}")
                    if (fieldName == "quantity") {
                        log.error("ERROR: Quantity has unexpected type: ${val.getClass().name}. Cannot convert to numeric value.")
                        failedRecords << [
                            crId: legacyId,
                            complianceReportId: complianceReportId,
                            recordType: record.getClass().name,
                            reason: "Quantity has unexpected type: ${val.getClass().name}",
                            recordData: useSnapshot ?
                                record.toString().take(200) + "..." :
                                "SQL ResultSet (details unavailable)"
                        ]
                        return new BigDecimal(0)
                    }
                    result = null
                }
            } catch (Exception e) {
                log.warn("Error converting ${fieldName}: " + e.getMessage())
                if (fieldName == "quantity") {
                    log.error("ERROR: Exception while processing quantity value: ${e.getMessage()}")
                    failedRecords << [
                        crId: legacyId,
                        complianceReportId: complianceReportId,
                        recordType: record.getClass().name,
                        reason: "Exception while processing quantity: ${e.getMessage()}",
                        recordData: useSnapshot ?
                            record.toString().take(200) + "..." :
                            "SQL ResultSet (details unavailable)"
                    ]
                    return new BigDecimal(0)
                }
            }
            return result
        }

            
            // Get numeric values safely
            def quantity = safeGetNumber("quantity")
            
            // Determine compliance units
            def complianceUnits = null
            if (useSnapshot) {
                def credits = safeGetNumber("credits")
                def debits = safeGetNumber("debits")
                
                if (credits != null) {
                    complianceUnits = credits.negate()
                } else if (debits != null) {
                    complianceUnits = debits
                }
            } else {
                complianceUnits = safeGetNumber("compliance_units")
            }
            
            // Get other numeric values safely
            def ciLimit = safeGetNumber("ci_limit")
            def ciOfFuel = safeGetNumber("ci_of_fuel")
            def energyDensity = safeGetNumber("energy_density")
            def eer = safeGetNumber("eer")
            def energyContent = safeGetNumber("energy_content")

            // Must use setNull for potentially null values
            fuelSupplyInsertStmt.setInt(1, complianceReportId)
            
            // Handle numeric values safely
            if (quantity != null) {
                fuelSupplyInsertStmt.setBigDecimal(2, quantity)
            } else {
                fuelSupplyInsertStmt.setNull(2, java.sql.Types.NUMERIC)
            }
            
            if (unitFullForm != null) {
                fuelSupplyInsertStmt.setString(3, unitFullForm)
            } else {
                fuelSupplyInsertStmt.setNull(3, java.sql.Types.VARCHAR)
            }
            
            if (complianceUnits != null) {
                fuelSupplyInsertStmt.setBigDecimal(4, complianceUnits)
            } else {
                fuelSupplyInsertStmt.setNull(4, java.sql.Types.NUMERIC)
            }
            
            if (ciLimit != null) {
                fuelSupplyInsertStmt.setBigDecimal(5, ciLimit)
            } else {
                fuelSupplyInsertStmt.setNull(5, java.sql.Types.NUMERIC)
            }
            
            if (ciOfFuel != null) {
                fuelSupplyInsertStmt.setBigDecimal(6, ciOfFuel)
            } else {
                fuelSupplyInsertStmt.setNull(6, java.sql.Types.NUMERIC)
            }
            
            if (energyDensity != null) {
                fuelSupplyInsertStmt.setBigDecimal(7, energyDensity)
            } else {
                fuelSupplyInsertStmt.setNull(7, java.sql.Types.NUMERIC)
            }
            
            if (eer != null) {
                fuelSupplyInsertStmt.setBigDecimal(8, eer)
            } else {
                fuelSupplyInsertStmt.setNull(8, java.sql.Types.NUMERIC)
            }
            
            if (energyContent != null) {
                fuelSupplyInsertStmt.setBigDecimal(9, energyContent)
            } else {
                fuelSupplyInsertStmt.setNull(9, java.sql.Types.NUMERIC)
            }
            
            // Always null for fuel_type_other
            fuelSupplyInsertStmt.setNull(10, java.sql.Types.VARCHAR)
            
            // Handle integer IDs safely
            if (fuelCategoryId != null) {
                fuelSupplyInsertStmt.setInt(11, fuelCategoryId)
            } else {
                fuelSupplyInsertStmt.setNull(11, java.sql.Types.INTEGER)
            }
            
            if (fuelCodeId != null) {
                fuelSupplyInsertStmt.setInt(12, fuelCodeId)
            } else {
                fuelSupplyInsertStmt.setNull(12, java.sql.Types.INTEGER)
            }
            
            if (fuelTypeId != null) {
                fuelSupplyInsertStmt.setInt(13, fuelTypeId)
            } else {
                fuelSupplyInsertStmt.setNull(13, java.sql.Types.INTEGER)
            }
            
            if (provisionId != null) {
                fuelSupplyInsertStmt.setInt(14, provisionId)
            } else {
                fuelSupplyInsertStmt.setNull(14, java.sql.Types.INTEGER)
            }
            
            // Always null fields
            fuelSupplyInsertStmt.setNull(15, java.sql.Types.INTEGER) // end_use_id
            fuelSupplyInsertStmt.setNull(16, java.sql.Types.TIMESTAMP) // create_date
            fuelSupplyInsertStmt.setNull(17, java.sql.Types.TIMESTAMP) // update_date
            
            // Non-null string values
            fuelSupplyInsertStmt.setString(18, 'ETL')
            fuelSupplyInsertStmt.setString(19, 'ETL')
            fuelSupplyInsertStmt.setString(20, groupUuid)
            fuelSupplyInsertStmt.setInt(21, version)
            fuelSupplyInsertStmt.setString(22, 'SUPPLIER')
            fuelSupplyInsertStmt.setString(23, 'CREATE')
            fuelSupplyInsertStmt.executeUpdate()
                } // end of record loop
            } catch (Exception e) {
                log.error("Error processing individual record: " + e.getMessage())
                log.error("Stack trace: " + e.getStackTrace().join("\n"))
                // Continue processing other records
            }
        } // end of scheduleBRecords.each
    } catch (Exception e) {
    log.error('Error running Fuel Supply migration: ' + e.getMessage())
    log.error('Stack trace: ' + e.getStackTrace().join("\n"))
    throw e
} finally {
    // Safely close connections
    if (sourceConn != null) {
        try {
            sourceConn.close()
            log.warn("Source connection closed")
        } catch (Exception e) {
            log.error("Error closing source connection: " + e.getMessage())
        }
    }
    
    if (destinationConn != null) {
        try {
            destinationConn.close()
            log.warn("Destination connection closed")
        } catch (Exception e) {
            log.error("Error closing destination connection: " + e.getMessage())
        }
    }
    
    // Output statistics on records that failed due to null quantity
    log.warn("**** SCHEDULE B MIGRATION ISSUES SUMMARY ****")
    log.warn("Total records with issues: ${failedRecords.size()}")
    
    if (failedRecords.size() > 0) {
        log.warn("\nList of records with issues:")
        failedRecords.eachWithIndex { record, index ->
            log.warn("${index + 1}. Compliance Report ID: ${record.crId} (LCFS ID: ${record.complianceReportId})")
            log.warn("   Reason: ${record.reason}")
            log.warn("   Record Type: ${record.recordType}")
            log.warn("   Data Preview: ${record.recordData}")
            log.warn("   -----------------------------")
        }
    }
}


log.warn('**** DONE: FUEL SUPPLY MIGRATION ****')
