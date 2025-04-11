import groovy.json.JsonSlurper
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.sql.Timestamp
import java.util.UUID

// --- Define Database Connections ---
def sourceDbcpService = context.controllerServiceLookup.getControllerService('3245b078-0192-1000-ffff-ffffba20c1eb')
def destinationDbcpService = context.controllerServiceLookup.getControllerService('3244bf63-0192-1000-ffff-ffffc8ec6d93')

log.warn('**** BEGIN FUEL SUPPLY MIGRATION (Simple Version) ****')

// Declare connections at the script level.
Connection sourceConn = null
Connection destinationConn = null

try {
    // --- Connect to Source ---
    try {
        sourceConn = sourceDbcpService.getConnection()
        log.warn('Successfully connected to source database')
    } catch (Exception e) {
        log.error('Failed to connect to source database: ' + e.getMessage())
        throw e
    }
    
    // --- Connect to Destination ---
    try {
        destinationConn = destinationDbcpService.getConnection()
        log.warn('Successfully connected to destination database')
    } catch (Exception e) {
        log.error('Failed to connect to destination database: ' + e.getMessage())
        throw e
    }
    
    // --- Validate Source Table Exists ---
    def tableCheckStmt = sourceConn.prepareStatement("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'compliance_report_schedule_b_record'
        ) AS table_exists
    """)
    ResultSet tableCheckRS = tableCheckStmt.executeQuery()
    if (tableCheckRS.next() && !tableCheckRS.getBoolean("table_exists")) {
        throw new Exception("Table 'compliance_report_schedule_b_record' does not exist in source database")
    }
    tableCheckRS.close()
    tableCheckStmt.close()
    
    // --- Define a Unit Mapping Dictionary ---
    def unitMapping = [
        'L'   : 'Litres',
        'kg'  : 'Kilograms',
        'kWh' : 'Kilowatt_hour',
        'm³'  : 'Cubic_metres'
    ]
    
    // --- Fetch Compliance Reports from Destination ---
    // These reports have a non-null legacy_id, which is used to find the corresponding schedule B records.
    def complianceReportsStmt = destinationConn.createStatement()
    ResultSet complianceReportsRS = complianceReportsStmt.executeQuery("""
        SELECT compliance_report_id, legacy_id, compliance_report_group_uuid, version
        FROM compliance_report
        WHERE legacy_id IS NOT NULL
    """)
    
    while (complianceReportsRS.next()) {
        int legacyId = complianceReportsRS.getInt("legacy_id")
        int lcfsComplianceReportId = complianceReportsRS.getInt("compliance_report_id")
        String groupUuid = complianceReportsRS.getString("compliance_report_group_uuid")
        int version = complianceReportsRS.getInt("version")
        
        // --- Fetch Schedule B Records Directly from Source ---
        // This query joins the necessary source tables to produce a set of schedule B data.
        def fuelSupplySQL = """
            WITH schedule_b AS (
                SELECT 
                    crsbr.id AS fuel_supply_id,
                    cr.id AS compliance_report_legacy_id,
                    crsbr.quantity,
                    uom.name AS unit_of_measure,
                    fc.fuel_class AS fuel_category,
                    fc1.fuel_code AS fuel_code_prefix,
                    CAST(CONCAT(fc1.fuel_code_version, '.', fc1.fuel_code_version_minor) AS CHAR) AS fuel_code_suffix,
                    aft.name AS fuel_type,
                    CONCAT(TRIM(pa.description), ' - ', TRIM(pa.provision)) AS provision_act,
                    cr.create_timestamp AS create_date,
                    cr.update_timestamp AS update_date,
                    'ETL' AS create_user,
                    'ETL' AS update_user,
                    'CREATE' AS action_type,
                    (SELECT cil.density
                       FROM carbon_intensity_limit cil
                      WHERE cil.fuel_class_id = crsbr.fuel_class_id
                        AND cil.effective_date <= cp.effective_date
                        AND cil.expiration_date > cp.effective_date
                      ORDER BY cil.effective_date DESC, cil.update_timestamp DESC
                      LIMIT 1) AS ci_limit,
                    crsbr.intensity AS intensity,
                    (SELECT ed.density
                       FROM energy_density ed
                       JOIN energy_density_category edc ON edc.id = aft.energy_density_category_id
                      WHERE ed.effective_date <= cp.effective_date
                        AND ed.expiration_date > cp.effective_date
                      ORDER BY ed.effective_date DESC, ed.update_timestamp DESC
                      LIMIT 1) AS energy_density,
                    (SELECT eer.ratio
                       FROM energy_effectiveness_ratio eer
                       JOIN energy_effectiveness_ratio_category eerc ON eerc.id = aft.energy_effectiveness_ratio_category_id
                      WHERE eer.effective_date <= cp.effective_date
                        AND eer.expiration_date > cp.effective_date
                      ORDER BY eer.effective_date DESC, eer.update_timestamp DESC
                      LIMIT 1) AS eer,
                    (SELECT (ed.density * crsbr.quantity)
                       FROM energy_density ed
                       JOIN energy_density_category edc ON edc.id = aft.energy_density_category_id
                      WHERE ed.effective_date <= cp.effective_date
                        AND ed.expiration_date > cp.effective_date
                      ORDER BY ed.effective_date DESC, ed.update_timestamp DESC
                      LIMIT 1) AS energy_content,
                    (SELECT ((((cil.density * (SELECT eer.ratio
                                               FROM energy_effectiveness_ratio eer
                                              WHERE eer.effective_date <= cp.effective_date
                                                AND eer.expiration_date > cp.effective_date
                                              ORDER BY eer.effective_date DESC, eer.update_timestamp DESC
                                              LIMIT 1)
                                      ) - crsbr.intensity) * (ed.density * crsbr.quantity)) / 1000000)
                       FROM carbon_intensity_limit cil,
                            energy_density ed
                      WHERE cil.fuel_class_id = crsbr.fuel_class_id
                        AND ed.effective_date <= cp.effective_date
                        AND ed.expiration_date > cp.effective_date
                      ORDER BY cil.effective_date DESC, ed.effective_date DESC
                      LIMIT 1) AS compliance_units
                FROM compliance_report_schedule_b_record crsbr
                INNER JOIN compliance_report cr ON cr.schedule_b_id = crsbr.schedule_id
                INNER JOIN compliance_period cp ON cp.id = cr.compliance_period_id
                INNER JOIN fuel_class fc ON fc.id = crsbr.fuel_class_id
                INNER JOIN approved_fuel_type aft ON aft.id = crsbr.fuel_type_id
                INNER JOIN provision_act pa ON pa.id = crsbr.provision_of_the_act_id
                LEFT JOIN unit_of_measure uom ON uom.id = aft.unit_of_measure_id
                LEFT JOIN fuel_code fc1 ON fc1.id = crsbr.fuel_code_id
                WHERE cr.id = ?
            )
            SELECT *
            FROM schedule_b
        """
        
        def fuelSupplyStmt = sourceConn.prepareStatement(fuelSupplySQL)
        fuelSupplyStmt.setInt(1, legacyId)
        ResultSet fuelSupplyRS = fuelSupplyStmt.executeQuery()
        
        while (fuelSupplyRS.next()) {
            // --- Explicitly extract source fields ---
            BigDecimal quantity = fuelSupplyRS.getBigDecimal("quantity")
            String sourceUOM = fuelSupplyRS.getString("unit_of_measure")
            String explicitUnitFullForm = sourceUOM != null ? unitMapping.get(sourceUOM, sourceUOM) : null
            
            String fuelCategoryStr = fuelSupplyRS.getString("fuel_category")
            String fuelCodePrefix = fuelSupplyRS.getString("fuel_code_prefix")
            String fuelCodeSuffix = fuelSupplyRS.getString("fuel_code_suffix")
            String fuelTypeStr = fuelSupplyRS.getString("fuel_type")
            String provisionActStr = fuelSupplyRS.getString("provision_act")
            Timestamp recordCreateDate = fuelSupplyRS.getTimestamp("create_date")
            Timestamp recordUpdateDate = fuelSupplyRS.getTimestamp("update_date")
            
            // --- Lookup Additional Values from Destination ---
            // Lookup fuel_category_id
            Integer fuelCategoryId = null
            if (fuelCategoryStr != null) {
                def fuelCatLookupStmt = destinationConn.prepareStatement("""
                    SELECT fuel_category_id FROM fuel_category WHERE category = ?::fuel_category_enum
                """)
                fuelCatLookupStmt.setString(1, fuelCategoryStr)
                ResultSet fuelCatRS = fuelCatLookupStmt.executeQuery()
                if (fuelCatRS.next()) {
                    fuelCategoryId = fuelCatRS.getInt("fuel_category_id")
                }
                fuelCatRS.close()
                fuelCatLookupStmt.close()
            }
            // If still null, supply default value ("OTHER")
            if (fuelCategoryId == null) {
                String defaultFuelCategory = "OTHER"
                def defaultFuelCatStmt = destinationConn.prepareStatement("""
                    SELECT fuel_category_id FROM fuel_category WHERE category = ?::fuel_category_enum
                """)
                defaultFuelCatStmt.setString(1, defaultFuelCategory)
                ResultSet defaultFuelCatRS = defaultFuelCatStmt.executeQuery()
                if (defaultFuelCatRS.next()) {
                    fuelCategoryId = defaultFuelCatRS.getInt("fuel_category_id")
                }
                defaultFuelCatRS.close()
                defaultFuelCatStmt.close()
            }
            
            // Lookup fuel_code_id
            Integer fuelCodeId = null
            if (fuelCodePrefix != null) {
                def fuelCodeLookupStmt = destinationConn.prepareStatement("""
                    SELECT fuel_code_id FROM fuel_code fc
                    JOIN fuel_code_prefix fcp ON fcp.fuel_code_prefix_id = fc.prefix_id
                    WHERE fcp.prefix = ? AND fc.fuel_suffix = ?
                """)
                String prefixValue = fuelCodePrefix
                String suffixValue = fuelCodeSuffix != null ? fuelCodeSuffix : ""
                fuelCodeLookupStmt.setString(1, prefixValue)
                fuelCodeLookupStmt.setString(2, suffixValue)
                ResultSet fuelCodeRS = fuelCodeLookupStmt.executeQuery()
                if (fuelCodeRS.next()) {
                    fuelCodeId = fuelCodeRS.getInt("fuel_code_id")
                }
                fuelCodeRS.close()
                fuelCodeLookupStmt.close()
            }
            
            // Lookup fuel_type_id
            Integer fuelTypeId = null
            if (fuelTypeStr != null) {
                def fuelTypeLookupStmt = destinationConn.prepareStatement("""
                    SELECT fuel_type_id FROM fuel_type WHERE fuel_type = ?
                """)
                fuelTypeLookupStmt.setString(1, fuelTypeStr)
                ResultSet fuelTypeRS = fuelTypeLookupStmt.executeQuery()
                if (fuelTypeRS.next()) {
                    fuelTypeId = fuelTypeRS.getInt("fuel_type_id")
                }
                fuelTypeRS.close()
                fuelTypeLookupStmt.close()
            }
            
            // Lookup provision_of_the_act_id
            Integer provisionId = null
            if (provisionActStr != null) {
                def provisionLookupStmt = destinationConn.prepareStatement("""
                    SELECT provision_of_the_act_id FROM provision_of_the_act WHERE name = ?
                """)
                provisionLookupStmt.setString(1, provisionActStr)
                ResultSet provisionRS = provisionLookupStmt.executeQuery()
                if (provisionRS.next()) {
                    provisionId = provisionRS.getInt("provision_of_the_act_id")
                }
                provisionRS.close()
                provisionLookupStmt.close()
            }
            
            // --- Retrieve other numeric fields from source ---
            BigDecimal ciLimit = fuelSupplyRS.getBigDecimal("ci_limit")
            BigDecimal intensity = fuelSupplyRS.getBigDecimal("intensity")
            BigDecimal energyDensity = fuelSupplyRS.getBigDecimal("energy_density")
            BigDecimal eer = fuelSupplyRS.getBigDecimal("eer")
            BigDecimal energyContent = fuelSupplyRS.getBigDecimal("energy_content")
            BigDecimal complianceUnits = fuelSupplyRS.getBigDecimal("compliance_units")
            
            // --- Insert into Destination fuel_supply Table ---
            def fuelSupplyInsertStmt = destinationConn.prepareStatement("""
                INSERT INTO public.fuel_supply (
                    compliance_report_id, quantity, units, compliance_units, target_ci, ci_of_fuel,
                    energy_density, eer, energy, fuel_type_other, fuel_category_id, fuel_code_id,
                    fuel_type_id, provision_of_the_act_id, end_use_id, create_date, update_date,
                    create_user, update_user, group_uuid, version, action_type
                ) VALUES (?, ?, ?::quantityunitsenum, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::actiontypeenum)
            """)
            log.warn("Processing fuel_supply insert for LCFS compliance_report_id: ${lcfsComplianceReportId}")
            
            // Bind all 22 parameters explicitly.
            // 1. compliance_report_id
            fuelSupplyInsertStmt.setInt(1, lcfsComplianceReportId)
            // 2. quantity
            fuelSupplyInsertStmt.setBigDecimal(2, quantity != null ? quantity : new BigDecimal(0))
            // 3. units
            if (explicitUnitFullForm != null) {
                fuelSupplyInsertStmt.setString(3, explicitUnitFullForm)
            } else {
                fuelSupplyInsertStmt.setNull(3, java.sql.Types.VARCHAR)
            }
            // 4. compliance_units
            fuelSupplyInsertStmt.setBigDecimal(4, complianceUnits)
            // 5. target_ci - using ci_limit as target_ci
            fuelSupplyInsertStmt.setBigDecimal(5, ciLimit)
            // 6. ci_of_fuel - using intensity for this example
            fuelSupplyInsertStmt.setBigDecimal(6, intensity)
            // 7. energy_density
            fuelSupplyInsertStmt.setBigDecimal(7, energyDensity)
            // 8. eer
            fuelSupplyInsertStmt.setBigDecimal(8, eer)
            // 9. energy
            fuelSupplyInsertStmt.setBigDecimal(9, energyContent)
            // 10. fuel_type_other (always null)
            fuelSupplyInsertStmt.setNull(10, java.sql.Types.VARCHAR)
            // 11. fuel_category_id
            if (fuelCategoryId != null) {
                fuelSupplyInsertStmt.setInt(11, fuelCategoryId)
            } else {
                fuelSupplyInsertStmt.setNull(11, java.sql.Types.INTEGER)
            }
            // 12. fuel_code_id
            if (fuelCodeId != null) {
                fuelSupplyInsertStmt.setInt(12, fuelCodeId)
            } else {
                fuelSupplyInsertStmt.setNull(12, java.sql.Types.INTEGER)
            }
            // 13. fuel_type_id
            if (fuelTypeId != null) {
                fuelSupplyInsertStmt.setInt(13, fuelTypeId)
            } else {
                fuelSupplyInsertStmt.setNull(13, java.sql.Types.INTEGER)
            }
            // 14. provision_of_the_act_id
            if (provisionId != null) {
                fuelSupplyInsertStmt.setInt(14, provisionId)
            } else {
                fuelSupplyInsertStmt.setNull(14, java.sql.Types.INTEGER)
            }
            // 15. end_use_id (set to null)
            fuelSupplyInsertStmt.setNull(15, java.sql.Types.INTEGER)
            // 16. create_date (from source)
            fuelSupplyInsertStmt.setTimestamp(16, recordCreateDate != null ? recordCreateDate : new Timestamp(System.currentTimeMillis()))
            // 17. update_date (from source)
            fuelSupplyInsertStmt.setTimestamp(17, recordUpdateDate != null ? recordUpdateDate : new Timestamp(System.currentTimeMillis()))
            // 18. create_user
            fuelSupplyInsertStmt.setString(18, 'ETL')
            // 19. update_user
            fuelSupplyInsertStmt.setString(19, 'ETL')
            // 20. group_uuid
            fuelSupplyInsertStmt.setString(20, groupUuid)
            // 21. version
            fuelSupplyInsertStmt.setInt(21, version)
            // 22. action_type
            fuelSupplyInsertStmt.setString(22, 'CREATE')
            
            fuelSupplyInsertStmt.executeUpdate()
            fuelSupplyInsertStmt.close()
        }
        fuelSupplyRS.close()
        fuelSupplyStmt.close()
    }
    complianceReportsRS.close()
    complianceReportsStmt.close()
} catch (Exception ex) {
    log.error("Error running Fuel Supply migration: " + ex.getMessage())
    log.error("Stack trace: " + ex.getStackTrace().join("\n"))
    throw ex
} finally {
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
    
    log.warn("**** DONE: FUEL SUPPLY MIGRATION ****")
}
