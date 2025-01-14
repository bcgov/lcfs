import groovy.json.JsonSlurper
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.time.OffsetDateTime
import java.sql.Timestamp

log.warn("**** STARTING TRANSFER ETL ****")

def SOURCE_QUERY = """
SELECT
        ct.id AS transfer_id,
        ct.initiator_id AS from_organization_id,
        ct.respondent_id AS to_organization_id,
        ct.date_of_written_agreement AS agreement_date,
        ct.trade_effective_date AS transaction_effective_date,
        ct.fair_market_value_per_credit AS price_per_unit,
        ct.number_of_credits AS quantity,
        ct.create_user_id as create_user,
        ct.update_user_id as update_user,
        ct.update_timestamp as update_date,
        ct.create_timestamp  as create_date,
        json_agg (
          json_build_object (
            'transfer_id',
            cth.credit_trade_id,
            'transfer_status',
            case
              WHEN cts_history.status = 'Cancelled' or cth.is_rescinded = true THEN 'Rescinded'
              WHEN cts_history.status = 'Accepted' THEN 'Submitted'
              WHEN cts_history.status IN ('Approved', 'Recorded') THEN 'Recorded'
              WHEN cts_history.status IN ('Not Recommended', 'Declined') THEN 'Refused'
              WHEN cts_history.status = 'Declined' THEN 'Refused'
              WHEN cts_history.status = 'Refused' THEN 'Declined'
              WHEN cts_history.status = 'Submitted' AND cth.is_rescinded = false THEN 'Sent'
              ELSE cts_history.status
            END,
            'user_profile_id',
            cth.create_user_id,
            'create_timestamp',
            cth.create_timestamp
          )
        ) AS credit_trade_history,
        COALESCE(ctc.category, NULL) AS transfer_category,
        case
          WHEN cts.status = 'Cancelled' or ct.is_rescinded = true THEN 'Rescinded'
          WHEN cts.status = 'Accepted' THEN 'Submitted'
          WHEN cts.status IN ('Approved', 'Recorded') THEN 'Recorded'
          WHEN cts.status IN ('Not Recommended', 'Declined') THEN 'Refused'
          WHEN cts.status = 'Declined' THEN 'Refused'
          WHEN cts.status = 'Refused' THEN 'Declined'
          WHEN cts.status = 'Submitted' THEN 'Sent'
          ELSE cts.status
        END AS current_status
      FROM
        credit_trade ct
        JOIN credit_trade_type ctt ON ct.type_id = ctt.id
        LEFT OUTER JOIN credit_trade_category ctc ON ct.trade_category_id = ctc.id
        JOIN credit_trade_status cts ON ct.status_id = cts.id
        LEFT JOIN credit_trade_history cth ON cth.credit_trade_id = ct.id
        JOIN credit_trade_status cts_history ON cth.status_id = cts_history.id
      WHERE
        ctt.the_type IN ('Buy', 'Sell')
      GROUP BY
        ct.id,
        ct.initiator_id,
        ct.respondent_id,
        ct.date_of_written_agreement,
        ct.trade_effective_date,
        ct.fair_market_value_per_credit,
        ct.number_of_credits,
        ctc.category,
        cts.status;
      """

def COMMENT_QUERY = """
    SELECT
        ct.id AS credit_trade_id,
        MAX(CASE
            WHEN u.organization_id = ct.initiator_id THEN ctc.credit_trade_comment
        END) AS from_org_comment,
        MAX(CASE
            WHEN u.organization_id = ct.respondent_id THEN ctc.credit_trade_comment
        END) AS to_org_comment,
        MAX(CASE
            WHEN u.organization_id = 1 AND ctc.is_privileged_access = FALSE THEN ctc.credit_trade_comment
        END) AS gov_comment
    FROM
        credit_trade ct
        LEFT JOIN credit_trade_comment ctc ON ctc.credit_trade_id = ct.id
        LEFT JOIN "user" u ON ctc.create_user_id = u.id
    WHERE
        ct.id = ?
    GROUP BY
        ct.id;
"""

