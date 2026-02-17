import groovy.json.JsonSlurper
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.sql.Timestamp
import java.util.Calendar

// =========================================
// NiFi Controller Services
// =========================================
def sourceDbcpService = context.controllerServiceLookup.getControllerService('3245b078-0192-1000-ffff-ffffba20c1eb')
def destinationDbcpService = context.controllerServiceLookup.getControllerService('3244bf63-0192-1000-ffff-ffffc8ec6d93')

Connection sourceConn = null
Connection destinationConn = null

try {
    sourceConn = sourceDbcpService.getConnection()
    destinationConn = destinationDbcpService.getConnection()
    destinationConn.setAutoCommit(false)

    // =========================================
    // Fetch Mapping of legacy_id to LCFS compliance_report_id from Destination
    // =========================================
    log.info("Fetching legacy_id to LCFS compliance_report_id mapping from destination database.")
    def legacyToLcfsIdMap = [:] // Map<legacy_id, lcfs_id>
    def fetchMappingStmt = destinationConn.prepareStatement("SELECT compliance_report_id, legacy_id FROM public.compliance_report WHERE legacy_id IS NOT NULL")
    ResultSet mappingRs = fetchMappingStmt.executeQuery()
    while (mappingRs.next()) {
        def lcfsId = mappingRs.getInt("compliance_report_id")
        def legacyId = mappingRs.getInt("legacy_id")
        legacyToLcfsIdMap[legacyId] = lcfsId
    }
    mappingRs.close()
    fetchMappingStmt.close()
    log.info("Fetched ${legacyToLcfsIdMap.size()} legacy_id to LCFS compliance_report_id mappings from destination.")

    // =========================================
    // Preload Existing Summary Records from Destination
    // =========================================
    log.info("Fetching existing compliance_report_summary records from destination database.")
    def existingComplianceReportIdSet = new HashSet()  // LCFS compliance_report_id for which a summary exists
    def existingSummaryIdSet = new HashSet()            // All summary_id values in the destination
    def fetchSummaryStmt = destinationConn.prepareStatement("SELECT summary_id, compliance_report_id FROM public.compliance_report_summary")
    ResultSet summaryRs = fetchSummaryStmt.executeQuery()
    while (summaryRs.next()) {
        existingSummaryIdSet.add(summaryRs.getInt("summary_id"))
        existingComplianceReportIdSet.add(summaryRs.getInt("compliance_report_id"))
    }
    summaryRs.close()
    fetchSummaryStmt.close()
    log.info("Fetched ${existingComplianceReportIdSet.size()} compliance_report_summary records (by compliance_report_id) and ${existingSummaryIdSet.size()} summary_id values from destination.")

    // =========================================
    // Fetch Data from Source Table
    // =========================================

    def SOURCE_QUERY = """
        SELECT
            cr.summary_id,
            cr.id AS compliance_report_id,
            crs.gasoline_class_retained,
            crs.gasoline_class_deferred,
            crs.diesel_class_retained,
            crs.diesel_class_deferred,
            crs.credits_offset,
            crs.diesel_class_obligation,
            crs.diesel_class_previously_retained,
            crs.gasoline_class_obligation,
            crs.gasoline_class_previously_retained
        FROM
            public.compliance_report cr
        JOIN
            public.compliance_report_summary crs
            ON cr.summary_id = crs.id 
        WHERE 
            cr.summary_id IS NOT NULL
        ORDER BY
            cr.id;
    """

    PreparedStatement sourceStmt = sourceConn.prepareStatement(SOURCE_QUERY)
    ResultSet rs = sourceStmt.executeQuery()

    // =========================================
    // Prepare Destination Insert Statement
    // =========================================
    // Note: Ensure that the column list and the corresponding parameters exactly match
    // your destination table schema. Adjust as necessary so that there are, for example,
    // 55 columns if that is what your table contains.
    def INSERT_DESTINATION_SUMMARY_SQL = """
        INSERT INTO public.compliance_report_summary (
            compliance_report_id,
            quarter,
            is_locked,
            line_1_fossil_derived_base_fuel_gasoline,
            line_1_fossil_derived_base_fuel_diesel,
            line_1_fossil_derived_base_fuel_jet_fuel,
            line_2_eligible_renewable_fuel_supplied_gasoline,
            line_2_eligible_renewable_fuel_supplied_diesel,
            line_2_eligible_renewable_fuel_supplied_jet_fuel,
            line_3_total_tracked_fuel_supplied_gasoline,
            line_3_total_tracked_fuel_supplied_diesel,
            line_3_total_tracked_fuel_supplied_jet_fuel,
            line_4_eligible_renewable_fuel_required_gasoline,
            line_4_eligible_renewable_fuel_required_diesel,
            line_4_eligible_renewable_fuel_required_jet_fuel,
            line_5_net_notionally_transferred_gasoline,
            line_5_net_notionally_transferred_diesel,
            line_5_net_notionally_transferred_jet_fuel,
            line_6_renewable_fuel_retained_gasoline,
            line_6_renewable_fuel_retained_diesel,
            line_6_renewable_fuel_retained_jet_fuel,
            line_7_previously_retained_gasoline,
            line_7_previously_retained_diesel,
            line_7_previously_retained_jet_fuel,
            line_8_obligation_deferred_gasoline,
            line_8_obligation_deferred_diesel,
            line_8_obligation_deferred_jet_fuel,
            line_9_obligation_added_gasoline,
            line_9_obligation_added_diesel,
            line_9_obligation_added_jet_fuel,
            line_10_net_renewable_fuel_supplied_gasoline,
            line_10_net_renewable_fuel_supplied_diesel,
            line_10_net_renewable_fuel_supplied_jet_fuel,
            line_11_non_compliance_penalty_gasoline,
            line_11_non_compliance_penalty_diesel,
            line_11_non_compliance_penalty_jet_fuel,
            line_12_low_carbon_fuel_required,
            line_13_low_carbon_fuel_supplied,
            line_14_low_carbon_fuel_surplus,
            line_15_banked_units_used,
            line_16_banked_units_remaining,
            line_17_non_banked_units_used,
            line_18_units_to_be_banked,
            line_19_units_to_be_exported,
            line_20_surplus_deficit_units,
            line_21_surplus_deficit_ratio,
            line_22_compliance_units_issued,
            line_11_fossil_derived_base_fuel_gasoline,
            line_11_fossil_derived_base_fuel_diesel,
            line_11_fossil_derived_base_fuel_jet_fuel,
            line_11_fossil_derived_base_fuel_total,
            line_21_non_compliance_penalty_payable,
            total_non_compliance_penalty_payable,
            create_date,
            update_date,
            create_user,
            update_user
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
    """

    PreparedStatement destinationStmt = destinationConn.prepareStatement(INSERT_DESTINATION_SUMMARY_SQL)

    // =========================================
    // Initialize Counters for Logging
    // =========================================

    int totalInserted = 0
    int totalSkipped = 0

    // =========================================
    // Processing Loop
    // =========================================

    log.info("Starting to process source records and insert into destination.")
    while (rs.next()) {
        // Fetch source fields
        def summaryId = rs.getInt("summary_id")
        def sourceComplianceReportLegacyId = rs.getInt("compliance_report_id")
        def gasolineClassRetained = rs.getBigDecimal('gasoline_class_retained')
        def gasolineClassDeferred = rs.getBigDecimal('gasoline_class_deferred')
        def dieselClassRetained = rs.getBigDecimal('diesel_class_retained')
        def dieselClassDeferred = rs.getBigDecimal('diesel_class_deferred')
        def creditsOffset = rs.getInt('credits_offset')
        def dieselClassObligation = rs.getBigDecimal('diesel_class_obligation')
        def dieselClassPreviouslyRetained = rs.getBigDecimal('diesel_class_previously_retained')
        def gasolineClassObligation = rs.getBigDecimal('gasoline_class_obligation')
        def gasolineClassPreviouslyRetained = rs.getBigDecimal('gasoline_class_previously_retained')

        // Map source compliance_report_id (legacy_id) to LCFS compliance_report_id
        def lcfsComplianceReportId = legacyToLcfsIdMap[sourceComplianceReportLegacyId]
        if (lcfsComplianceReportId == null) {
            log.warn("No LCFS compliance_report found with legacy_id ${sourceComplianceReportLegacyId}.")
            totalSkipped++
            continue // Skip this record
        }

        // Check if a summary record already exists
        if (existingComplianceReportIdSet.contains(lcfsComplianceReportId)) {
            log.warn("A compliance_report_summary record already exists for LCFS compliance_report_id ${lcfsComplianceReportId}.")
            totalSkipped++
            continue
        }
        // Additionally, check if this source summary_id already exists in the destination.
        // if (existingSummaryIdSet.contains(summaryId)) {
        //     log.warn("A compliance_report_summary record with summary_id ${summaryId} already exists. Skipping.")
        //     totalSkipped++
        //     continue
        // }

        // Build the record data map for insertion.
        def summaryRecord = [
            compliance_report_id                : lcfsComplianceReportId, // Use LCFS ID
            quarter                             : null,
            is_locked                           : true,
            line_1_fossil_derived_base_fuel_gasoline      : null,
            line_1_fossil_derived_base_fuel_diesel        : null,
            line_1_fossil_derived_base_fuel_jet_fuel      : null,
            line_2_eligible_renewable_fuel_supplied_gasoline : null,
            line_2_eligible_renewable_fuel_supplied_diesel   : null,
            line_2_eligible_renewable_fuel_supplied_jet_fuel : null,
            line_3_total_tracked_fuel_supplied_gasoline      : null,
            line_3_total_tracked_fuel_supplied_diesel        : null,
            line_3_total_tracked_fuel_supplied_jet_fuel      : null,
            line_4_eligible_renewable_fuel_required_gasoline : null,
            line_4_eligible_renewable_fuel_required_diesel   : null,
            line_4_eligible_renewable_fuel_required_jet_fuel : null,
            line_5_net_notionally_transferred_gasoline      : null,
            line_5_net_notionally_transferred_diesel        : null,
            line_5_net_notionally_transferred_jet_fuel      : null,
            line_6_renewable_fuel_retained_gasoline         : gasolineClassRetained,
            line_6_renewable_fuel_retained_diesel           : dieselClassRetained,
            line_6_renewable_fuel_retained_jet_fuel         : null,
            line_7_previously_retained_gasoline             : gasolineClassPreviouslyRetained,
            line_7_previously_retained_diesel               : dieselClassPreviouslyRetained,
            line_7_previously_retained_jet_fuel             : null,
            line_8_obligation_deferred_gasoline             : gasolineClassDeferred,
            line_8_obligation_deferred_diesel               : dieselClassDeferred,
            line_8_obligation_deferred_jet_fuel             : null,
            line_9_obligation_added_gasoline                : gasolineClassObligation,
            line_9_obligation_added_diesel                  : dieselClassObligation,
            line_9_obligation_added_jet_fuel                : null,
            line_10_net_renewable_fuel_supplied_gasoline    : null,
            line_10_net_renewable_fuel_supplied_diesel      : null,
            line_10_net_renewable_fuel_supplied_jet_fuel    : null,
            line_11_non_compliance_penalty_gasoline         : null,
            line_11_non_compliance_penalty_diesel           : null,
            line_11_non_compliance_penalty_jet_fuel         : null,
            line_12_low_carbon_fuel_required                : null,
            line_13_low_carbon_fuel_supplied                : null,
            line_14_low_carbon_fuel_surplus                 : null,
            line_15_banked_units_used                       : null,
            line_16_banked_units_remaining                  : null,
            line_17_non_banked_units_used                   : null,
            line_18_units_to_be_banked                      : null,
            line_19_units_to_be_exported                    : null,
            line_20_surplus_deficit_units                   : null,
            line_21_surplus_deficit_ratio                   : null,
            line_22_compliance_units_issued                 : creditsOffset,
            line_11_fossil_derived_base_fuel_gasoline      : null, // No direct mapping
            line_11_fossil_derived_base_fuel_diesel        : null, // No direct mapping
            line_11_fossil_derived_base_fuel_jet_fuel      : null, // No direct mapping
            line_11_fossil_derived_base_fuel_total         : null, // No direct mapping
            line_21_non_compliance_penalty_payable         : null, // No direct mapping
            total_non_compliance_penalty_payable           : null, // No direct mapping
            create_date                                     : new Timestamp(System.currentTimeMillis()),
            update_date                                     : new Timestamp(System.currentTimeMillis()),
            create_user                                     : "etl_user",
            update_user                                     : "etl_user"
        ]

        // =========================================
        // Insertion into Destination Table
        // =========================================

        try {
            // Bind parameters in the same order as specified in the INSERT statement.
            destinationStmt.setInt(1, summaryRecord.compliance_report_id)
            if (summaryRecord.quarter != null) {
                destinationStmt.setInt(2, summaryRecord.quarter)
            } else {
                destinationStmt.setNull(2, java.sql.Types.INTEGER)
            }
            destinationStmt.setBoolean(3, summaryRecord.is_locked)
            // For columns with no mapping, default to 0.0 (or null if that fits your business logic)
            destinationStmt.setDouble(4, (summaryRecord.line_1_fossil_derived_base_fuel_gasoline != null) ? summaryRecord.line_1_fossil_derived_base_fuel_gasoline.doubleValue() : 0.0)
            destinationStmt.setDouble(5, (summaryRecord.line_1_fossil_derived_base_fuel_diesel != null) ? summaryRecord.line_1_fossil_derived_base_fuel_diesel.doubleValue() : 0.0)
            destinationStmt.setDouble(6, 0.0)
            destinationStmt.setDouble(7, 0.0)
            destinationStmt.setDouble(8, 0.0)
            destinationStmt.setDouble(9, 0.0)
            destinationStmt.setDouble(10, 0.0)
            destinationStmt.setDouble(11, 0.0)
            destinationStmt.setDouble(12, 0.0)
            destinationStmt.setDouble(13, 0.0)
            destinationStmt.setDouble(14, 0.0)
            destinationStmt.setDouble(15, 0.0)
            destinationStmt.setDouble(16, 0.0)
            destinationStmt.setDouble(17, 0.0)
            destinationStmt.setDouble(18, 0.0)
            destinationStmt.setDouble(19, (summaryRecord.line_6_renewable_fuel_retained_gasoline != null) ? summaryRecord.line_6_renewable_fuel_retained_gasoline.doubleValue() : 0.0)
            destinationStmt.setDouble(20, (summaryRecord.line_6_renewable_fuel_retained_diesel != null) ? summaryRecord.line_6_renewable_fuel_retained_diesel.doubleValue() : 0.0)
            destinationStmt.setDouble(21, 0.0)
            destinationStmt.setDouble(22, (summaryRecord.line_7_previously_retained_gasoline != null) ? summaryRecord.line_7_previously_retained_gasoline.doubleValue() : 0.0)
            destinationStmt.setDouble(23, (summaryRecord.line_7_previously_retained_diesel != null) ? summaryRecord.line_7_previously_retained_diesel.doubleValue() : 0.0)
            destinationStmt.setDouble(24, 0.0)
            destinationStmt.setDouble(25, (summaryRecord.line_8_obligation_deferred_gasoline != null) ? summaryRecord.line_8_obligation_deferred_gasoline.doubleValue() : 0.0)
            destinationStmt.setDouble(26, (summaryRecord.line_8_obligation_deferred_diesel != null) ? summaryRecord.line_8_obligation_deferred_diesel.doubleValue() : 0.0)
            destinationStmt.setDouble(27, 0.0)
            destinationStmt.setDouble(28, (summaryRecord.line_9_obligation_added_gasoline != null) ? summaryRecord.line_9_obligation_added_gasoline.doubleValue() : 0.0)
            destinationStmt.setDouble(29, (summaryRecord.line_9_obligation_added_diesel != null) ? summaryRecord.line_9_obligation_added_diesel.doubleValue() : 0.0)
            destinationStmt.setDouble(30, 0.0)
            destinationStmt.setDouble(31, 0.0)
            destinationStmt.setDouble(32, 0.0)
            destinationStmt.setDouble(33, 0.0)
            destinationStmt.setNull(34, java.sql.Types.FLOAT)
            destinationStmt.setNull(35, java.sql.Types.FLOAT)
            destinationStmt.setNull(36, java.sql.Types.FLOAT)
            destinationStmt.setDouble(37, 0.0)
            destinationStmt.setDouble(38, 0.0)
            destinationStmt.setDouble(39, 0.0)
            destinationStmt.setDouble(40, 0.0)
            destinationStmt.setDouble(41, 0.0)
            destinationStmt.setDouble(42, 0.0)
            destinationStmt.setDouble(43, 0.0)
            destinationStmt.setDouble(44, 0.0)
            destinationStmt.setDouble(45, 0.0)
            destinationStmt.setDouble(46, 0.0)
            destinationStmt.setDouble(47, summaryRecord.line_22_compliance_units_issued)
            
            // 49. line_11_fossil_derived_base_fuel_gasoline (float8) NOT NULL
            destinationStmt.setDouble(48, 0.0) // No mapping

            // 50. line_11_fossil_derived_base_fuel_diesel (float8) NOT NULL
            destinationStmt.setDouble(49, 0.0) // No mapping

            // 51. line_11_fossil_derived_base_fuel_jet_fuel (float8) NOT NULL
            destinationStmt.setDouble(50, 0.0) // No mapping

            // 52. line_11_fossil_derived_base_fuel_total (float8) NOT NULL
            destinationStmt.setDouble(51, 0.0) // No mapping

            // 53. line_21_non_compliance_penalty_payable (float8) NOT NULL
            destinationStmt.setDouble(52, 0.0) // No mapping

            // 54. total_non_compliance_penalty_payable (float8) NOT NULL
            destinationStmt.setDouble(53, 0.0) // No mapping

            // 54. create_date (timestamptz)
            destinationStmt.setTimestamp(54, summaryRecord.create_date)

            // 55. update_date (timestamptz)
            destinationStmt.setTimestamp(55, summaryRecord.update_date)

            // 56. create_user (varchar)
            destinationStmt.setString(56, summaryRecord.create_user)

            // 57. update_user (varchar)
            destinationStmt.setString(57, summaryRecord.update_user)

            // Add to batch
            destinationStmt.addBatch()
            totalInserted++
            // Also add the LCFS compliance_report_id and summary_id to our existing sets.
            existingComplianceReportIdSet.add(lcfsComplianceReportId)
            existingSummaryIdSet.add(summaryId)
        } catch (Exception e) {
            log.error("Failed to insert summary_record for LCFS compliance_report_id: ${summaryRecord.compliance_report_id}", e)
            totalSkipped++
            continue
        }
    }

    // =========================================
    // Execute Batch and Commit
    // =========================================

    try {
        destinationStmt.executeBatch()
        destinationConn.commit()
        log.info("Successfully inserted ${totalInserted} records into destination compliance_report_summary.")
        if (totalSkipped > 0) {
            log.warn("Skipped ${totalSkipped} records due to missing LCFS compliance_report_id, existing summary records, or insertion errors.")
        }
    } catch (Exception e) {
        log.error("Batch insertion failed. Rolling back.", e)
        destinationConn.rollback()
    } finally {
        // =========================================
        // Cleanup Resources
        // =========================================
        if (rs != null && !rs.isClosed()) rs.close()
        if (sourceStmt != null && !sourceStmt.isClosed()) sourceStmt.close()
        if (destinationStmt != null && !destinationStmt.isClosed()) destinationStmt.close()
        if (sourceConn != null && !sourceConn.isClosed()) sourceConn.close()
        if (destinationConn != null && !destinationConn.isClosed()) destinationConn.close()
    }

} catch (Exception e) {
    log.error("An error occurred during the ETL process.", e)
    if (sourceConn != null && !sourceConn.isClosed()) sourceConn.close()
    if (destinationConn != null && !destinationConn.isClosed()) destinationConn.close()
    throw e
}
