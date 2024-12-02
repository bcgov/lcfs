import groovy.json.JsonSlurper
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet

def SOURCE_QUERY = """
    SELECT
        ct.id AS transaction_id,
        ct.initiator_id AS initiator_id,
        ct.respondent_id AS respondent_id,
        ct.date_of_written_agreement AS agreement_date,
        ct.trade_effective_date AS transaction_effective_date,
        ct.number_of_credits AS quantity,
        ct.create_user_id AS create_user,
        ct.create_timestamp AS create_date,
        ct.update_user_id AS update_user,
        ct.update_timestamp AS update_date,
        ctt.the_type AS transaction_type,
        ct.fair_market_value_per_credit AS price_per_unit
    FROM
        credit_trade ct
        JOIN credit_trade_type ctt ON ct.type_id = ctt.id
        JOIN credit_trade_status cts ON ct.status_id = cts.id
    WHERE
        ctt.the_type IN ('Credit Validation', 'Part 3 Award', 'Credit Reduction', 'Administrative Adjustment')
        AND cts.status = 'Approved';
"""

// Fetch connections to both the source and destination databases
def sourceDbcpService = context.controllerServiceLookup.getControllerService('3245b078-0192-1000-ffff-ffffba20c1eb')
def destinationDbcpService = context.controllerServiceLookup.getControllerService('3244bf63-0192-1000-ffff-ffffc8ec6d93')

Connection sourceConn = null
Connection destinationConn = null

try {
    sourceConn = sourceDbcpService.getConnection()
    destinationConn = destinationDbcpService.getConnection()
    destinationConn.setAutoCommit(false)

    def transactionStmt = destinationConn.prepareStatement('''
        INSERT INTO transaction (
            compliance_units, organization_id, transaction_action, effective_status
        ) VALUES (?, ?, ?::transaction_action_enum, TRUE)
        RETURNING transaction_id
    ''')

    PreparedStatement sourceStmt = sourceConn.prepareStatement(SOURCE_QUERY)
    ResultSet resultSet = sourceStmt.executeQuery()

    int recordCount = 0

    while (resultSet.next()) {
        recordCount++
        def transactionType = resultSet.getString('transaction_type')
        def organizationId = resultSet.getInt('respondent_id')
        def quantity = resultSet.getInt('quantity')
        def action = 'Adjustment'

        // Adjust quantity for 'Credit Reduction' transactions
        if (transactionType == 'Credit Reduction') {
            quantity = -quantity
        }

        if (organizationId > 0 && quantity != null) {
            insertTransaction(transactionStmt, organizationId, quantity, action)
        } else {
            log.warn("Skipping transaction_id ${resultSet.getInt('transaction_id')}: Missing required data.")
        }
    }

    resultSet.close()
    destinationConn.commit()
    log.debug("Processed ${recordCount} records successfully.")
} catch (Exception e) {
    log.error('Error occurred while processing data', e)
    destinationConn?.rollback()
    throw e  // Rethrow the exception to allow NiFi to handle retries or failure routing
} finally {
    // Close resources in reverse order of their creation
    if (transactionStmt != null) transactionStmt.close()
    if (resultSet != null) resultSet.close()
    if (sourceStmt != null) sourceStmt.close()
    if (sourceConn != null) sourceConn.close()
    if (destinationConn != null) destinationConn.close()
}

def insertTransaction(PreparedStatement stmt, int orgId, int quantity, String action) {
    stmt.setInt(1, quantity)
    stmt.setInt(2, orgId)
    stmt.setString(3, action)

    def result = stmt.executeQuery()
    if (result.next()) {
        def transactionId = result.getInt('transaction_id')
        log.debug("Inserted transaction_id ${transactionId} for organization_id ${orgId}")
    }
    result.close()
}
