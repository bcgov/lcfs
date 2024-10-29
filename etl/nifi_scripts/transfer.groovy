import org.apache.nifi.processor.io.StreamCallback
import org.apache.nifi.processor.exception.ProcessException
import groovy.json.JsonSlurper
import groovy.json.JsonBuilder
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.sql.SQLException
import groovy.sql.Sql

REL_SUCCESS = REL_SUCCESS
REL_FAILURE = REL_FAILURE

def flowFile = session.get()
if (!flowFile) return

try {
    // Get database connections from controller services
    log.info("Transfer data processing started")
    def sourceDbcpService = context.controllerServiceLookup.getControllerService("3245b078-0192-1000-ffff-ffffba20c1eb")
    def destinationDbcpService = context.controllerServiceLookup.getControllerService("3244bf63-0192-1000-ffff-ffffc8ec6d93")

    if (!sourceDbcpService || !destinationDbcpService) {
        log.error("Database connection services not found")
        session.transfer(flowFile, REL_FAILURE)
        return
    }
    final String INSERT_BATCH_SIZE = 100  // Configure batch size for inserts
    final int CACHE_SIZE_LIMIT = 100
    // SQL Queries
    final String SOURCE_QUERY = """
          WITH
        internal_comment AS (
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
          GROUP BY
            ctc.id,
            ctc.credit_trade_id,
            ctc.credit_trade_comment,
            ctc.create_user_id,
            ctc.create_timestamp
          ORDER BY
            ctc.credit_trade_id,
            ctc.create_timestamp
        )
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
        -- Aggregate comments from initiator's organization
        COALESCE(
          ctzr.description,
          STRING_AGG (DISTINCT from_ctc.credit_trade_comment, '; ')
        ) AS from_org_comment,
        -- Aggregate comments from respondent's organization
        STRING_AGG (DISTINCT to_ctc.credit_trade_comment, '; ') AS to_org_comment,
        -- Aggregate comments from government with internal comment handling
        STRING_AGG (DISTINCT gov_ctc.credit_trade_comment, '; ') AS gov_comment,
        -- JSON aggregation for internal comments
        json_agg (row_to_json (internal_comment)) AS internal_comments,
        -- JSON aggregation for credit trade history
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
        END AS current_status,
        CASE
          WHEN cts.status = 'Not Recommended' THEN 'Refuse'
          WHEN cts.status = 'Recommended' THEN 'Record'
          ELSE NULL
        END AS recommendation
      FROM
        credit_trade ct
        JOIN credit_trade_type ctt ON ct.type_id = ctt.id
        LEFT OUTER JOIN credit_trade_category ctc ON ct.trade_category_id = ctc.id
        JOIN credit_trade_status cts ON ct.status_id = cts.id
        LEFT JOIN credit_trade_zero_reason ctzr ON ctzr.id = ct.zero_reason_id
        AND ctzr.reason = 'Internal'
        -- Join for Initiator Comments
        LEFT JOIN credit_trade_comment from_ctc ON from_ctc.credit_trade_id = ct.id
        AND from_ctc.create_user_id IN (
          SELECT
            u.id
          FROM
            "user" u
          WHERE
            u.organization_id = ct.initiator_id
        )
        -- Join for Respondent Comments
        LEFT JOIN credit_trade_comment to_ctc ON to_ctc.credit_trade_id = ct.id
        AND to_ctc.create_user_id IN (
          SELECT
            u.id
          FROM
            "user" u
          WHERE
            u.organization_id = ct.respondent_id
        )
        -- Join for Government Comments
        LEFT JOIN credit_trade_comment gov_ctc ON gov_ctc.credit_trade_id = ct.id
        AND gov_ctc.create_user_id IN (
          SELECT
            u.id
          FROM
            "user" u
          WHERE
            u.organization_id = 1
            AND gov_ctc.is_privileged_access = FALSE
        )
        -- Join the internal comment logic for role-based filtering and audience_scope
        LEFT JOIN internal_comment ON internal_comment.credit_trade_id = ct.id
        -- Join for credit trade history
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
        cts.status,
        ctzr.description,
        internal_comment.role_names;
      """
    final String INSERT_TRANSFER_SQL = '''
          INSERT INTO transfer (
              transfer_id, from_organization_id, to_organization_id, from_transaction_id, to_transaction_id, agreement_date, transaction_effective_date, price_per_unit, quantity, from_org_comment, to_org_comment, gov_comment, transfer_category_id, current_status_id, recommendation, current_date, update_date, create_user, udpate_user
          ) VALUES (DEFAULT, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING transfer_id
      '''
    final String INSERT_TRANSFER_HISTORY_SQL = '''
          INSERT INTO transfer_history (
              transfer_history_id, transfer_id, transfer_status_id, user_profile_id, create_date
          ) VALUES (DEFAULT, ?, ?, ?, ?)
      '''
    final String INSERT_INTERNAL_COMMENT_SQL = '''
          INSERT INTO internal_comment (
              internal_comment_id, comment, audience_scope, create_user, create_date
          ) VALUES (DEFAULT, ?, ?::audience_scope, ?, ?)
          RETURNING internal_comment_id
      '''
    final String INSERT_TRANSFER_INTERNAL_COMMENT_SQL = '''
          INSERT INTO transfer_internal_comment (
              transfer_id, internal_comment_id
          ) VALUES (?, ?)
      '''
    final String INSERT_TRANSACTION_SQL = ''''
          INSERT INTO transaction (
              transaction_id, compliance_units, organization_id, transaction_action, effective_date, create_user, create_date
          ) VALUES (DEFAULT, ?, ?, ?::transaction_action_enum, ?, ?, ?)
          RETURNING transaction_id
      '''
    final String GET_CATEGORY_ID_QUERY = "SELECT transfer_category_id FROM transfer_category WHERE category = ?::transfercategoryenum"
    final String GET_STATUS_ID_QUERY = "SELECT transfer_status_id FROM transfer_status WHERE status = ?::transfer_type_enum"

    // Track processing metrics
    def processingMetrics = [
            recordsProcessed   : 0,
            successfulTransfers: 0,
            failedTransfers    : 0,
            startTime          : System.currentTimeMillis()
    ]

    Connection sourceConn = null
    Connection destinationConn = null

    try {
        sourceConn = sourceDbcpService.getConnection()
        destinationConn = destinationDbcpService.getConnection()

        // Disable auto-commit for batch processing
        destinationConn.setAutoCommit(false)

        // Prepare all statements
        def statements = prepareStatements(destinationConn)

        // Process records
        PreparedStatement sourceStmt = sourceConn.prepareStatement(SOURCE_QUERY)
        ResultSet resultSet = sourceStmt.executeQuery()

        while (resultSet.next()) {
            try {
                processRecord(resultSet, statements, processingMetrics)
                processingMetrics.recordsProcessed++

                // Commit every INSERT_BATCH_SIZE records
                if (processingMetrics.recordsProcessed % INSERT_BATCH_SIZE == 0) {
                    destinationConn.commit()
                }
                session.transfer(flowFile, REL_SUCCESS)
            } catch (Exception e) {
                log.error("Error processing record: ${e.getMessage()}", e)
                processingMetrics.failedTransfers++
                session.transfer(flowFile, REL_FAILURE)
            }
        }

        // Final commit
        destinationConn.commit()

        // Update flowfile attributes with metrics
        def attributes = [
                'transfer.records.processed' : String.valueOf(processingMetrics.recordsProcessed),
                'transfer.records.successful': String.valueOf(processingMetrics.successfulTransfers),
                'transfer.records.failed'    : String.valueOf(processingMetrics.failedTransfers),
                'transfer.processing.time'   : String.valueOf(System.currentTimeMillis() - processingMetrics.startTime)
        ]

        flowFile = session.putAllAttributes(flowFile, attributes)

        // Transfer flowfile to success if any records were processed successfully
        if (processingMetrics.successfulTransfers > 0) {
            session.transfer(flowFile, REL_SUCCESS)
        } else {
            session.transfer(flowFile, REL_FAILURE)
        }
        session.transfer(flowFile, REL_SUCCESS)
    } catch (Exception e) {
        // Rollback on error
        if (destinationConn != null) {
            try {
                destinationConn.rollback()
            } catch (SQLException se) {
                log.error("Error rolling back transaction", se)
            }
        }
        session.transfer(flowFile, REL_FAILURE)
        throw new ProcessException("Failed to process transfers: ${e.getMessage()}", e)
    } finally {
        // Close connections
        [sourceConn, destinationConn].each { conn ->
            if (conn != null) {
                try {
                    conn.close()
                } catch (SQLException e) {
                    log.warn("Error closing database connection", e)
                }
            }
        }
    }

} catch (Exception e) {
    log.error("Processing failed: ${e.getMessage()}", e)
    session.transfer(flowFile, REL_FAILURE)
}

