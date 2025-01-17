import groovy.json.JsonSlurper
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.time.OffsetDateTime
import java.sql.Timestamp

log.warn('**** STARTING TRANSFER ETL ****')

def SOURCE_QUERY = """
SELECT
        ct.id AS transfer_id,
        ct.initiator_id AS from_organization_id,
        ct.respondent_id AS to_organization_id,
        ct.date_of_written_agreement AS agreement_date,
        ct.trade_effective_date AS transaction_effective_date,
        ct.fair_market_value_per_credit AS price_per_unit,
        ctt.the_type as the_type,
        ct.number_of_credits AS quantity,
        ct.create_user_id as create_user,
        ct.update_user_id as update_user,
        ct.update_timestamp as update_date,
        ct.create_timestamp  as create_date,
        ctzr.description,
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
        LEFT JOIN credit_trade_zero_reason ctzr ON ctzr.id = ct.zero_reason_id
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
        ctt.the_type;
      """

def COMMENT_QUERY = '''
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


// Temporarily remove (drop) all audit triggers on listed tables
// so no audit_log entries occur during this data load.
def dropAuditTriggers = """
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT tablename
             FROM pg_tables
             WHERE schemaname = 'public'
               AND tablename IN (
                 'transaction', 'compliance_report', 'compliance_report_history',
                 'compliance_report_status', 'compliance_report_summary', 'compliance_period',
                 'initiative_agreement', 'initiative_agreement_status', 'initiative_agreement_history',
                 'allocation_agreement', 'allocation_transaction_type', 'custom_fuel_type', 'fuel_code',
                 'fuel_code_prefix', 'fuel_code_status', 'fuel_category', 'fuel_instance', 'fuel_type',
                 'fuel_export', 'organization', 'organization_address', 'organization_attorney_address',
                 'organization_status', 'organization_type', 'transfer', 'transfer_category', 'transfer_history',
                 'transfer_status', 'internal_comment', 'user_profile', 'user_role', 'role', 'notification_message',
                 'notification_type', 'admin_adjustment', 'admin_adjustment_status', 'admin_adjustment_history',
                 'provision_of_the_act', 'supplemental_report', 'final_supply_equipment', 'notional_transfer',
                 'fuel_supply', 'additional_carbon_intensity', 'document', 'end_use_type', 'energy_density',
                 'energy_effectiveness_ratio', 'transport_mode', 'final_supply_equipment', 'level_of_equipment',
                 'user_login_history', 'unit_of_measure', 'target_carbon_intensity'
               )
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS audit_%I_insert_update_delete ON %I;', r.tablename, r.tablename);
    END LOOP;
END;
\$\$;
"""

// Re-add the audit triggers to each table in the list
def reAddAuditTriggers = """
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT tablename
             FROM pg_tables
             WHERE schemaname = 'public'
               AND tablename IN (
                 'transaction', 'compliance_report', 'compliance_report_history',
                 'compliance_report_status', 'compliance_report_summary', 'compliance_period',
                 'initiative_agreement', 'initiative_agreement_status', 'initiative_agreement_history',
                 'allocation_agreement', 'allocation_transaction_type', 'custom_fuel_type', 'fuel_code',
                 'fuel_code_prefix', 'fuel_code_status', 'fuel_category', 'fuel_instance', 'fuel_type',
                 'fuel_export', 'organization', 'organization_address', 'organization_attorney_address',
                 'organization_status', 'organization_type', 'transfer', 'transfer_category', 'transfer_history',
                 'transfer_status', 'internal_comment', 'user_profile', 'user_role', 'role', 'notification_message',
                 'notification_type', 'admin_adjustment', 'admin_adjustment_status', 'admin_adjustment_history',
                 'provision_of_the_act', 'supplemental_report', 'final_supply_equipment', 'notional_transfer',
                 'fuel_supply', 'additional_carbon_intensity', 'document', 'end_use_type', 'energy_density',
                 'energy_effectiveness_ratio', 'transport_mode', 'final_supply_equipment', 'level_of_equipment',
                 'user_login_history', 'unit_of_measure', 'target_carbon_intensity'
               )
    LOOP
        EXECUTE format('
            CREATE TRIGGER audit_%I_insert_update_delete
            AFTER INSERT OR UPDATE OR DELETE ON %I
            FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();',
            r.tablename, r.tablename);
    END LOOP;
END;
\$\$;
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

    destinationConn.createStatement().execute(dropAuditTriggers)

    destinationConn.createStatement().execute('DROP FUNCTION IF EXISTS refresh_transaction_aggregate() CASCADE;')
    destinationConn.createStatement().execute('DROP FUNCTION IF EXISTS refresh_mv_transaction_count() CASCADE;')
    destinationConn.createStatement().execute('DROP FUNCTION IF EXISTS refresh_mv_director_review_transaction_count() CASCADE;')
    destinationConn.createStatement().execute('DROP FUNCTION IF EXISTS refresh_mv_org_compliance_report_count() CASCADE;')
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
    destinationConn.createStatement().execute("""
        CREATE OR REPLACE FUNCTION refresh_mv_director_review_transaction_count()
        RETURNS void AS \$\$
        BEGIN
            -- Temporarily disable the materialized view refresh
        END;
        \$\$ LANGUAGE plpgsql;
    """)
    destinationConn.createStatement().execute("""
        CREATE OR REPLACE FUNCTION refresh_mv_org_compliance_report_count()
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
                statements.transactionStmt, getUserNameStmt)

        def transferId = insertTransfer(resultSet, statements.transferStmt, commentStmt,
                fromTransactionId, toTransactionId, preparedData, destinationConn, recommendationValue, getUserNameStmt)

        if (transferId) {
            processHistory(transferId, creditTradeHistoryJson, statements.historyStmt, preparedData, getUserNameStmt)
            processInternalComments(transferId, internalCommentStmt, statements.internalCommentStmt,
                    getUserNameStmt, statements.transferInternalCommentStmt)
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
    destinationConn.createStatement().execute("""
        CREATE OR REPLACE FUNCTION refresh_mv_transaction_count()
        RETURNS void AS \$\$
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_count;
        END;
        \$\$ LANGUAGE plpgsql;
    """)
    destinationConn.createStatement().execute("""
        CREATE OR REPLACE FUNCTION refresh_mv_director_review_transaction_count()
        RETURNS void AS \$\$
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_director_review_transaction_count;
        END;
        \$\$ LANGUAGE plpgsql;
    """)
    destinationConn.createStatement().execute("""
        CREATE OR REPLACE FUNCTION refresh_mv_org_compliance_report_count()
        RETURNS void AS \$\$
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_org_compliance_report_count;
        END;
        \$\$ LANGUAGE plpgsql;
    """)
    destinationConn.createStatement().execute(reAddAuditTriggers)
    destinationConn.createStatement().execute('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_aggregate')
    destinationConn.createStatement().execute('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_director_review_transaction_count')
    destinationConn.createStatement().execute('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_org_compliance_report_count')

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
              internal_comment_id, comment, audience_scope, create_user, create_date, update_date
          ) VALUES (DEFAULT, ?, ?::audience_scope, ?, ?, ?)
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

def toSqlTimestamp(Object timestamp) {
    try {
        if (timestamp instanceof String) {
            def offsetDateTime = OffsetDateTime.parse(timestamp)
            return Timestamp.from(offsetDateTime.toInstant())
        } else if (timestamp instanceof java.sql.Timestamp) {
            return timestamp
        }
    } catch (Exception e) {
        log.error("Invalid timestamp format: ${timestamp}, defaulting to '1970-01-01T00:00:00Z'")
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
    def fromTransactionId = null
    def toTransactionId = null

    def transferType = rs.getString('the_type')
    def isBuy = (transferType == 'Buy')

    switch (currentStatus) {
        case ['Draft', 'Deleted', 'Refused', 'Declined', 'Rescinded']:
            break
        case ['Sent', 'Submitted', 'Recommended']:
            if (isBuy) {
                fromTransactionId = insertTransaction(stmt, rs, 'Reserved', rs.getInt('from_organization_id'), false, getUserNameStmt)
            } else {
                fromTransactionId = insertTransaction(stmt, rs, 'Reserved', rs.getInt('from_organization_id'), true, getUserNameStmt)
            }
            break
        case 'Recorded':
            if (isBuy) {
                fromTransactionId = insertTransaction(stmt, rs, 'Adjustment', rs.getInt('from_organization_id'), false, getUserNameStmt)
                toTransactionId   = insertTransaction(stmt, rs, 'Adjustment', rs.getInt('to_organization_id'), true, getUserNameStmt)
            } else {
                fromTransactionId = insertTransaction(stmt, rs, 'Adjustment', rs.getInt('from_organization_id'), true, getUserNameStmt)
                toTransactionId = insertTransaction(stmt, rs, 'Adjustment', rs.getInt('to_organization_id'), false, getUserNameStmt)
            }
            break
    }

    return [fromTransactionId, toTransactionId]
}

def insertTransaction(PreparedStatement stmt, ResultSet rs, String action, int orgId, boolean isDebit, PreparedStatement getUserNameStmt) {
    def quantity = rs.getInt('quantity')
    if (isDebit) {
        quantity *= -1 // Make the transaction negative for the sender
    }

    stmt.setInt(1, quantity)
    stmt.setInt(2, orgId)
    stmt.setString(3, action)
    stmt.setDate(4, rs.getDate('transaction_effective_date') ?: rs.getDate('agreement_date'))
    stmt.setString(5, getUserName(getUserNameStmt, rs.getInt('create_user')))
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

def processHistory(Integer transferId, List creditTradeHistory, PreparedStatement historyStmt, Map preparedData, PreparedStatement getUserNameStmt) {
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
                            PreparedStatement getUserNameStmt,
                            PreparedStatement transferInternalCommentStmt) {
    // Fetch internal comments
    sourceInternalCommentStmt.setInt(1, transferId)
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

def insertTransfer(ResultSet rs, PreparedStatement transferStmt, PreparedStatement commentStmt, Long fromTransactionId,
                   Long toTransactionId, Map preparedData, Connection conn, String recommendationValue, PreparedStatement getUserNameStmt) {
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
    transferStmt.setString(17, getUserName(getUserNameStmt, rs.getInt('create_user')))
    transferStmt.setString(18, getUserName(getUserNameStmt, rs.getInt('update_user')))
    transferStmt.setInt(19, rs.getInt('transfer_id'))
    def result = transferStmt.executeQuery()
    return result.next() ? result.getInt('transfer_id') : null
                   }

log.warn('**** COMPLETED TRANSFER ETL ****')
