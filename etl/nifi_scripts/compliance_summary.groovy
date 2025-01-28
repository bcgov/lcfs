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
    // Fetch Existing compliance_report_id from Destination
    // =========================================
    log.info("Fetching existing compliance_report_id from destination database.")
    def existingComplianceReportIds = new HashSet<Integer>()
    def fetchExistingIdsStmt = destinationConn.prepareStatement("SELECT compliance_report_id FROM public.compliance_report")
    ResultSet existingRs = fetchExistingIdsStmt.executeQuery()
    while (existingRs.next()) {
        existingComplianceReportIds.add(existingRs.getInt("compliance_report_id"))
    }
    existingRs.close()
    fetchExistingIdsStmt.close()
    log.info("Fetched ${existingComplianceReportIds.size()} existing compliance_report_id(s) from destination.")

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
            crs.gasoline_class_previously_retained,
            crs.credits_offset_a,
            crs.credits_offset_b,
            crs.credits_offset_c
        FROM
            public.compliance_report cr
        JOIN
            public.compliance_report_summary crs
            ON cr.summary_id = crs.id WHERE cr.summary_id IS NOT NULL
        ORDER BY
            cr.id;
    """

    PreparedStatement sourceStmt = sourceConn.prepareStatement(SOURCE_QUERY)
    ResultSet rs = sourceStmt.executeQuery()

    // =========================================
    // Prepare Destination Insert Statement
    // =========================================

    def INSERT_DESTINATION_SUMMARY_SQL = """
        INSERT INTO public.compliance_report_summary (
            summary_id,
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
            credits_offset_a,
            credits_offset_b,
            credits_offset_c,
            create_date,
            update_date,
            create_user,
            update_user
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
        def complianceReportId = rs.getInt("compliance_report_id")
        def gasolineClassRetained = rs.getBigDecimal('gasoline_class_retained')
        def gasolineClassDeferred = rs.getBigDecimal('gasoline_class_deferred')
        def dieselClassRetained = rs.getBigDecimal('diesel_class_retained')
        def dieselClassDeferred = rs.getBigDecimal('diesel_class_deferred')
        def creditsOffset = rs.getInt('credits_offset')
        def dieselClassObligation = rs.getBigDecimal('diesel_class_obligation')
        def dieselClassPreviouslyRetained = rs.getBigDecimal('diesel_class_previously_retained')
        def gasolineClassObligation = rs.getBigDecimal('gasoline_class_obligation')
        def gasolineClassPreviouslyRetained = rs.getBigDecimal('gasoline_class_previously_retained')
        def creditsOffsetA = rs.getInt('credits_offset_a')
        def creditsOffsetB = rs.getInt('credits_offset_b')
        def creditsOffsetC = rs.getInt('credits_offset_c')

        // Check if compliance_report_id exists in destination
        if (!existingComplianceReportIds.contains(complianceReportId)) {
            log.warn("Compliance Report ID ${complianceReportId} does not exist in destination. Skipping insertion of summary_id ${summaryId}.")
            totalSkipped++
            continue // Skip to the next record
        }

        // Create a summaryRecord map for the destination table
        def summaryRecord = [
            summary_id                          : summaryId,
            compliance_report_id                : complianceReportId,
            quarter                             : null,
            is_locked                           : true,
            line_1_fossil_derived_base_fuel_gasoline      : null, // No direct mapping
            line_1_fossil_derived_base_fuel_diesel        : null, // No direct mapping
            line_1_fossil_derived_base_fuel_jet_fuel      : null, // No direct mapping
            line_2_eligible_renewable_fuel_supplied_gasoline : null, // No direct mapping
            line_2_eligible_renewable_fuel_supplied_diesel   : null, // No direct mapping
            line_2_eligible_renewable_fuel_supplied_jet_fuel : null, // No direct mapping
            line_3_total_tracked_fuel_supplied_gasoline      : null, // No direct mapping
            line_3_total_tracked_fuel_supplied_diesel        : null, // No direct mapping
            line_3_total_tracked_fuel_supplied_jet_fuel      : null, // No direct mapping
            line_4_eligible_renewable_fuel_required_gasoline : null, // No direct mapping
            line_4_eligible_renewable_fuel_required_diesel   : null, // No direct mapping
            line_4_eligible_renewable_fuel_required_jet_fuel : null, // No direct mapping
            line_5_net_notionally_transferred_gasoline      : null, // No direct mapping
            line_5_net_notionally_transferred_diesel        : null, // No direct mapping
            line_5_net_notionally_transferred_jet_fuel      : null, // No direct mapping
            line_6_renewable_fuel_retained_gasoline         : gasolineClassRetained,
            line_6_renewable_fuel_retained_diesel           : dieselClassRetained,
            line_6_renewable_fuel_retained_jet_fuel         : null, // No direct mapping
            line_7_previously_retained_gasoline             : gasolineClassPreviouslyRetained,
            line_7_previously_retained_diesel               : dieselClassPreviouslyRetained,
            line_7_previously_retained_jet_fuel             : null, // No direct mapping
            line_8_obligation_deferred_gasoline            : gasolineClassDeferred,
            line_8_obligation_deferred_diesel              : dieselClassDeferred,
            line_8_obligation_deferred_jet_fuel            : null, // No direct mapping
            line_9_obligation_added_gasoline               : gasolineClassObligation,
            line_9_obligation_added_diesel                 : dieselClassObligation,
            line_9_obligation_added_jet_fuel               : null, // No direct mapping
            line_10_net_renewable_fuel_supplied_gasoline   : null, // No direct mapping
            line_10_net_renewable_fuel_supplied_diesel     : null, // No direct mapping
            line_10_net_renewable_fuel_supplied_jet_fuel   : null, // No direct mapping
            line_11_non_compliance_penalty_gasoline        : null, // No direct mapping
            line_11_non_compliance_penalty_diesel          : null, // No direct mapping
            line_11_non_compliance_penalty_jet_fuel        : null, // No direct mapping
            line_12_low_carbon_fuel_required               : null, // No direct mapping
            line_13_low_carbon_fuel_supplied               : null, // No direct mapping
            line_14_low_carbon_fuel_surplus                : null, // No direct mapping
            line_15_banked_units_used                      : null, // No direct mapping
            line_16_banked_units_remaining                 : null, // No direct mapping
            line_17_non_banked_units_used                  : null, // No direct mapping
            line_18_units_to_be_banked                     : null, // No direct mapping
            line_19_units_to_be_exported                   : null, // No direct mapping
            line_20_surplus_deficit_units                  : null, // No direct mapping
            line_21_surplus_deficit_ratio                  : null, // No direct mapping
            line_22_compliance_units_issued                : creditsOffset,
            line_11_fossil_derived_base_fuel_gasoline      : null, // No direct mapping
            line_11_fossil_derived_base_fuel_diesel        : null, // No direct mapping
            line_11_fossil_derived_base_fuel_jet_fuel      : null, // No direct mapping
            line_11_fossil_derived_base_fuel_total         : null, // No direct mapping
            line_21_non_compliance_penalty_payable         : null, // No direct mapping
            total_non_compliance_penalty_payable           : null, // No direct mapping
            credits_offset_a                                : creditsOffsetA, // Direct mapping
            credits_offset_b                                : creditsOffsetB, // Direct mapping
            credits_offset_c                                : creditsOffsetC, // Direct mapping
            create_date                                 : new Timestamp(System.currentTimeMillis()),
            update_date                                 : new Timestamp(System.currentTimeMillis()),
            create_user                                 : "etl_user", // Replace with actual user or mapping
            update_user                                 : "etl_user"  // Replace with actual user or mapping
        ]

        // =========================================
        // Insertion into Destination Table
        // =========================================

        try {
            // 1. summary_id (int4)
            destinationStmt.setInt(1, summaryRecord.summary_id)

            // 2. compliance_report_id (int4)
            destinationStmt.setInt(2, summaryRecord.compliance_report_id)

            // 3. quarter (int4)
            if (summaryRecord.quarter != null) {
                destinationStmt.setInt(3, summaryRecord.quarter)
            } else {
                destinationStmt.setNull(3, java.sql.Types.INTEGER)
            }

            // 4. is_locked (bool)
            destinationStmt.setBoolean(4, summaryRecord.is_locked)

            // 5. line_1_fossil_derived_base_fuel_gasoline (float8) NOT NULL
            if (summaryRecord.line_1_fossil_derived_base_fuel_gasoline != null) {
                destinationStmt.setDouble(5, summaryRecord.line_1_fossil_derived_base_fuel_gasoline.doubleValue())
            } else {
                destinationStmt.setDouble(5, 0.0) // Default value or handle as per business logic
            }

            // 6. line_1_fossil_derived_base_fuel_diesel (float8) NOT NULL
            if (summaryRecord.line_1_fossil_derived_base_fuel_diesel != null) {
                destinationStmt.setDouble(6, summaryRecord.line_1_fossil_derived_base_fuel_diesel.doubleValue())
            } else {
                destinationStmt.setDouble(6, 0.0)
            }

            // 7. line_1_fossil_derived_base_fuel_jet_fuel (float8) NOT NULL
            destinationStmt.setDouble(7, 0.0) // No mapping

            // 8. line_2_eligible_renewable_fuel_supplied_gasoline (float8) NOT NULL
            destinationStmt.setDouble(8, 0.0) // No mapping

            // 9. line_2_eligible_renewable_fuel_supplied_diesel (float8) NOT NULL
            destinationStmt.setDouble(9, 0.0) // No mapping

            // 10. line_2_eligible_renewable_fuel_supplied_jet_fuel (float8) NOT NULL
            destinationStmt.setDouble(10, 0.0) // No mapping

            // 11. line_3_total_tracked_fuel_supplied_gasoline (float8) NOT NULL
            destinationStmt.setDouble(11, 0.0) // No mapping

            // 12. line_3_total_tracked_fuel_supplied_diesel (float8) NOT NULL
            destinationStmt.setDouble(12, 0.0) // No mapping

            // 13. line_3_total_tracked_fuel_supplied_jet_fuel (float8) NOT NULL
            destinationStmt.setDouble(13, 0.0) // No mapping

            // 14. line_4_eligible_renewable_fuel_required_gasoline (float8) NOT NULL
            destinationStmt.setDouble(14, 0.0) // No mapping

            // 15. line_4_eligible_renewable_fuel_required_diesel (float8) NOT NULL
            destinationStmt.setDouble(15, 0.0) // No mapping

            // 16. line_4_eligible_renewable_fuel_required_jet_fuel (float8) NOT NULL
            destinationStmt.setDouble(16, 0.0) // No mapping

            // 17. line_5_net_notionally_transferred_gasoline (float8) NOT NULL
            destinationStmt.setDouble(17, 0.0) // No mapping

            // 18. line_5_net_notionally_transferred_diesel (float8) NOT NULL
            destinationStmt.setDouble(18, 0.0) // No mapping

            // 19. line_5_net_notionally_transferred_jet_fuel (float8) NOT NULL
            destinationStmt.setDouble(19, 0.0) // No mapping

            // 20. line_6_renewable_fuel_retained_gasoline (float8) NOT NULL
            if (summaryRecord.line_6_renewable_fuel_retained_gasoline != null) {
                destinationStmt.setDouble(20, summaryRecord.line_6_renewable_fuel_retained_gasoline.doubleValue())
            } else {
                destinationStmt.setDouble(20, 0.0)
            }

            // 21. line_6_renewable_fuel_retained_diesel (float8) NOT NULL
            if (summaryRecord.line_6_renewable_fuel_retained_diesel != null) {
                destinationStmt.setDouble(21, summaryRecord.line_6_renewable_fuel_retained_diesel.doubleValue())
            } else {
                destinationStmt.setDouble(21, 0.0)
            }

            // 22. line_6_renewable_fuel_retained_jet_fuel (float8) NOT NULL
            destinationStmt.setDouble(22, 0.0) // No mapping

            // 23. line_7_previously_retained_gasoline (float8) NOT NULL
            if (summaryRecord.line_7_previously_retained_gasoline != null) {
                destinationStmt.setDouble(23, summaryRecord.line_7_previously_retained_gasoline.doubleValue())
            } else {
                destinationStmt.setDouble(23, 0.0)
            }

            // 24. line_7_previously_retained_diesel (float8) NOT NULL
            if (summaryRecord.line_7_previously_retained_diesel != null) {
                destinationStmt.setDouble(24, summaryRecord.line_7_previously_retained_diesel.doubleValue())
            } else {
                destinationStmt.setDouble(24, 0.0)
            }

            // 25. line_7_previously_retained_jet_fuel (float8) NOT NULL
            destinationStmt.setDouble(25, 0.0) // No mapping

            // 26. line_8_obligation_deferred_gasoline (float8) NOT NULL
            if (summaryRecord.line_8_obligation_deferred_gasoline != null) {
                destinationStmt.setDouble(26, summaryRecord.line_8_obligation_deferred_gasoline.doubleValue())
            } else {
                destinationStmt.setDouble(26, 0.0)
            }

            // 27. line_8_obligation_deferred_diesel (float8) NOT NULL
            if (summaryRecord.line_8_obligation_deferred_diesel != null) {
                destinationStmt.setDouble(27, summaryRecord.line_8_obligation_deferred_diesel.doubleValue())
            } else {
                destinationStmt.setDouble(27, 0.0)
            }

            // 28. line_8_obligation_deferred_jet_fuel (float8) NOT NULL
            destinationStmt.setDouble(28, 0.0) // No mapping

            // 29. line_9_obligation_added_gasoline (float8) NOT NULL
            if (summaryRecord.line_9_obligation_added_gasoline != null) {
                destinationStmt.setDouble(29, summaryRecord.line_9_obligation_added_gasoline.doubleValue())
            } else {
                destinationStmt.setDouble(29, 0.0)
            }

            // 30. line_9_obligation_added_diesel (float8) NOT NULL
            if (summaryRecord.line_9_obligation_added_diesel != null) {
                destinationStmt.setDouble(30, summaryRecord.line_9_obligation_added_diesel.doubleValue())
            } else {
                destinationStmt.setDouble(30, 0.0)
            }

            // 31. line_9_obligation_added_jet_fuel (float8) NOT NULL
            destinationStmt.setDouble(31, 0.0) // No mapping

            // 32. line_10_net_renewable_fuel_supplied_gasoline (float8) NOT NULL
            destinationStmt.setDouble(32, 0.0) // No mapping

            // 33. line_10_net_renewable_fuel_supplied_diesel (float8) NOT NULL
            destinationStmt.setDouble(33, 0.0) // No mapping

            // 34. line_10_net_renewable_fuel_supplied_jet_fuel (float8) NOT NULL
            destinationStmt.setDouble(34, 0.0) // No mapping

            // 35. line_11_non_compliance_penalty_gasoline (float8)
            destinationStmt.setNull(35, java.sql.Types.FLOAT) // No mapping

            // 36. line_11_non_compliance_penalty_diesel (float8)
            destinationStmt.setNull(36, java.sql.Types.FLOAT) // No mapping

            // 37. line_11_non_compliance_penalty_jet_fuel (float8)
            destinationStmt.setNull(37, java.sql.Types.FLOAT) // No mapping

            // 38. line_12_low_carbon_fuel_required (float8) NOT NULL
            destinationStmt.setDouble(38, 0.0) // No mapping

            // 39. line_13_low_carbon_fuel_supplied (float8) NOT NULL
            destinationStmt.setDouble(39, 0.0) // No mapping

            // 40. line_14_low_carbon_fuel_surplus (float8) NOT NULL
            destinationStmt.setDouble(40, 0.0) // No mapping

            // 41. line_15_banked_units_used (float8) NOT NULL
            destinationStmt.setDouble(41, 0.0) // No mapping

            // 42. line_16_banked_units_remaining (float8) NOT NULL
            destinationStmt.setDouble(42, 0.0) // No mapping

            // 43. line_17_non_banked_units_used (float8) NOT NULL
            destinationStmt.setDouble(43, 0.0) // No mapping

            // 44. line_18_units_to_be_banked (float8) NOT NULL
            destinationStmt.setDouble(44, 0.0) // No mapping

            // 45. line_19_units_to_be_exported (float8) NOT NULL
            destinationStmt.setDouble(45, 0.0) // No mapping

            // 46. line_20_surplus_deficit_units (float8) NOT NULL
            destinationStmt.setDouble(46, 0.0) // No mapping

            // 47. line_21_surplus_deficit_ratio (float8) NOT NULL
            destinationStmt.setDouble(47, 0.0) // No mapping

            // 48. line_22_compliance_units_issued (float8) NOT NULL
            destinationStmt.setDouble(48, summaryRecord.line_22_compliance_units_issued)

            // 49. line_11_fossil_derived_base_fuel_gasoline (float8) NOT NULL
            destinationStmt.setDouble(49, 0.0) // No mapping

            // 50. line_11_fossil_derived_base_fuel_diesel (float8) NOT NULL
            destinationStmt.setDouble(50, 0.0) // No mapping

            // 51. line_11_fossil_derived_base_fuel_jet_fuel (float8) NOT NULL
            destinationStmt.setDouble(51, 0.0) // No mapping

            // 52. line_11_fossil_derived_base_fuel_total (float8) NOT NULL
            destinationStmt.setDouble(52, 0.0) // No mapping

            // 53. line_21_non_compliance_penalty_payable (float8) NOT NULL
            destinationStmt.setDouble(53, 0.0) // No mapping

            // 54. total_non_compliance_penalty_payable (float8) NOT NULL
            destinationStmt.setDouble(54, 0.0) // No mapping

            // 55. credits_offset_a (int4)
            destinationStmt.setInt(55, summaryRecord.credits_offset_a)

            // 56. credits_offset_b (int4)
            destinationStmt.setInt(56, summaryRecord.credits_offset_b)

            // 57. credits_offset_c (int4)
            destinationStmt.setInt(57, summaryRecord.credits_offset_c)

            // 58. create_date (timestamptz)
            destinationStmt.setTimestamp(58, summaryRecord.create_date)

            // 59. update_date (timestamptz)
            destinationStmt.setTimestamp(59, summaryRecord.update_date)

            // 60. create_user (varchar)
            destinationStmt.setString(60, summaryRecord.create_user)

            // 61. update_user (varchar)
            destinationStmt.setString(61, summaryRecord.update_user)

            // Add to batch
            destinationStmt.addBatch()
            totalInserted++

        } catch (Exception e) {
            log.error("Failed to insert summary_record for compliance_report_id: ${summaryRecord.compliance_report_id}, summary_id: ${summaryRecord.summary_id}", e)
            totalSkipped++
            // Continue processing other records
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
            log.warn("Skipped ${totalSkipped} records due to missing compliance_report_id in destination or insertion errors.")
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
    // Ensure connections are closed in case of unexpected errors
    if (sourceConn != null && !sourceConn.isClosed()) sourceConn.close()
    if (destinationConn != null && !destinationConn.isClosed()) destinationConn.close()
    throw e
}
