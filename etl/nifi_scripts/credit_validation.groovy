import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet

/* 
This NiFi Groovy script:
1. Fetches all credit trades from the TFRS database with status_id = 7.
2. Sums the credit balances for each organization based on credit_trade_type logic:
   - Sell (type_id = 1): initiator loses credits, respondent gains credits
   - Buy (type_id = 2): initiator gains credits, respondent loses credits
   - Credit Validation (type_id = 3): respondent_id gains credits
   - Credit Reduction (type_id = 4): respondent_id loses credits
   - Part 3 Award (type_id = 5): respondent_id gains credits
   (Ignore type_id = 6 for now as instructed)
   
3. Fetches LCFS transactions and sums them per organization.
4. Prints out organizations where TFRS balance differs from LCFS balance, along with the discrepancy.
5. Logs how many organizations have discrepancies and how many have matching balances.
*/

log.warn("******* STARTING CREDIT VALIDATION *******")

// NiFi DBCP Controller Services
def sourceDbcpService = context.controllerServiceLookup.getControllerService('3245b078-0192-1000-ffff-ffffba20c1eb')
def destinationDbcpService = context.controllerServiceLookup.getControllerService('3244bf63-0192-1000-ffff-ffffc8ec6d93')

Connection sourceConn = null
Connection destinationConn = null

try {

    sourceConn = sourceDbcpService.getConnection()
    destinationConn = destinationDbcpService.getConnection()

    // Query TFRS for all credit trades with status_id = 7
    def TFRS_QUERY = """
        SELECT ct.id AS credit_trade_id,
               ct.type_id,
               ct.initiator_id,
               ct.respondent_id,
               ct.number_of_credits
        FROM credit_trade ct
        WHERE ct.status_id = 7
    """

    PreparedStatement tfrsStmt = sourceConn.prepareStatement(TFRS_QUERY)
    ResultSet tfrsRs = tfrsStmt.executeQuery()

    // Map for TFRS balances: org_id -> credits
    def tfrsBalances = [:].withDefault {0}

    while (tfrsRs.next()) {
        def typeId = tfrsRs.getInt("type_id")
        def initiator = tfrsRs.getInt("initiator_id")
        def respondent = tfrsRs.getInt("respondent_id")
        def credits = tfrsRs.getInt("number_of_credits")

        // Apply logic based on type_id
        switch(typeId) {
            case 1: // Sell
                tfrsBalances[initiator] = tfrsBalances[initiator] - credits
                tfrsBalances[respondent] = tfrsBalances[respondent] + credits
                break
            case 2: // Buy
                tfrsBalances[initiator] = tfrsBalances[initiator] + credits
                tfrsBalances[respondent] = tfrsBalances[respondent] - credits
                break
            case 3: // Credit Validation
                tfrsBalances[respondent] = tfrsBalances[respondent] + credits
                break
            case 4: // Credit Reduction
                tfrsBalances[respondent] = tfrsBalances[respondent] - credits
                break
            case 5: // Part 3 Award
                tfrsBalances[respondent] = tfrsBalances[respondent] + credits
                break
            // type_id = 6 (Admin Adjustment) not considered per requirement
        }
    }

    tfrsRs.close()
    tfrsStmt.close()

    // Query LCFS for all transactions and sum by org
    def LCFS_QUERY = """
        SELECT organization_id, SUM(compliance_units) AS total_units
        FROM transaction
        WHERE transaction_action = 'Adjustment'
        GROUP BY organization_id
    """

    PreparedStatement lcfsStmt = destinationConn.prepareStatement(LCFS_QUERY)
    ResultSet lcfsRs = lcfsStmt.executeQuery()

    def lcfsBalances = [:].withDefault {0}

    while (lcfsRs.next()) {
        def orgId = lcfsRs.getInt("organization_id")
        def totalUnits = lcfsRs.getInt("total_units")
        lcfsBalances[orgId] = totalUnits
    }

    lcfsRs.close()
    lcfsStmt.close()

    // Compare balances
    def allOrgs = (tfrsBalances.keySet() + lcfsBalances.keySet()).unique()
    def discrepancies = []
    allOrgs.each { orgId ->
        def tfrsVal = tfrsBalances[orgId]
        def lcfsVal = lcfsBalances[orgId]
        if (tfrsVal != lcfsVal) {
            def diff = tfrsVal - lcfsVal
            discrepancies << [orgId: orgId, tfrs: tfrsVal, lcfs: lcfsVal, difference: diff]
        }
    }

    // Print out discrepancies
    if (discrepancies) {
        log.warn("******** Organizations with balance discrepancies between TFRS and LCFS: ********")
        discrepancies.each { d ->
            log.warn("OrgID: ${d.orgId}, TFRS: ${d.tfrs}, LCFS: ${d.lcfs}, Difference (TFRS-LCFS): ${d.difference}")
        }
    } else {
        log.warn("No discrepancies found. Balances match for all organizations.")
    }

    // Log counts
    def discrepancyCount = discrepancies.size()
    def totalOrgs = allOrgs.size()
    def matchingCount = totalOrgs - discrepancyCount

    log.warn("Number of organizations with discrepancies: ${discrepancyCount}")
    log.warn("Number of organizations with matching balances: ${matchingCount}")
    log.warn("Total organizations considered: ${totalOrgs}")

} catch (Exception e) {
    log.error("Error while validating organization balances", e)
} finally {
    log.warn("**** FINISHED CREDIT VALIDATION ****")
    if (sourceConn != null) sourceConn.close()
    if (destinationConn != null) destinationConn.close()
}