def INTERNAL_COMMENT_QUERY = """
    SELECT
        ctc.id,
        ctc.credit_trade_id,
        ctc.credit_trade_comment,
        ctc.create_user_id,
        ctc.create_timestamp,
        STRING_AGG (r."name", '; ') AS role_names
    FROM
        credit_trade_comment ctc
        JOIN "user" u ON u.id = ctc.create_user_id
        AND u.organization_id = 1
        AND ctc.is_privileged_access = TRUE
        JOIN user_role ur ON ur.user_id = u.id
        JOIN "role" r ON ur.role_id = r.id
    WHERE ctc.credit_trade_id = ?
    GROUP BY
        ctc.id, ctc.credit_trade_id, ctc.credit_trade_comment,
        ctc.create_user_id, ctc.create_timestamp
    ORDER BY
        ctc.credit_trade_id, ctc.create_timestamp;
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

    // Fetch status and category data once and cache it
    def preparedData = prepareData(destinationConn)

    def statements = prepareStatements(destinationConn)

    destinationConn.createStatement().execute('DROP FUNCTION IF EXISTS refresh_transaction_aggregate() CASCADE;')
    destinationConn.createStatement().execute("""
        CREATE OR REPLACE FUNCTION refresh_transaction_aggregate()
        RETURNS void AS \$\$
        BEGIN
            -- Temporarily disable the materialized view refresh
        END;
        \$\$ LANGUAGE plpgsql;
    """)

    PreparedStatement sourceStmt = sourceConn.prepareStatement(SOURCE_QUERY)
    PreparedStatement commentStmt = sourceConn.prepareStatement(COMMENT_QUERY)
    PreparedStatement internalCommentStmt = sourceConn.prepareStatement(INTERNAL_COMMENT_QUERY)
    ResultSet resultSet = sourceStmt.executeQuery()

    int recordCount = 0

    while (resultSet.next()) {
        recordCount++
        def jsonSlurper = new JsonSlurper()
        def creditTradeHistory = resultSet.getString('credit_trade_history')
        def creditTradeHistoryJson = creditTradeHistory ? jsonSlurper.parseText(creditTradeHistory) : []

        // First, determine if the transfer already exists
        def transferIdFromSource = resultSet.getInt('transfer_id')
        if (transferExists(destinationConn, transferIdFromSource)) {
            log.warn("Duplicate transfer detected with transfer_id: ${transferIdFromSource}, skipping insertion.")
            // Since this transfer already exists, do not insert transactions or history again.
            continue
        }

        // Identify if the history ever contained "Recommended" or "Not Recommended"
        def recommendationValue = null
        if (creditTradeHistoryJson.any { it.transfer_status == 'Recommended' }) {
            recommendationValue = 'Record'  // matches "Record" in the transfer_recommendation_enum
        } else if (creditTradeHistoryJson.any { it.transfer_status == 'Not Recommended' }) {
            recommendationValue = 'Refuse'  // matches "Refuse" in the transfer_recommendation_enum
    }

        // Only if transfer does not exist, proceed to create transactions and then insert the transfer.
        def (fromTransactionId, toTransactionId) = processTransactions(resultSet.getString('current_status'),
                resultSet,
                statements.transactionStmt)

        def transferId = insertTransfer(resultSet, statements.transferStmt, commentStmt,
                fromTransactionId, toTransactionId, preparedData, destinationConn, recommendationValue)

        if (transferId) {
            processHistory(transferId, creditTradeHistoryJson, statements.historyStmt, preparedData)
            processInternalComments(transferId, internalCommentStmt, statements.internalCommentStmt,
                    statements.transferInternalCommentStmt)
        } else {
            log.warn("Transfer not inserted for record: ${transferIdFromSource}")
        }
}
    resultSet.close()
    destinationConn.createStatement().execute("""
        CREATE OR REPLACE FUNCTION refresh_transaction_aggregate()
        RETURNS void AS \$\$
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_aggregate;
        END;
        \$\$ LANGUAGE plpgsql;
    """)
    destinationConn.createStatement().execute('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_aggregate')

    destinationConn.commit()
    log.debug("Processed ${recordCount} records successfully.")
} catch (Exception e) {
    log.error('Error occurred while processing data', e)
    destinationConn?.rollback()
} finally {
    if (sourceConn != null) sourceConn.close()
    if (destinationConn != null) destinationConn.close()
}

def logResultSetRow(ResultSet rs) {
    def metaData = rs.getMetaData()
    def columnCount = metaData.getColumnCount()
    def rowData = [:]

    for (int i = 1; i <= columnCount; i++) {
        def columnName = metaData.getColumnName(i)
        def columnValue = rs.getObject(i)
        rowData[columnName] = columnValue
    }

    log.debug("Row data: ${rowData}")
}

def loadTableData(Connection conn, String query, String keyColumn, String valueColumn) {
    def dataMap = [:]
    def stmt = conn.createStatement()
    def rs = stmt.executeQuery(query)

    while (rs.next()) {
        def key = rs.getString(keyColumn)
        def value = rs.getInt(valueColumn)
        if (dataMap.containsKey(key)) {
            log.warn("Duplicate key found for ${key}. Existing value: ${dataMap[key]}, New value: ${value}.")
        }
        dataMap[key] = value
    }

    rs.close()
    stmt.close()
    return dataMap
}

def prepareData(Connection conn) {
    def categoryMap = loadTableData(conn,
        'SELECT DISTINCT category, MIN(transfer_category_id) AS transfer_category_id FROM transfer_category GROUP BY category',
        'category',
        'transfer_category_id'
    )
    def statusMap = loadTableData(conn,
        'SELECT DISTINCT status, MIN(transfer_status_id) AS transfer_status_id FROM transfer_status GROUP BY status',
        'status',
        'transfer_status_id'
    )
    return [
            categoryMap: categoryMap,
            statusMap  : statusMap
    ]
}

def getTransferCategoryId(String category, Map preparedData) {
    return preparedData.categoryMap[category]
}

def getStatusId(String status, Map preparedData) {
    return preparedData.statusMap[status]
}

def prepareStatements(Connection conn) {
    def INSERT_TRANSFER_SQL = '''
          INSERT INTO transfer (
              from_organization_id, to_organization_id, from_transaction_id, to_transaction_id,
              agreement_date, transaction_effective_date, price_per_unit, quantity, from_org_comment, to_org_comment, gov_comment,
              transfer_category_id, current_status_id, recommendation, create_date, update_date, create_user, update_user, effective_status, transfer_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::transfer_recommendation_enum, ?, ?, ?, ?, true, ?)
          RETURNING transfer_id
      '''
    def INSERT_TRANSFER_HISTORY_SQL = '''
          INSERT INTO transfer_history (
              transfer_history_id, transfer_id, transfer_status_id, user_profile_id, create_date, effective_status
          ) VALUES (DEFAULT, ?, ?, ?, ?, true)
      '''
    def INSERT_INTERNAL_COMMENT_SQL = '''
          INSERT INTO internal_comment (
              internal_comment_id, comment, audience_scope, create_user, create_date
          ) VALUES (DEFAULT, ?, ?::audience_scope, ?, ?)
          RETURNING internal_comment_id
      '''
    def INSERT_TRANSFER_INTERNAL_COMMENT_SQL = '''
          INSERT INTO transfer_internal_comment (
              transfer_id, internal_comment_id
          ) VALUES (?, ?)
      '''
    def INSERT_TRANSACTION_SQL = '''
          INSERT INTO transaction (
              transaction_id, compliance_units, organization_id, transaction_action, effective_date, create_user, create_date, effective_status
          ) VALUES (DEFAULT, ?, ?, ?::transaction_action_enum, ?, ?, ?, true)
          RETURNING transaction_id
      '''
    return [transferStmt               : conn.prepareStatement(INSERT_TRANSFER_SQL),
            historyStmt                : conn.prepareStatement(INSERT_TRANSFER_HISTORY_SQL),
            internalCommentStmt        : conn.prepareStatement(INSERT_INTERNAL_COMMENT_SQL),
            transferInternalCommentStmt: conn.prepareStatement(INSERT_TRANSFER_INTERNAL_COMMENT_SQL),
            transactionStmt            : conn.prepareStatement(INSERT_TRANSACTION_SQL)]
}

def toSqlTimestamp(String timestampString) {
    try {
        // Parse the ISO 8601 timestamp and convert to java.sql.Timestamp
        def offsetDateTime = OffsetDateTime.parse(timestampString)
        return Timestamp.from(offsetDateTime.toInstant())
    } catch (Exception e) {
        log.error("Invalid timestamp format: ${timestampString}, defaulting to '1970-01-01T00:00:00Z'")
        return Timestamp.valueOf('1970-01-01 00:00:00')
    }
}

def processTransactions(String currentStatus, ResultSet rs, PreparedStatement stmt) {
    def fromTransactionId = null
    def toTransactionId = null

    switch (currentStatus) {
        case ['Draft', 'Deleted', 'Refused', 'Declined', 'Rescinded']:
            break
        case ['Sent', 'Submitted', 'Recommended']:
            fromTransactionId = insertTransaction(stmt, rs, 'Reserved', rs.getInt('from_organization_id'), true)
            break
        case 'Recorded':
            fromTransactionId = insertTransaction(stmt, rs, 'Adjustment', rs.getInt('from_organization_id'), true)
            toTransactionId = insertTransaction(stmt, rs, 'Adjustment', rs.getInt('to_organization_id'), false)
            break
    }

    return [fromTransactionId, toTransactionId]
}

def insertTransaction(PreparedStatement stmt, ResultSet rs, String action, int orgId, boolean isDebit) {
    def quantity = rs.getInt('quantity')
    if (isDebit) {
        quantity *= -1 // Make the transaction negative for the sender
    }

    stmt.setInt(1, quantity)
    stmt.setInt(2, orgId)
    stmt.setString(3, action)
    stmt.setDate(4, rs.getDate('transaction_effective_date') ?: rs.getDate('agreement_date'))
    stmt.setInt(5, rs.getInt('create_user'))
    stmt.setTimestamp(6, rs.getTimestamp('create_date'))

    def result = stmt.executeQuery()
    return result.next() ? result.getInt('transaction_id') : null
}

def transferExists(Connection conn, int transferId) {
    def duplicateCheckStmt = conn.prepareStatement('SELECT COUNT(*) FROM transfer WHERE transfer_id = ?')
    duplicateCheckStmt.setInt(1, transferId)
    def duplicateResult = duplicateCheckStmt.executeQuery()
    duplicateResult.next()
    def count = duplicateResult.getInt(1)
    duplicateResult.close()
    duplicateCheckStmt.close()

    return count > 0
}

def processHistory(Integer transferId, List creditTradeHistory, PreparedStatement historyStmt, Map preparedData) {
    if (!creditTradeHistory) return

    // Sort the records by create_timestamp to preserve chronological order
    def sortedHistory = creditTradeHistory.sort { a, b ->
        toSqlTimestamp(a.create_timestamp ?: '2013-01-01T00:00:00Z') <=> toSqlTimestamp(b.create_timestamp ?: '2013-01-01T00:00:00Z')
    }

    // Use a Set to track unique combinations of transfer_id and transfer_status
    def processedEntries = new HashSet<String>()

    sortedHistory.each { historyItem ->
        try {
            def statusId = getStatusId(historyItem.transfer_status, preparedData)
            def uniqueKey = "${transferId}_${statusId}"

            // Check if this combination has already been processed
            if (!processedEntries.contains(uniqueKey)) {
                historyStmt.setInt(1, transferId)
                historyStmt.setInt(2, statusId)
                historyStmt.setInt(3, historyItem.user_profile_id)
                historyStmt.setTimestamp(4, toSqlTimestamp(historyItem.create_timestamp ?: '2013-01-01T00:00:00Z'))
                historyStmt.addBatch()
                processedEntries.add(uniqueKey)
            }
        } catch (Exception e) {
            log.error("Error processing history record for transfer_id: ${transferId}", e)
        }
    }

    // Execute batch
    historyStmt.executeBatch()
}

def processInternalComments(Integer transferId, PreparedStatement sourceInternalCommentStmt,
                            PreparedStatement internalCommentStmt,
                            PreparedStatement transferInternalCommentStmt) {
    // Fetch internal comments
    ResultSet internalCommentResult = sourceInternalCommentStmt.executeQuery(transferId)
    def internalComments = []
    while (internalCommentResult.next()) {
        internalComments << [
            id: internalCommentResult.getInt('id'),
            comment: internalCommentResult.getString('credit_trade_comment'),
            roleNames: internalCommentResult.getString('role_names'),
            createUserId: internalCommentResult.getInt('create_user_id'),
            createTimestamp: internalCommentResult.getTimestamp('create_timestamp')
        ]
    }
    if (!internalComments) return

    internalComments.each { comment ->
        if (!comment) return // Skip null comments

        try {
            // Insert the internal comment
            internalCommentStmt.setString(1, comment.credit_trade_comment ?: '')
            internalCommentStmt.setString(2, getAudienceScope(comment.role_names ?: ''))
            internalCommentStmt.setInt(3, comment.create_user_id ?: null)
            internalCommentStmt.setTimestamp(4, toSqlTimestamp(comment.create_timestamp ?: '2013-01-01T00:00:00Z'))

            def internalCommentId = null
            def commentResult = internalCommentStmt.executeQuery()
            if (commentResult.next()) {
                internalCommentId = commentResult.getInt('internal_comment_id')

                // Insert the transfer-comment relationship
                transferInternalCommentStmt.setInt(1, transferId)
                transferInternalCommentStmt.setInt(2, internalCommentId)
                transferInternalCommentStmt.executeUpdate()
            }

            commentResult.close()
        } catch (Exception e) {
            log.error("Error processing internal comment for transfer ${transferId}: ${e.getMessage()}", e)
        }
    }
                            }

// Helper function to determine audience scope based on role names
def getAudienceScope(String roleNames) {
    if (!roleNames) return 'Analyst'

    switch (true) {
        case roleNames.contains('GovDirector'):
            return 'Director'
        case roleNames.contains('GovComplianceManager'):
            return 'Compliance Manager'
        default:
            return 'Analyst'
    }
}

def insertTransfer(ResultSet rs, PreparedStatement transferStmt, PreparedStatement commentStmt, Long fromTransactionId,
                   Long toTransactionId, Map preparedData, Connection conn, String recommendationValue) {
    // Check for duplicates in the `transfer` table
    def transferId = rs.getInt('transfer_id')
    def duplicateCheckStmt = conn.prepareStatement('SELECT COUNT(*) FROM transfer WHERE transfer_id = ?')
    duplicateCheckStmt.setInt(1, transferId)
    def duplicateResult = duplicateCheckStmt.executeQuery()
    duplicateResult.next()
    def count = duplicateResult.getInt(1)
    duplicateResult.close()
    duplicateCheckStmt.close()

    if (count > 0) {
        log.warn("Duplicate transfer detected with transfer_id: ${transferId}, skipping insertion.")
        return null
    }
    // Fetch comments
    commentStmt.setInt(1, transferId)
    ResultSet commentResult = commentStmt.executeQuery()
    def comments = [
        fromOrgComment: null,
        toOrgComment: null,
        govComment: null
    ]
    if (commentResult.next()) {
        comments.fromOrgComment = commentResult.getString('from_org_comment')
        comments.toOrgComment = commentResult.getString('to_org_comment')
        comments.govComment = commentResult.getString('gov_comment')
    }

    // Proceed with insertion if no duplicate exists
    def categoryId = getTransferCategoryId(rs.getString('transfer_category'), preparedData)
    def statusId = getStatusId(rs.getString('current_status'), preparedData)
    transferStmt.setInt(1, rs.getInt('from_organization_id'))
    transferStmt.setInt(2, rs.getInt('to_organization_id'))
    transferStmt.setObject(3, fromTransactionId)
    transferStmt.setObject(4, toTransactionId)
    transferStmt.setTimestamp(5, rs.getTimestamp('agreement_date'))
    transferStmt.setTimestamp(6, rs.getTimestamp('transaction_effective_date'))
    transferStmt.setBigDecimal(7, rs.getBigDecimal('price_per_unit'))
    transferStmt.setInt(8, rs.getInt('quantity'))
    transferStmt.setString(9, comments.fromOrgComment)
    transferStmt.setString(10, comments.toOrgComment)
    transferStmt.setString(11, comments.govComment)
    transferStmt.setObject(12, categoryId)
    transferStmt.setObject(13, statusId)
    transferStmt.setString(14, recommendationValue)
    transferStmt.setTimestamp(15, rs.getTimestamp('create_date'))
    transferStmt.setTimestamp(16, rs.getTimestamp('update_date'))
    transferStmt.setInt(17, rs.getInt('create_user'))
    transferStmt.setInt(18, rs.getInt('update_user'))
    transferStmt.setInt(19, rs.getInt('transfer_id'))
    def result = transferStmt.executeQuery()
    return result.next() ? result.getInt('transfer_id') : null
}

log.warn("**** COMPLETED TRANSFER ETL ****")