def prepareStatements(Connection conn) {
    return [
            categoryStmt               : conn.prepareStatement(GET_CATEGORY_ID_QUERY),
            statusStmt                 : conn.prepareStatement(GET_STATUS_ID_QUERY),
            transferStmt               : conn.prepareStatement(INSERT_TRANSFER_SQL),
            historyStmt                : conn.prepareStatement(INSERT_TRANSFER_HISTORY_SQL),
            internalCommentStmt        : conn.prepareStatement(INSERT_INTERNAL_COMMENT_SQL),
            transferInternalCommentStmt: conn.prepareStatement(INSERT_TRANSFER_INTERNAL_COMMENT_SQL),
            transactionStmt            : conn.prepareStatement(INSERT_TRANSACTION_SQL)
    ]
}

def processRecord(ResultSet resultSet, Map statements, Map metrics) {
    def currentStatus = resultSet.getString("current_status")
    def statusId = getStatusId(currentStatus)
    def transferCategory = resultSet.getString("transfer_category")
    def categoryId = getCategoryId(transferCategory, statements.categoryStmt)

    // Process transactions based on status
    def (fromTransactionId, toTransactionId) = processTransactions(
            currentStatus,
            resultSet,
            statements.transactionStmt
    )

    // Insert transfer
    def transferId = insertTransfer(resultSet, statements.transferStmt, fromTransactionId, toTransactionId, categoryId, statusId)

    // Process history and comments
    if (transferId) {
        processHistory(transferId, resultSet, statements.historyStmt)
        processInternalComments(transferId, resultSet, statements.internalCommentStmt,
                statements.transferInternalCommentStmt)
        metrics.successfulTransfers++
    }
}

