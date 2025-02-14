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

log.warn('**** BEGIN SCHEDULE B MIGRATION ****')
try {
    Connection sourceConn = sourceDbcpService.getConnection()
    Connection destinationConn = destinationDbcpService.getConnection()

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

        scheduleBRecords.each { record ->
            // Map unit values
            def unitFullForm = unitMapping.get(record.unit_of_measure, record.unit_of_measure)

            // Lookup provision_of_the_act_id
            def provisionLookupValue = useSnapshot ? "${record.provision_of_the_act_description} - ${record.provision_of_the_act}" : record.provision_act
            def provisionStmt = destinationConn.prepareStatement('''
                SELECT provision_of_the_act_id FROM provision_of_the_act WHERE name = ?
            ''')
            provisionStmt.setString(1, provisionLookupValue)
            def provisionResult = provisionStmt.executeQuery()
            def provisionId = provisionResult.next() ? provisionResult.getInt('provision_of_the_act_id') : null

            // Lookup fuel_category_id
            def fuelCategoryLookupValue = useSnapshot ? record.fuel_class : record.fuel_category
            def fuelCategoryStmt = destinationConn.prepareStatement('''
                SELECT fuel_category_id FROM fuel_category WHERE category = ?::fuel_category_enum
            ''')
            fuelCategoryStmt.setString(1, fuelCategoryLookupValue)
            def fuelCategoryResult = fuelCategoryStmt.executeQuery()
            def fuelCategoryId = fuelCategoryResult.next() ? fuelCategoryResult.getInt('fuel_category_id') : null

            // Lookup fuel_code_id
            def fuelCodeStmt = destinationConn.prepareStatement('''
                select * from fuel_code fc, fuel_code_prefix fcp where fcp.fuel_code_prefix_id  = fc.prefix_id and fcp.prefix = ? and fc.fuel_suffix = ?
            ''')
            def fuelCodeId = null
            def fuelCode = record.fuel_code ?: null  // Ensure it's not null
            if (fuelCode) {
                def prefix = fuelCode.length() >= 4 ? fuelCode.take(4) : fuelCode
                def suffix = fuelCode.length() > 4 ? fuelCode.drop(4) : ""
                fuelCodeStmt.setString(1, prefix)
                fuelCodeStmt.setBigDecimal(2, suffix)
                def fuelCodeResult = fuelCodeStmt.executeQuery()
                fuelCodeId = fuelCodeResult.next() ? fuelCodeResult.getInt('fuel_code_id') : null
                log.warn("fuelCodeId", fuelCodeId)
            }
            // Lookup fuel_type_id
            def fuelTypeStmt = destinationConn.prepareStatement('''
                SELECT fuel_type_id FROM fuel_type WHERE fuel_type = ?
            ''')
            fuelTypeStmt.setString(1, record.fuel_type)
            def fuelTypeResult = fuelTypeStmt.executeQuery()
            def fuelTypeId = fuelTypeResult.next() ? fuelTypeResult.getInt('fuel_type_id') : null
            log.warn("fuelTypeId", fuelTypeId)

            // Insert records into fuel_supply table in LCFS (destination)
            def fuelSupplyInsertStmt = destinationConn.prepareStatement('''
                INSERT INTO public.fuel_supply (
                    compliance_report_id, quantity, units, compliance_units, target_ci, ci_of_fuel,
                    energy_density, eer, energy, fuel_type_other, fuel_category_id, fuel_code_id,
                    fuel_type_id, provision_of_the_act_id, end_use_id, create_date, update_date,
                    create_user, update_user, group_uuid, version, user_type, action_type
                ) VALUES (?, ?, ?::quantityunitsenum, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::usertypeenum, ?::actiontypeenum)
            ''')
            log.warn("record.complianceReportId: " + (complianceReportId ?: "NULL"))

            def quantity = record.quantity instanceof String ? record.quantity.isNumber() ? new BigDecimal(record.quantity) : 0 : record.quantity
            // Determine compliance units
            def complianceUnits = useSnapshot ?
                (record.credits ? new BigDecimal(record.credits).negate() : (record.debits ? new BigDecimal(record.debits) : BigDecimal.ZERO)) :
                (record.compliance_units instanceof String && record.compliance_units.isNumber() ? new BigDecimal(record.compliance_units) : record.compliance_units)
            def ciLimit = record.ci_limit instanceof String ? record.ci_limit.isNumber() ? new BigDecimal(record.ci_limit) : 0 : record.ci_limit
            def ciOfFuel = record.ci_of_fuel instanceof String ? record.ci_of_fuel.isNumber() ? new BigDecimal(record.ci_of_fuel) : 0 : record.ci_of_fuel
            def energyDensity = record.energy_density instanceof String ? record.energy_density.isNumber() ? new BigDecimal(record.energy_density) : 0 : record.energy_density
            def eer = record.eer instanceof String ? record.eer.isNumber() ? new BigDecimal(record.eer) : 0 : record.eer
            def energyContent = record.energy_content instanceof String ? record.energy_content.isNumber() ? new BigDecimal(record.energy_content) : 0 : record.energy_content

            fuelSupplyInsertStmt.setInt(1, complianceReportId)
            fuelSupplyInsertStmt.setBigDecimal(2, quantity)
            fuelSupplyInsertStmt.setString(3, unitFullForm)
            fuelSupplyInsertStmt.setBigDecimal(4, complianceUnits)
            fuelSupplyInsertStmt.setBigDecimal(5, ciLimit)
            fuelSupplyInsertStmt.setBigDecimal(6, ciOfFuel)
            fuelSupplyInsertStmt.setBigDecimal(7, energyDensity)
            fuelSupplyInsertStmt.setBigDecimal(8, eer)
            fuelSupplyInsertStmt.setBigDecimal(9, energyContent)
            fuelSupplyInsertStmt.setObject(10, null)
            fuelSupplyInsertStmt.setInt(11, fuelCategoryId)
            fuelSupplyInsertStmt.setObject(12, fuelCodeId)
            fuelSupplyInsertStmt.setInt(13, fuelTypeId)
            fuelSupplyInsertStmt.setInt(14, provisionId)
            fuelSupplyInsertStmt.setObject(15, null)
            fuelSupplyInsertStmt.setObject(16, null)
            fuelSupplyInsertStmt.setObject(17, null)
            fuelSupplyInsertStmt.setString(18, 'ETL')
            fuelSupplyInsertStmt.setString(19, 'ETL')
            fuelSupplyInsertStmt.setString(20, groupUuid)
            fuelSupplyInsertStmt.setInt(21, version)
            fuelSupplyInsertStmt.setString(22, 'SUPPLIER')
            fuelSupplyInsertStmt.setString(23, 'CREATE')
            fuelSupplyInsertStmt.executeUpdate()
        }
    }
} catch (Exception e) {
    log.error('Error running Schedule B migration', e)
    throw e
} finally {
    sourceConn.close()
    destinationConn.close()
}


log.warn('**** DONE: SCHEDULE B MIGRATION ****')
