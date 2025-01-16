import groovy.json.JsonSlurper
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.time.OffsetDateTime
import java.sql.Timestamp

log.warn("**** STARTING INITIATIVE AGREEMENT ETL ****")

def SOURCE_QUERY = """
      SELECT
        ct.id AS initiative_agreement_id,
        ct.respondent_id AS to_organization_id,
        ct.date_of_written_agreement AS agreement_date,
        ct.trade_effective_date AS transaction_effective_date,
        ct.number_of_credits AS compliance_units,
        ct.create_user_id as create_user,
        ct.update_user_id as update_user,
        ct.update_timestamp as update_date,
        ct.create_timestamp  as create_date,
        -- JSON aggregation for credit trade history
        json_agg (
          json_build_object (
            'initiative_agreement_id',
            cth.credit_trade_id,
            'initiative_agreement_status',
            case
              WHEN cts_history.status IN ('Cancelled', 'Not Recommended', 'Declined', 'Refused') or ct.is_rescinded = true THEN 'Deleted'
              WHEN cts_history.status IN ('Accepted', 'Submitted', 'Recommended') THEN 'Recommended'
              WHEN cts_history.status IN ('Approved', 'Recorded') THEN 'Approved'
              ELSE 'Draft'
            END,
            'user_profile_id',
            cth.create_user_id,
            'create_timestamp',
            cth.create_timestamp
          )
        ) AS credit_trade_history,
        case
          WHEN cts.status IN ('Cancelled', 'Not Recommended', 'Declined', 'Refused') or ct.is_rescinded = true THEN 'Deleted'
          WHEN cts.status IN ('Accepted', 'Submitted', 'Recommended') THEN 'Recommended'
          WHEN cts.status IN ('Approved', 'Recorded') THEN 'Approved'
          ELSE 'Draft'
        END AS current_status, cts.status
      FROM
        credit_trade ct
        JOIN credit_trade_type ctt ON ct.type_id = ctt.id
        LEFT OUTER JOIN credit_trade_category ctc ON ct.trade_category_id = ctc.id
        JOIN credit_trade_status cts ON ct.status_id = cts.id
        -- Join for credit trade history
        LEFT JOIN credit_trade_history cth ON cth.credit_trade_id = ct.id
        JOIN credit_trade_status cts_history ON cth.status_id = cts_history.id
      WHERE
        ctt.the_type IN ('Part 3 Award')
      GROUP BY
        ct.id,
        ct.respondent_id,
        ct.date_of_written_agreement,
        ct.trade_effective_date,
        ct.number_of_credits,
        cts.status;
      """
def COMMENT_QUERY = '''
    SELECT
        ct.id AS credit_trade_id,
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
'''