def processTransactions(String currentStatus, ResultSet rs, PreparedStatement stmt) {
    def fromTransactionId = null
    def toTransactionId = null

    switch (currentStatus) {
        case ['Draft', 'Deleted', 'Refused', 'Declined', 'Rescinded']:
            break
        case ['Sent', 'Submitted', 'Recommended']:
            fromTransactionId = insertTransaction(stmt, rs, "Reserved", rs.getInt("from_organization_id"))
            break
        case 'Recorded':
            fromTransactionId = insertTransaction(stmt, rs, "Adjustment", rs.getInt("from_organization_id"))
            toTransactionId = insertTransaction(stmt, rs, "Adjustment", rs.getInt("to_organization_id"))
            break
    }

    return [fromTransactionId, toTransactionId]
}

def insertTransaction(PreparedStatement stmt, ResultSet rs, String action, int orgId) {
    stmt.setInt(1, rs.getInt("quantity"))
    stmt.setInt(2, orgId)
    stmt.setString(3, action)
    stmt.setDate(4, rs.getDate("transaction_effective_date") ?: rs.getDate("agreement_date"))
    stmt.setInt(5, rs.getInt("create_user"))
    stmt.setTimestamp(6, rs.getTimestamp("create_date"))

    def result = stmt.executeQuery()
    return result.next() ? result.getInt("transaction_id") : null
}

def processHistory(Long transferId, ResultSet rs, PreparedStatement historyStmt) {
    def creditTradeHistory = rs.getArray("credit_trade_history")?.array
    if (!creditTradeHistory) return

    creditTradeHistory.each { historyItem ->
        try {
            historyStmt.setInt(1, transferId)
            historyStmt.setInt(2, getStatusId(historyItem.transfer_status))
            historyStmt.setInt(3, historyItem.user_profile_id)
            historyStmt.setTimestamp(4, new java.sql.Timestamp(historyItem.create_timestamp.time))
            historyStmt.addBatch()
        } catch (Exception e) {
            log.error("Error processing history record for transfer ${transferId}: ${e.getMessage()}", e)
        }
    }

    // Execute batch
    try {
        historyStmt.executeBatch()
    } catch (SQLException e) {
        log.error("Error executing history batch for transfer ${transferId}: ${e.getMessage()}", e)
        throw e
    }
}

