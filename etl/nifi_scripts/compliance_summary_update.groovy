import groovy.json.JsonSlurper
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.sql.Timestamp

// =========================================
// NiFi Controller Services
// =========================================
def sourceDbcpService = context.controllerServiceLookup.getControllerService('3245b078-0192-1000-ffff-ffffba20c1eb')
def destinationDbcpService = context.controllerServiceLookup.getControllerService('3244bf63-0192-1000-ffff-ffffc8ec6d93')

Connection sourceConn = null
Connection destinationConn = null

log.warn("******* STARTING SUMMARY UPDATE *******")

try {
    sourceConn = sourceDbcpService.getConnection()
    destinationConn = destinationDbcpService.getConnection()
    destinationConn.setAutoCommit(false)

    // =========================================
    // Fetch Mapping of legacy_id to LCFS compliance_report_id from Destination
    // =========================================
    log.info("Fetching legacy_id mapping from LCFS compliance_report table.")
    def legacyToLcfsIdMap = [:]  // Map<legacy_id, lcfs_id>
    def mappingStmt = destinationConn.prepareStatement("""
        SELECT compliance_report_id, legacy_id 
        FROM public.compliance_report 
        WHERE legacy_id IS NOT NULL
    """)
    ResultSet mappingRs = mappingStmt.executeQuery()
    while (mappingRs.next()) {
        def lcfsId = mappingRs.getInt("compliance_report_id")
        def legacyId = mappingRs.getInt("legacy_id")
        legacyToLcfsIdMap[legacyId] = lcfsId
    }
    mappingRs.close()
    mappingStmt.close()
    log.info("Fetched ${legacyToLcfsIdMap.size()} legacy to LCFS compliance report mappings.")

    // =========================================
    // Fetch TFRS Compliance Report Snapshots (Source Data)
    // =========================================
    def SOURCE_QUERY = """
        SELECT compliance_report_id, snapshot
        FROM public.compliance_report_snapshot
        WHERE snapshot IS NOT NULL
    """
    PreparedStatement sourceStmt = sourceConn.prepareStatement(SOURCE_QUERY)
    ResultSet rs = sourceStmt.executeQuery()
    def jsonSlurper = new JsonSlurper()

    // =========================================
    // Prepare the UPDATE Statement for Destination Summary
    // =========================================
    def UPDATE_SQL = """
        UPDATE public.compliance_report_summary
        SET 
            line_1_fossil_derived_base_fuel_gasoline = ?,
            line_2_eligible_renewable_fuel_supplied_gasoline = ?,
            line_3_total_tracked_fuel_supplied_gasoline = ?,
            line_4_eligible_renewable_fuel_required_gasoline = ?,
            line_5_net_notionally_transferred_gasoline = ?,
            line_6_renewable_fuel_retained_gasoline = ?,
            line_7_previously_retained_gasoline = ?,
            line_8_obligation_deferred_gasoline = ?,
            line_9_obligation_added_gasoline = ?,
            line_10_net_renewable_fuel_supplied_gasoline = ?,
            line_11_non_compliance_penalty_gasoline = ?,
            line_1_fossil_derived_base_fuel_diesel = ?,
            line_2_eligible_renewable_fuel_supplied_diesel = ?,
            line_3_total_tracked_fuel_supplied_diesel = ?,
            line_4_eligible_renewable_fuel_required_diesel = ?,
            line_5_net_notionally_transferred_diesel = ?,
            line_6_renewable_fuel_retained_diesel = ?,
            line_7_previously_retained_diesel = ?,
            line_8_obligation_deferred_diesel = ?,
            line_9_obligation_added_diesel = ?,
            line_10_net_renewable_fuel_supplied_diesel = ?,
            line_11_non_compliance_penalty_diesel = ?,
            line_1_fossil_derived_base_fuel_jet_fuel = ?,
            line_2_eligible_renewable_fuel_supplied_jet_fuel = ?,
            line_3_total_tracked_fuel_supplied_jet_fuel = ?,
            line_4_eligible_renewable_fuel_required_jet_fuel = ?,
            line_5_net_notionally_transferred_jet_fuel = ?,
            line_6_renewable_fuel_retained_jet_fuel = ?,
            line_7_previously_retained_jet_fuel = ?,
            line_8_obligation_deferred_jet_fuel = ?,
            line_9_obligation_added_jet_fuel = ?,
            line_10_net_renewable_fuel_supplied_jet_fuel = ?,
            line_11_non_compliance_penalty_jet_fuel = ?,
            line_12_low_carbon_fuel_required = ?,
            line_13_low_carbon_fuel_supplied = ?,
            line_14_low_carbon_fuel_surplus = ?,
            line_15_banked_units_used = ?,
            line_16_banked_units_remaining = ?,
            line_17_non_banked_units_used = ?,
            line_18_units_to_be_banked = ?,
            line_19_units_to_be_exported = ?,
            line_20_surplus_deficit_units = ?,
            line_21_surplus_deficit_ratio = ?,
            line_22_compliance_units_issued = ?,
            line_11_fossil_derived_base_fuel_gasoline = ?,
            line_11_fossil_derived_base_fuel_diesel = ?,
            line_11_fossil_derived_base_fuel_jet_fuel = ?,
            line_11_fossil_derived_base_fuel_total = ?,
            line_21_non_compliance_penalty_payable = ?,
            total_non_compliance_penalty_payable = ?,
            historical_snapshot = ?::jsonb
        WHERE compliance_report_id = ?
    """
    PreparedStatement updateStmt = destinationConn.prepareStatement(UPDATE_SQL)

    int updateCount = 0
    int skipCount = 0

    // =========================================
    // Process Each Source Record and Update Destination Summary
    // =========================================
    while (rs.next()) {
        // The source compliance_report_id is the legacy_id
        def legacyComplianceReportId = rs.getInt("compliance_report_id")
        def lcfsComplianceReportId = legacyToLcfsIdMap[legacyComplianceReportId]
        if (lcfsComplianceReportId == null) {
            log.warn("No LCFS compliance report found for legacy id ${legacyComplianceReportId}. Skipping record.")
            skipCount++
            continue
        }
        log.warn("Processing source record with legacy_id: ${legacyComplianceReportId}")
        def snapshotJson = rs.getString("snapshot")
        def summaryJson = jsonSlurper.parseText(snapshotJson)

        try {
            // ------------------------------
            // Gasoline Class Mappings
            // ------------------------------
            def line1Gas      = new BigDecimal(summaryJson.summary.lines."1")
            def line2Gas      = new BigDecimal(summaryJson.summary.lines."2")
            def line3Gas      = new BigDecimal(summaryJson.summary.lines."3")
            def line4Gas      = new BigDecimal(summaryJson.summary.lines."4")
            def line5Gas      = new BigDecimal(summaryJson.summary.lines."5")
            def line6Gas      = new BigDecimal(summaryJson.summary.lines."6")
            def line7Gas      = new BigDecimal(summaryJson.summary.lines."7")
            def line8Gas      = new BigDecimal(summaryJson.summary.lines."8")
            def line9Gas      = new BigDecimal(summaryJson.summary.lines."9")
            def line10Gas     = new BigDecimal(summaryJson.summary.lines."10")
            def line11Gas     = new BigDecimal(summaryJson.summary.lines."11")
            // ------------------------------
            // Diesel Class Mappings
            // ------------------------------
            def line1Diesel   = new BigDecimal(summaryJson.summary.lines."12")
            def line2Diesel   = new BigDecimal(summaryJson.summary.lines."13")
            def line3Diesel   = new BigDecimal(summaryJson.summary.lines."14")
            def line4Diesel   = new BigDecimal(summaryJson.summary.lines."15")
            def line5Diesel   = new BigDecimal(summaryJson.summary.lines."16")
            def line6Diesel   = new BigDecimal(summaryJson.summary.lines."17")
            def line7Diesel   = new BigDecimal(summaryJson.summary.lines."18")
            def line8Diesel   = new BigDecimal(summaryJson.summary.lines."19")
            def line9Diesel   = new BigDecimal(summaryJson.summary.lines."20")
            def line10Diesel  = new BigDecimal(summaryJson.summary.lines."21")
            def line11Diesel  = new BigDecimal(summaryJson.summary.lines."22")
            // ------------------------------
            // Jet Fuel: No TFRS data, set to 0
            // ------------------------------
            def jetFuelDefault = 0.0
            // ------------------------------
            // Low Carbon Fuel Requirement Summary
            // ------------------------------
            def complianceUnitsIssued = new BigDecimal(summaryJson.summary.lines."25")
            def bankedUsed            = new BigDecimal(summaryJson.summary.lines."26")
            // ------------------------------
            // Fossil Derived Base Fuel (Aggregate)
            // ------------------------------
            def fossilGas   = line1Gas
            def fossilDiesel = line1Diesel
            def fossilJet    = 0.0
            def fossilTotal  = fossilGas.add(fossilDiesel)

            // ------------------------------
            // Non-compliance Penalty Fields
            // ------------------------------
            def line28NonCompliance = new BigDecimal(summaryJson.summary.lines."28")  // Part 3 penalty
            def totalPayable = new BigDecimal(summaryJson.summary.total_payable)      // Total payable from snapshot

            // Set parameters using a running index
            int idx = 1
            // Gasoline Class
            updateStmt.setBigDecimal(idx++, line1Gas)         // line_1_fossil_derived_base_fuel_gasoline
            updateStmt.setBigDecimal(idx++, line2Gas)         // line_2_eligible_renewable_fuel_supplied_gasoline
            updateStmt.setBigDecimal(idx++, line3Gas)         // line_3_total_tracked_fuel_supplied_gasoline
            updateStmt.setBigDecimal(idx++, line4Gas)         // line_4_eligible_renewable_fuel_required_gasoline
            updateStmt.setBigDecimal(idx++, line5Gas)         // line_5_net_notionally_transferred_gasoline
            updateStmt.setBigDecimal(idx++, line6Gas)         // line_6_renewable_fuel_retained_gasoline
            updateStmt.setBigDecimal(idx++, line7Gas)         // line_7_previously_retained_gasoline
            updateStmt.setBigDecimal(idx++, line8Gas)         // line_8_obligation_deferred_gasoline
            updateStmt.setBigDecimal(idx++, line9Gas)         // line_9_obligation_added_gasoline
            updateStmt.setBigDecimal(idx++, line10Gas)        // line_10_net_renewable_fuel_supplied_gasoline
            updateStmt.setBigDecimal(idx++, line11Gas)        // line_11_non_compliance_penalty_gasoline
            // Diesel Class
            updateStmt.setBigDecimal(idx++, line1Diesel)      // line_1_fossil_derived_base_fuel_diesel
            updateStmt.setBigDecimal(idx++, line2Diesel)      // line_2_eligible_renewable_fuel_supplied_diesel
            updateStmt.setBigDecimal(idx++, line3Diesel)      // line_3_total_tracked_fuel_supplied_diesel
            updateStmt.setBigDecimal(idx++, line4Diesel)      // line_4_eligible_renewable_fuel_required_diesel
            updateStmt.setBigDecimal(idx++, line5Diesel)      // line_5_net_notionally_transferred_diesel
            updateStmt.setBigDecimal(idx++, line6Diesel)      // line_6_renewable_fuel_retained_diesel
            updateStmt.setBigDecimal(idx++, line7Diesel)      // line_7_previously_retained_diesel
            updateStmt.setBigDecimal(idx++, line8Diesel)      // line_8_obligation_deferred_diesel
            updateStmt.setBigDecimal(idx++, line9Diesel)      // line_9_obligation_added_diesel
            updateStmt.setBigDecimal(idx++, line10Diesel)     // line_10_net_renewable_fuel_supplied_diesel
            updateStmt.setBigDecimal(idx++, line11Diesel)     // line_11_non_compliance_penalty_diesel
            // Jet Fuel (all set to 0)
            updateStmt.setDouble(idx++, jetFuelDefault)       // line_1_fossil_derived_base_fuel_jet_fuel
            updateStmt.setDouble(idx++, jetFuelDefault)       // line_2_eligible_renewable_fuel_supplied_jet_fuel
            updateStmt.setDouble(idx++, jetFuelDefault)       // line_3_total_tracked_fuel_supplied_jet_fuel
            updateStmt.setDouble(idx++, jetFuelDefault)       // line_4_eligible_renewable_fuel_required_jet_fuel
            updateStmt.setDouble(idx++, jetFuelDefault)       // line_5_net_notionally_transferred_jet_fuel
            updateStmt.setDouble(idx++, jetFuelDefault)       // line_6_renewable_fuel_retained_jet_fuel
            updateStmt.setDouble(idx++, jetFuelDefault)       // line_7_previously_retained_jet_fuel
            updateStmt.setDouble(idx++, jetFuelDefault)       // line_8_obligation_deferred_jet_fuel
            updateStmt.setDouble(idx++, jetFuelDefault)       // line_9_obligation_added_jet_fuel
            updateStmt.setDouble(idx++, jetFuelDefault)       // line_10_net_renewable_fuel_supplied_jet_fuel
            updateStmt.setDouble(idx++, jetFuelDefault)       // line_11_non_compliance_penalty_jet_fuel
            // Low Carbon Fuel Requirement Summary
            updateStmt.setDouble(idx++, 0.0)                  // line_12_low_carbon_fuel_required
            updateStmt.setDouble(idx++, 0.0)                  // line_13_low_carbon_fuel_supplied
            updateStmt.setBigDecimal(idx++, 0.0)              // line_14_low_carbon_fuel_surplus
            updateStmt.setBigDecimal(idx++, bankedUsed)       // line_15_banked_units_used
            updateStmt.setDouble(idx++, 0.0)                  // line_16_banked_units_remaining
            updateStmt.setDouble(idx++, 0.0)                  // line_17_non_banked_units_used
            updateStmt.setDouble(idx++, 0.0)                  // line_18_units_to_be_banked
            updateStmt.setDouble(idx++, 0.0)                  // line_19_units_to_be_exported
            updateStmt.setBigDecimal(idx++, 0.0)              // line_20_surplus_deficit_units
            updateStmt.setDouble(idx++, 0.0)                  // line_21_surplus_deficit_ratio
            updateStmt.setBigDecimal(idx++, complianceUnitsIssued) // line_22_compliance_units_issued
            // Fossil Derived Base Fuel (Aggregate – Second Set)
            updateStmt.setBigDecimal(idx++, fossilGas)        // line_11_fossil_derived_base_fuel_gasoline (repeat)
            updateStmt.setBigDecimal(idx++, fossilDiesel)     // line_11_fossil_derived_base_fuel_diesel (repeat)
            updateStmt.setDouble(idx++, fossilJet)            // line_11_fossil_derived_base_fuel_jet_fuel (repeat)
            updateStmt.setBigDecimal(idx++, fossilTotal)      // line_11_fossil_derived_base_fuel_total (repeat)
            // Non-compliance Penalty Fields
            updateStmt.setBigDecimal(idx++, line28NonCompliance) // line_21_non_compliance_penalty_payable
            updateStmt.setBigDecimal(idx++, totalPayable) // total_non_compliance_penalty_payable (from snapshot total_payable)
            // Historical Snapshot
            updateStmt.setString(idx++, snapshotJson) // Store the entire snapshot JSON
            // WHERE clause: compliance_report_id
            updateStmt.setInt(idx++, lcfsComplianceReportId)

            updateStmt.addBatch()
            log.info("Successfully processed legacy id ${legacyComplianceReportId} (LCFS ID: ${lcfsComplianceReportId}), adding to batch.")
            updateCount++
        } catch (Exception e) {
            log.error("Error processing legacy compliance_report_id ${legacyComplianceReportId}", e)
            skipCount++
            continue
        }
    }

    rs.close()
    sourceStmt.close()

    // =========================================
    // Execute Batch Update and Commit
    // =========================================
    updateStmt.executeBatch()
    destinationConn.commit()

    log.info("Updated ${updateCount} compliance_report_summary records. Skipped ${skipCount} records.")

    updateStmt.close()
    destinationConn.close()
    sourceConn.close()

} catch (Exception e) {
    log.error("ETL process failed.", e)
    if (destinationConn != null && !destinationConn.isClosed()) {
        destinationConn.rollback()
        destinationConn.close()
    }
    if (sourceConn != null && !sourceConn.isClosed()) {
        sourceConn.close()
    }
    throw e
}

log.warn("******* SUMMARY UPDATE COMPLETED *******")