def INTERNAL_COMMENT_QUERY = """
    SELECT
        ctc.id,
        ctc.credit_trade_id,
        ctc.credit_trade_comment,
        ctc.create_user_id,
        ctc.create_timestamp,
        ctc.update_timestamp,
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

def USER_ID_QUERY = 'select keycloak_username from user_profile up where user_profile_id = ? limit 1'

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
    destinationConn.createStatement().execute('DROP FUNCTION IF EXISTS refresh_mv_transaction_count() CASCADE;')
    destinationConn.createStatement().execute("""
        CREATE OR REPLACE FUNCTION refresh_transaction_aggregate()
        RETURNS void AS \$\$
        BEGIN
            -- Temporarily disable the materialized view refresh
        END;
        \$\$ LANGUAGE plpgsql;
    """)
    destinationConn.createStatement().execute("""
        CREATE OR REPLACE FUNCTION refresh_mv_transaction_count()
        RETURNS void AS \$\$
        BEGIN
            -- Temporarily disable the materialized view refresh
        END;
        \$\$ LANGUAGE plpgsql;
    """)

    PreparedStatement sourceStmt = sourceConn.prepareStatement(SOURCE_QUERY)
    PreparedStatement commentStmt = sourceConn.prepareStatement(COMMENT_QUERY)
    PreparedStatement internalCommentStmt = sourceConn.prepareStatement(INTERNAL_COMMENT_QUERY)
    PreparedStatement getUserNameStmt = destinationConn.prepareStatement(USER_ID_QUERY)
    ResultSet resultSet = sourceStmt.executeQuery()

    int recordCount = 0

    while (resultSet.next()) {
        recordCount++
        def jsonSlurper = new JsonSlurper()
        def creditTradeHistory = resultSet.getString('credit_trade_history')
        def creditTradeHistoryJson = creditTradeHistory ? jsonSlurper.parseText(creditTradeHistory) : []

        def toTransactionId = processTransactions(resultSet.getString('current_status'),
                resultSet, statements.transactionStmt, getUserNameStmt)

        def initiativeAgreementId = insertInitiativeAgreement(resultSet, statements.initiativeAgreementStmt,
                toTransactionId, preparedData, destinationConn, getUserNameStmt, commentStmt)

        if (initiativeAgreementId) {
            processHistory(initiativeAgreementId, creditTradeHistoryJson, statements.historyStmt, preparedData)
            processInternalComments(initiativeAgreementId, internalCommentStmt, statements.internalCommentStmt,
                    getUserNameStmt, statements.initiativeAgreementInternalCommentStmt)
        } else {
            log.warn("initiative-agreement not inserted for record: ${resultSet.getInt('initiative_agreement_id')}")
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
    destinationConn.createStatement().execute("""
        CREATE OR REPLACE FUNCTION refresh_mv_transaction_count()
        RETURNS void AS \$\$
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_count;
        END;
        \$\$ LANGUAGE plpgsql;
    """)
    destinationConn.createStatement().execute('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_aggregate')
    destinationConn.createStatement().execute('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_count')

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
    def statusMap = loadTableData(conn,
        'SELECT DISTINCT status, MIN(initiative_agreement_status_id) AS initiative_agreement_status_id FROM initiative_agreement_status GROUP BY status',
        'status',
        'initiative_agreement_status_id'
    )
    return [
            statusMap  : statusMap
    ]
}

def getStatusId(String status, Map preparedData) {
    return preparedData.statusMap[status]
}

def prepareStatements(Connection conn) {
    def INSERT_INITIATIVE_AGREEMENT_SQL = '''
          INSERT INTO initiative_agreement (
              to_organization_id, transaction_id, transaction_effective_date, compliance_units, gov_comment,
              current_status_id, create_date, update_date, create_user, update_user, effective_status,
              initiative_agreement_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true, ?)
          RETURNING initiative_agreement_id
      '''
    def INSERT_INITIATIVE_AGREEMENT_HISTORY_SQL = '''
          INSERT INTO initiative_agreement_history (
              initiative_agreement_history_id, initiative_agreement_id, initiative_agreement_status_id, user_profile_id, create_date, effective_status
          ) VALUES (DEFAULT, ?, ?, ?, ?, true)
      '''
    def INSERT_INTERNAL_COMMENT_SQL = '''
          INSERT INTO internal_comment (
              internal_comment_id, comment, audience_scope, create_user, create_date, update_date
          ) VALUES (DEFAULT, ?, ?::audience_scope, ?, ?, ?)
          RETURNING internal_comment_id
      '''
    def INSERT_INITIATIVE_AGREEMENT_INTERNAL_COMMENT_SQL = '''
          INSERT INTO initiative_agreement_internal_comment (
              initiative_agreement_id, internal_comment_id
          ) VALUES (?, ?)
      '''
    def INSERT_TRANSACTION_SQL = '''
          INSERT INTO transaction (
              transaction_id, compliance_units, organization_id, transaction_action, effective_date, create_user, create_date, effective_status
          ) VALUES (DEFAULT, ?, ?, ?::transaction_action_enum, ?, ?, ?, true)
          RETURNING transaction_id
      '''
    return [initiativeAgreementStmt    : conn.prepareStatement(INSERT_INITIATIVE_AGREEMENT_SQL),
            historyStmt                : conn.prepareStatement(INSERT_INITIATIVE_AGREEMENT_HISTORY_SQL),
            internalCommentStmt        : conn.prepareStatement(INSERT_INTERNAL_COMMENT_SQL),
            initiativeAgreementInternalCommentStmt
                    : conn.prepareStatement(INSERT_INITIATIVE_AGREEMENT_INTERNAL_COMMENT_SQL),
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

def getUserName(PreparedStatement stmt, int userId) {
    ResultSet rs = null
    String userName = null

    try {
        stmt.setInt(1, userId)
        rs = stmt.executeQuery()

        if (rs.next()) {
            userName = rs.getString('keycloak_username')
        } else {
            log.warn("No username found for user_id: ${userId}")
        }
    } catch (Exception e) {
        log.error("Error while fetching username for user_id: ${userId}", e)
    } finally {
        if (rs != null) rs.close()
    }

    return userName
}

def processTransactions(String currentStatus, ResultSet rs, PreparedStatement stmt, PreparedStatement getUserNameStmt) {
    def toTransactionId = null

    if (currentStatus == 'Approved') {
      toTransactionId = insertTransaction(stmt, rs, 'Adjustment', rs.getInt('to_organization_id'), getUserNameStmt)
    }

    return toTransactionId
}

def insertTransaction(PreparedStatement stmt, ResultSet rs, String action, int orgId, PreparedStatement getUserNameStmt) {
    stmt.setInt(1, rs.getInt('compliance_units'))
    stmt.setInt(2, orgId)
    stmt.setString(3, action)
    stmt.setDate(4, rs.getDate('transaction_effective_date') ?: rs.getDate('agreement_date'))
    stmt.setString(5, getUserName(getUserNameStmt, rs.getInt('create_user')))
    stmt.setTimestamp(6, rs.getTimestamp('create_date'))

    def result = stmt.executeQuery()
    return result.next() ? result.getInt('transaction_id') : null
}

def processHistory(Integer initiativeAgreementId, List creditTradeHistory, PreparedStatement historyStmt, Map preparedData) {
    if (!creditTradeHistory) return

    // Use a Set to track unique combinations of initiative_agreement_id and initiative_agreement_status
    def processedEntries = new HashSet<String>()

    creditTradeHistory.each { historyItem ->
        try {
            def statusId = getStatusId(historyItem.initiative_agreement_status, preparedData)
            def uniqueKey = "${initiativeAgreementId}_${statusId}"

            // Check if this combination has already been processed
            if (!processedEntries.contains(uniqueKey)) {
                // If not processed, add to batch and mark as processed
                historyStmt.setInt(1, initiativeAgreementId)
                historyStmt.setInt(2, statusId)
                historyStmt.setInt(3, historyItem.user_profile_id)
                historyStmt.setTimestamp(4, toSqlTimestamp(historyItem.create_timestamp ?: '2013-01-01T00:00:00Z'))
                historyStmt.addBatch()

                processedEntries.add(uniqueKey)
            }
        } catch (Exception e) {
            log.error("Error processing history record for initiative_agreement_id: ${initiativeAgreementId}", e)
        }
    }

    // Execute batch
    historyStmt.executeBatch()
}


def processInternalComments(Integer initiativeAgreementId, PreparedStatement sourceInternalCommentStmt,
                            PreparedStatement internalCommentStmt,
                            PreparedStatement getUserNameStmt,
                            PreparedStatement initiativeAgreementInternalCommentStmt) {
    // Fetch internal comments
    sourceInternalCommentStmt.setInt(1, initiativeAgreementId)
    ResultSet internalCommentResult = sourceInternalCommentStmt.executeQuery()
    while (internalCommentResult.next()) {
        try {
            // Insert the internal comment
            internalCommentStmt.setString(1, internalCommentResult.getString('credit_trade_comment') ?: '')
            internalCommentStmt.setString(2, getAudienceScope(internalCommentResult.getString('role_names') ?: ''))
            internalCommentStmt.setString(3,
                getUserName(getUserNameStmt, internalCommentResult.getInt('create_user_id') ?: null))
            internalCommentStmt.setTimestamp(4,
                internalCommentResult.getTimestamp('create_timestamp') ?: null)
            internalCommentStmt.setTimestamp(5,
                internalCommentResult.getTimestamp('update_timestamp') ?: null)

            def internalCommentId = null
            def commentResult = internalCommentStmt.executeQuery()
            if (commentResult.next()) {
                internalCommentId = commentResult.getInt('internal_comment_id')

                // Insert the initiative-agreement-comment relationship
                initiativeAgreementInternalCommentStmt.setInt(1, initiativeAgreementId)
                initiativeAgreementInternalCommentStmt.setInt(2, internalCommentId)
                initiativeAgreementInternalCommentStmt.executeUpdate()
            }

            commentResult.close()
        } catch (Exception e) {
            log.error("Error processing internal comment for initiative-agreement ${initiativeAgreementId}: ${e.getMessage()}", e)
        }
    }
    internalCommentResult.close()
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

def insertInitiativeAgreement(ResultSet rs, PreparedStatement initiativeAgreementStmt,
                   Long toTransactionId, Map preparedData, Connection conn, PreparedStatement getUserNameStmt, PreparedStatement commentStmt) {
    // Check for duplicates in the `initiative_agreement` table
    def initiativeAgreementId = rs.getInt('initiative_agreement_id')
    def duplicateCheckStmt = conn.prepareStatement('SELECT COUNT(*) FROM initiative_agreement WHERE initiative_agreement_id = ?')
    duplicateCheckStmt.setInt(1, initiativeAgreementId)
    def duplicateResult = duplicateCheckStmt.executeQuery()
    duplicateResult.next()
    def count = duplicateResult.getInt(1)
    duplicateResult.close()
    duplicateCheckStmt.close()

    if (count > 0) {
        log.warn("Duplicate initiative_agreement detected with initiative_agreement_id: ${initiativeAgreementId}, skipping insertion.")
        return null
    }
    // Fetch comments
    commentStmt.setInt(1, initiativeAgreementId)
    ResultSet commentResult = commentStmt.executeQuery()
    def govComment = null
    if (commentResult.next()) {
        govComment = commentResult.getString('gov_comment')
    }
    // Proceed with insertion if no duplicate exists
    def statusId = getStatusId(rs.getString('current_status'), preparedData)
    initiativeAgreementStmt.setInt(1, rs.getInt('to_organization_id'))
    initiativeAgreementStmt.setObject(2, toTransactionId)
    initiativeAgreementStmt.setTimestamp(3, rs.getTimestamp('transaction_effective_date'))
    initiativeAgreementStmt.setInt(4, rs.getInt('compliance_units'))
    initiativeAgreementStmt.setString(5, govComment)
    initiativeAgreementStmt.setObject(6, statusId)
    initiativeAgreementStmt.setTimestamp(7, rs.getTimestamp('create_date'))
    initiativeAgreementStmt.setTimestamp(8, rs.getTimestamp('update_date'))
    initiativeAgreementStmt.setInt(9, rs.getInt('create_user'))
    initiativeAgreementStmt.setInt(10, rs.getInt('update_user'))
    initiativeAgreementStmt.setInt(11, rs.getInt('initiative_agreement_id'))
    def result = initiativeAgreementStmt.executeQuery()
    return result.next() ? result.getInt('initiative_agreement_id') : null
}

log.warn("**** COMPLETED INITIATIVE AGREEMENT ETL ****")