def processInternalComments(Long transferId, ResultSet rs,
                            PreparedStatement internalCommentStmt,
                            PreparedStatement transferInternalCommentStmt) {
    def internalComments = rs.getArray("internal_comments")?.array
    if (!internalComments) return

    // Use Set to track processed IDs and avoid duplicates
    def processedIds = new HashSet<Integer>()

    internalComments.each { comment ->
        // Skip if we've already processed this comment
        if (!processedIds.add(comment.credit_trade_id)) return

        try {
            // Insert the internal comment
            internalCommentStmt.setString(1, comment.credit_trade_comment)
            internalCommentStmt.setString(2, getAudienceScope(comment.role_names))
            internalCommentStmt.setInt(3, comment.create_user_id)
            internalCommentStmt.setTimestamp(4,
                    new java.sql.Timestamp(comment.create_timestamp.time))

            def internalCommentId = null
            def commentResult = internalCommentStmt.executeQuery()
            if (commentResult.next()) {
                internalCommentId = commentResult.getInt("internal_comment_id")

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

// Helper function to get status ID
def statusIdCache = [:]

def getStatusId(String status) {
    // Check cache first
    if (statusIdCache.containsKey(status)) {
        return statusIdCache[status]
    }

    // If not in cache, fetch from database
    def statusId = null
    try {
        def stmt = destinationConn.prepareStatement(GET_STATUS_ID_QUERY)
        stmt.setString(1, status)
        def rs = stmt.executeQuery()
        if (rs.next()) {
            statusId = rs.getInt("transfer_status_id")
            statusIdCache[status] = statusId  // Cache the result
        }
        rs.close()
        stmt.close()
    } catch (Exception e) {
        log.error("Error fetching status ID for status ${status}: ${e.getMessage()}", e)
        throw e
    }

    return statusId
}

// Helper function to get category ID
def categoryIdCache = Collections.synchronizedMap(new LinkedHashMap<String, Integer>(CACHE_SIZE_LIMIT + 1, .75F, true) {
    protected boolean removeEldestEntry(Map.Entry<String, Integer> eldest) {
        return size() > CACHE_SIZE_LIMIT
    }
})

def getCategoryId(String category, PreparedStatement categoryStmt) {
    if (category == null) return null

    try {
        // Check cache first
        def cachedId = categoryIdCache.get(category)
        if (cachedId != null) {
            return cachedId
        }

        // If not in cache, fetch from database
        categoryStmt.setString(1, category)
        def rs = null
        try {
            rs = categoryStmt.executeQuery()
            if (rs.next()) {
                def categoryId = rs.getInt("transfer_category_id")
                categoryIdCache.put(category, categoryId)
                return categoryId
            } else {
                log.warn("No category ID found for category: ${category}")
                return null
            }
        } finally {
            rs?.close()
        }
    } catch (SQLException e) {
        log.error("Error fetching category ID for category ${category}: ${e.getMessage()}", e)
        throw new ProcessException("Failed to fetch category ID", e)
    } catch (Exception e) {
        log.error("Unexpected error fetching category ID for category ${category}: ${e.getMessage()}", e)
        throw new ProcessException("Unexpected error fetching category ID", e)
    }
}

def insertTransfer(ResultSet rs, PreparedStatement transferStmt,
                   Long fromTransactionId, Long toTransactionId, Integer categoryId, Integer statusId) {
    try {
        transferStmt.setInt(1, rs.getInt("from_organization_id"))
        transferStmt.setInt(2, rs.getInt("to_organization_id"))
        transferStmt.setObject(3, fromTransactionId)
        transferStmt.setObject(4, toTransactionId)
        transferStmt.setTimestamp(5, rs.getTimestamp("agreement_date"))
        transferStmt.setTimestamp(6, rs.getTimestamp("transaction_effective_date"))
        transferStmt.setBigDecimal(7, rs.getBigDecimal("price_per_unit"))
        transferStmt.setInt(8, rs.getInt("quantity"))
        transferStmt.setString(9, rs.getString("from_org_comment"))
        transferStmt.setString(10, rs.getString("to_org_comment"))
        transferStmt.setString(11, rs.getString("gov_comment"))
        transferStmt.setObject(12, categoryId)
        transferStmt.setObject(13, statusId)
        transferStmt.setString(14, rs.getString("recommendation"))
        transferStmt.setTimestamp(15, rs.getTimestamp("create_date"))
        transferStmt.setTimestamp(16, rs.getTimestamp("update_date"))
        transferStmt.setInt(17, rs.getInt("create_user"))
        transferStmt.setInt(18, rs.getInt("update_user"))

        def result = transferStmt.executeQuery()
        return result.next() ? result.getInt("transfer_id") : null
    } catch (SQLException e) {
        log.error("Error inserting transfer: ${e.getMessage()}", e)
        throw new ProcessException("Failed to insert transfer", e)
    }
}