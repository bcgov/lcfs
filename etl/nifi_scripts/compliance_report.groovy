import groovy.json.JsonSlurper
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.time.OffsetDateTime
import java.sql.Timestamp
import java.util.UUID

/*
This script migrates compliance reports and their supplemental versions from TFRS
to LCFS, including compliance report history and associated transactions.

Process:
1. Extract compliance reports from TFRS.
2. Identify chains of reports (root and supplements), assign a compliance_report_group_uuid, and version the chain.
3. Map TFRS workflow states to LCFS compliance_report_status.
4. Insert LCFS compliance_report records.
5. Migrate compliance_report_history records and map their statuses.
6. For each compliance report that reaches a "Submitted" or above state, create a corresponding "In reserve" transaction in LCFS.
7. If a TFRS compliance report references a credit_transaction that is one of "Credit Validation", "Part 3 Award",
   "Credit Reduction", or "Administrative Adjustment" and "Approved", insert a corresponding LCFS transaction.
8. Update the compliance_report.transaction_id column in LCFS if a transaction is created for that report.
*/

// =========================================
// Queries
// =========================================

// Fetch compliance reports with workflow states
SOURCE_REPORTS_QUERY = """
    WITH cr_chain AS (
        SELECT
            cr.id AS compliance_report_id,
            cr.type_id,
            cr.organization_id,
            cr.compliance_period_id,
            cr.supplements_id,
            cr.root_report_id,
            cr.latest_report_id,
            cr.traversal,
            cr.nickname,
            cr.supplemental_note,
            cws.fuel_supplier_status_id,
            cws.analyst_status_id,
            cws.manager_status_id,
            cws.director_status_id,
            cr.create_user_id,
            cr.create_timestamp,
            cr.update_user_id,
            cr.update_timestamp,
            crt.the_type AS report_type,
            cp.description AS compliance_period_desc,
            CASE WHEN cr.supplements_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_supplemental,
            cr.credit_transaction_id
        FROM compliance_report cr
        JOIN compliance_report_type crt ON cr.type_id = crt.id
        JOIN compliance_period cp ON cp.id = cr.compliance_period_id
        JOIN compliance_report_workflow_state cws ON cr.status_id = cws.id
    )
    SELECT * FROM cr_chain
    ORDER BY root_report_id NULLS FIRST, traversal, compliance_report_id;
"""

// Fetch compliance report history
SOURCE_HISTORY_QUERY = """
    SELECT
        crh.id AS history_id,
        crh.compliance_report_id,
        crh.create_user_id,
        crh.create_timestamp,
        hws.fuel_supplier_status_id,
        hws.analyst_status_id,
        hws.manager_status_id,
        hws.director_status_id
    FROM compliance_report_history crh
    JOIN compliance_report_workflow_state hws ON crh.status_id = hws.id
    ORDER BY crh.compliance_report_id, crh.create_timestamp;
"""

// Fetch associated credit trades (validations/reductions/etc.)
SOURCE_CREDIT_TRADE_QUERY = """
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
        ct.fair_market_value_per_credit AS price_per_unit,
        ct.id AS credit_trade_id
    FROM
        credit_trade ct
        JOIN credit_trade_type ctt ON ct.type_id = ctt.id
        JOIN credit_trade_status cts ON ct.status_id = cts.id
    WHERE
        ctt.the_type IN ('Credit Validation', 'Part 3 Award', 'Credit Reduction', 'Administrative Adjustment')
        AND cts.status = 'Approved';
"""

// =========================================
// NiFi Controller Services
// =========================================
def sourceDbcpService = context.controllerServiceLookup.getControllerService('3245b078-0192-1000-ffff-ffffba20c1eb')
def destinationDbcpService = context.controllerServiceLookup.getControllerService('3244bf63-0192-1000-ffff-ffffc8ec6d93')

// =========================================
// Main Execution
// =========================================

Connection sourceConn = null
Connection destinationConn = null

try {
    sourceConn = sourceDbcpService.getConnection()
    destinationConn = destinationDbcpService.getConnection()
    destinationConn.setAutoCommit(false)

    // Disable refresh of the materialized view
    destinationConn.createStatement().execute('DROP FUNCTION IF EXISTS refresh_transaction_aggregate() CASCADE;')
    destinationConn.createStatement().execute("""
        CREATE OR REPLACE FUNCTION refresh_transaction_aggregate()
        RETURNS void AS \$\$
        BEGIN
            -- Temporarily disable the materialized view refresh
        END;
        \$\$ LANGUAGE plpgsql;
    """)

    // Disable the refresh function
  destinationConn.createStatement().execute('DROP FUNCTION IF EXISTS refresh_mv_director_review_transaction_count() CASCADE;')
  destinationConn.createStatement().execute("""
      CREATE OR REPLACE FUNCTION refresh_mv_director_review_transaction_count()
      RETURNS void AS \$\$
      BEGIN
          -- Temporarily disable the materialized view refresh
      END;
      \$\$ LANGUAGE plpgsql;
  """)

    def referenceData = loadReferenceData(destinationConn)

    // Fetch compliance reports and chains
    def chains = fetchComplianceReports(sourceConn)

    // Fetch compliance report history
    def historyMap = fetchComplianceReportHistory(sourceConn)

    // Fetch associated credit trades
    def creditTradesMap = fetchApprovedCreditTrades(sourceConn)

    // Prepare statements
    def statements = prepareStatements(destinationConn)

    int totalInserted = 0
    int totalHistoryInserted = 0
    int totalTransactionsInserted = 0

    chains.each { rootId, chainReports ->
        chainReports.sort { a, b ->
            a.traversal <=> b.traversal ?: a.compliance_report_id <=> b.compliance_report_id
        }

        // Assign a single UUID for the chain
        def groupUuid = UUID.randomUUID().toString()

        def version = 0
        chainReports.each { report ->
            def currentStatusId = mapCurrentStatus(
                report.fuel_supplier_status_id,
                report.analyst_status_id,
                report.manager_status_id,
                report.director_status_id,
                referenceData
            )

            def supplementalInitiator = report.is_supplemental ? "SUPPLIER_SUPPLEMENTAL" : null
            def reportingFrequency = "ANNUAL"

            // create_user and update_user are always strings
            def reportCreateUser = "imported_user"
            def reportUpdateUser = "imported_user"

            // Insert Compliance Report
            def lcfsReportId = insertComplianceReport(
                statements.insertComplianceReportStmt,
                report,
                groupUuid,
                version,
                supplementalInitiator,
                reportingFrequency,
                currentStatusId,
                reportCreateUser,
                reportUpdateUser
            )

            // Insert history
            def reportHistory = historyMap[report.compliance_report_id] ?: []
            totalHistoryInserted += insertComplianceReportHistory(
                lcfsReportId,
                reportHistory,
                statements.insertComplianceReportHistoryStmt,
                referenceData
            )

            def currentStatusName = currentStatusId ? referenceData.statusIdToName[currentStatusId] : null
            def shouldReserve = ["Submitted", "Recommended by analyst", "Recommended by manager", "Assessed", "ReAssessed"].contains(currentStatusName)
            def createdTransactionId = null

            if (shouldReserve) {
                createdTransactionId = insertTransactionForReport(
                    statements.insertTransactionStmt,
                    report.organization_id,
                    0,
                    "Reserved",
                    "imported_user", // create_user as a string
                    report.create_timestamp
                )
                totalTransactionsInserted++
            }

            if (report.credit_transaction_id && creditTradesMap.containsKey(report.credit_transaction_id)) {
                def ct = creditTradesMap[report.credit_transaction_id]

                // create_user as a string
                def ctCreateUser = "imported_user"

                def quantity = ct.quantity
                if (ct.transaction_type == "Credit Reduction") {
                    quantity = -quantity
                }

                def associatedTransactionId = insertTransactionForReport(
                    statements.insertTransactionStmt,
                    ct.respondent_id ?: ct.initiator_id,
                    quantity,
                    "Adjustment",
                    ctCreateUser,
                    ct.create_date,
                    ct.transaction_effective_date
                )
                totalTransactionsInserted++

                createdTransactionId = associatedTransactionId
            }

            if (createdTransactionId != null) {
                updateComplianceReportWithTransaction(destinationConn, lcfsReportId, createdTransactionId)
            }

            version++
            totalInserted++
        }
    }

    destinationConn.commit()

    // Re-enable and refresh the materialized view
    destinationConn.createStatement().execute("""
        CREATE OR REPLACE FUNCTION refresh_transaction_aggregate()
        RETURNS void AS \$\$
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_aggregate;
        END;
        \$\$ LANGUAGE plpgsql;
    """)
    destinationConn.createStatement().execute('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_aggregate')

    // Re-enable and refresh the materialized view
    destinationConn.createStatement().execute("""
        CREATE OR REPLACE FUNCTION refresh_mv_director_review_transaction_count()
        RETURNS void AS \$\$
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_director_review_transaction_count;
        END;
        \$\$ LANGUAGE plpgsql;
    """)
    destinationConn.createStatement().execute('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_director_review_transaction_count')

    log.info("Inserted ${totalInserted} compliance reports, ${totalHistoryInserted} history records, and ${totalTransactionsInserted} transactions into LCFS.")
} catch (Exception e) {
    log.error('Error occurred while processing compliance reports', e)
    destinationConn?.rollback()
    throw e
} finally {
    if (sourceConn != null) sourceConn.close()
    if (destinationConn != null) destinationConn.close()
}

// =========================================
// Helper Functions
// =========================================

def loadReferenceData(Connection conn) {
    def statusMap = [:]
    def idToName = [:]
    def stmt = conn.createStatement()
    def rs = stmt.executeQuery("SELECT compliance_report_status_id, status FROM compliance_report_status")
    while (rs.next()) {
        statusMap[rs.getString('status')] = rs.getInt('compliance_report_status_id')
        idToName[rs.getInt('compliance_report_status_id')] = rs.getString('status')
    }
    rs.close()
    stmt.close()

    return [
        statusMap: statusMap,
        statusIdToName: idToName
    ]
}

def fetchComplianceReports(Connection conn) {
    PreparedStatement stmt = conn.prepareStatement(SOURCE_REPORTS_QUERY)
    ResultSet rs = stmt.executeQuery()

    def chains = [:].withDefault { [] }

    while (rs.next()) {
        def rootId = rs.getObject('root_report_id') ?: rs.getInt('compliance_report_id')
        def record = [
            compliance_report_id   : rs.getInt('compliance_report_id'),
            type_id                : rs.getInt('type_id'),
            organization_id        : rs.getInt('organization_id'),
            compliance_period_id   : rs.getInt('compliance_period_id'),
            supplements_id         : rs.getObject('supplements_id'),
            root_report_id         : rs.getObject('root_report_id'),
            latest_report_id       : rs.getObject('latest_report_id'),
            traversal              : rs.getInt('traversal'),
            nickname               : rs.getString('nickname'),
            supplemental_note      : rs.getString('supplemental_note'),
            fuel_supplier_status_id: rs.getObject('fuel_supplier_status_id'),
            analyst_status_id      : rs.getObject('analyst_status_id'),
            manager_status_id      : rs.getObject('manager_status_id'),
            director_status_id     : rs.getObject('director_status_id'),
            create_user_id         : rs.getInt('create_user_id'),
            create_timestamp       : rs.getTimestamp('create_timestamp'),
            update_user_id         : rs.getInt('update_user_id'),
            update_timestamp       : rs.getTimestamp('update_timestamp'),
            report_type            : rs.getString('report_type'),
            compliance_period_desc : rs.getString('compliance_period_desc'),
            is_supplemental        : rs.getBoolean('is_supplemental'),
            credit_transaction_id  : rs.getObject('credit_transaction_id')
        ]
        chains[rootId] << record
    }
    rs.close()
    stmt.close()

    return chains
}

def fetchComplianceReportHistory(Connection conn) {
    PreparedStatement stmt = conn.prepareStatement(SOURCE_HISTORY_QUERY)
    ResultSet rs = stmt.executeQuery()

    def historyMap = [:].withDefault { [] }

    while (rs.next()) {
        def reportId = rs.getInt('compliance_report_id')
        def histRecord = [
            history_id              : rs.getInt('history_id'),
            compliance_report_id    : reportId,
            create_user_id          : rs.getInt('create_user_id'),
            create_timestamp        : rs.getTimestamp('create_timestamp'),
            fuel_supplier_status_id : rs.getObject('fuel_supplier_status_id'),
            analyst_status_id       : rs.getObject('analyst_status_id'),
            manager_status_id       : rs.getObject('manager_status_id'),
            director_status_id      : rs.getObject('director_status_id')
        ]
        historyMap[reportId] << histRecord
    }
    rs.close()
    stmt.close()

    return historyMap
}

def fetchApprovedCreditTrades(Connection conn) {
    PreparedStatement stmt = conn.prepareStatement(SOURCE_CREDIT_TRADE_QUERY)
    ResultSet rs = stmt.executeQuery()

    def trades = [:]

    while (rs.next()) {
        def t = [
            transaction_id           : rs.getInt('transaction_id'),
            initiator_id             : rs.getInt('initiator_id'),
            respondent_id            : rs.getInt('respondent_id'),
            agreement_date           : rs.getTimestamp('agreement_date'),
            transaction_effective_date: rs.getTimestamp('transaction_effective_date'),
            quantity                 : rs.getInt('quantity'),
            create_user              : rs.getInt('create_user'),
            create_date              : rs.getTimestamp('create_date'),
            update_user              : rs.getInt('update_user'),
            update_date              : rs.getTimestamp('update_date'),
            transaction_type         : rs.getString('transaction_type'),
            price_per_unit           : rs.getBigDecimal('price_per_unit')
        ]
        trades[rs.getInt('credit_trade_id')] = t
    }

    rs.close()
    stmt.close()
    return trades
}

def mapCurrentStatus(fuelSupplierStatus, analystStatus, managerStatus, directorStatus, referenceData) {
    def fuel = fuelSupplierStatus?.toString()?.toLowerCase() ?: ""
    def analyst = analystStatus?.toString()?.toLowerCase() ?: ""
    def manager = managerStatus?.toString()?.toLowerCase() ?: ""
    def director = directorStatus?.toString()?.toLowerCase() ?: ""

    // Priority: Director > Manager > Analyst > Supplier

    // Director logic
    if (director == "accepted") {
        return referenceData.statusMap["Assessed"]
    } else if (director == "rejected" || director.contains("requested supplemental")) {
        return null // exclude
    }

    // Manager logic
    if (manager == "recommended") {
        return referenceData.statusMap["Recommended by manager"]
    } else if (manager == "not recommended" || manager.contains("requested supplemental")) {
        return null // exclude
    }

    // Analyst logic
    if (analyst == "recommended") {
        return referenceData.statusMap["Recommended by analyst"]
    } else if (analyst == "not recommended" || analyst.contains("requested supplemental")) {
        return null // exclude
    }

    // Supplier logic
    if (fuel == "deleted") {
        return null // exclude
    } else if (fuel == "submitted") {
        return referenceData.statusMap["Submitted"]
    } else if (fuel == "draft") {
        return referenceData.statusMap["Draft"]
    }

    // If nothing matches, exclude
    return null
}

def prepareStatements(Connection conn) {
    def INSERT_COMPLIANCE_REPORT_SQL = """
        INSERT INTO compliance_report (
            compliance_period_id,
            organization_id,
            current_status_id,
            transaction_id,
            compliance_report_group_uuid,
            version,
            supplemental_initiator,
            reporting_frequency,
            nickname,
            supplemental_note,
            create_user,
            create_date,
            update_user,
            update_date
        ) VALUES (?, ?, ?, NULL, ?, ?, ?::SupplementalInitiatorType, ?::ReportingFrequency, ?, ?, ?, ?, ?, ?)
        RETURNING compliance_report_id
    """

    def INSERT_COMPLIANCE_REPORT_HISTORY_SQL = """
        INSERT INTO compliance_report_history (
            compliance_report_id,
            status_id,
            user_profile_id,
            create_user,
            create_date,
            update_user,
            update_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    """

    def INSERT_TRANSACTION_SQL = '''
        INSERT INTO transaction (
            compliance_units, organization_id, transaction_action, effective_date, create_user, create_date, effective_status
        ) VALUES (?, ?, ?::transaction_action_enum, ?, ?, ?, TRUE)
        RETURNING transaction_id
    '''

    def UPDATE_COMPLIANCE_REPORT_TRANSACTION_SQL = '''
        UPDATE compliance_report
        SET transaction_id = ?
        WHERE compliance_report_id = ?
    '''

    return [
        insertComplianceReportStmt: conn.prepareStatement(INSERT_COMPLIANCE_REPORT_SQL),
        insertComplianceReportHistoryStmt: conn.prepareStatement(INSERT_COMPLIANCE_REPORT_HISTORY_SQL),
        insertTransactionStmt: conn.prepareStatement(INSERT_TRANSACTION_SQL),
        updateComplianceReportTransactionStmt: conn.prepareStatement(UPDATE_COMPLIANCE_REPORT_TRANSACTION_SQL)
    ]
}

def insertComplianceReport(PreparedStatement stmt, Map report, String groupUuid, int version, String supplementalInitiator, String reportingFrequency, Integer currentStatusId, String createUser, String updateUser) {
    stmt.setInt(1, report.compliance_period_id)
    stmt.setInt(2, report.organization_id)

    if (currentStatusId == null) {
        stmt.setNull(3, java.sql.Types.INTEGER)
    } else {
        stmt.setInt(3, currentStatusId)
    }

    stmt.setString(4, groupUuid)
    stmt.setInt(5, version)
    stmt.setObject(6, supplementalInitiator)
    stmt.setString(7, reportingFrequency)
    stmt.setString(8, report.nickname)
    stmt.setString(9, report.supplemental_note)
    stmt.setString(10, createUser)
    stmt.setTimestamp(11, report.create_timestamp ?: Timestamp.valueOf("1970-01-01 00:00:00"))
    stmt.setString(12, updateUser)
    stmt.setTimestamp(13, report.update_timestamp ?: report.create_timestamp ?: Timestamp.valueOf("1970-01-01 00:00:00"))

    def rs = stmt.executeQuery()
    def insertedId = null
    if (rs.next()) {
        insertedId = rs.getInt('compliance_report_id')
    }
    rs.close()
    return insertedId
}

def insertComplianceReportHistory(Integer lcfsReportId, List historyRecords,
                                  PreparedStatement historyStmt,
                                  Map referenceData) {
    int count = 0
    if (!historyRecords) return count

    historyRecords.each { h ->
        def statusId = mapCurrentStatus(
            h.fuel_supplier_status_id,
            h.analyst_status_id,
            h.manager_status_id,
            h.director_status_id,
            referenceData
        )

        // We'll just use a placeholder "imported_user" string for create_user and update_user
        def createUser = "imported_user"
        def timestamp = h.create_timestamp ?: Timestamp.valueOf("1970-01-01 00:00:00")

        // For user_profile_id, we can still set it if we have it, or null otherwise
        def userProfileId = h.create_user_id

        log.warn("Processing history record:")
        log.warn("lcfsReportId: ${lcfsReportId}, statusId: ${statusId}, userProfileId: ${userProfileId}, create_user: ${createUser}, timestamp: ${timestamp}")
        log.warn("fuel_supplier_status_id: ${h.fuel_supplier_status_id}, analyst_status_id: ${h.analyst_status_id}, manager_status_id: ${h.manager_status_id}, director_status_id: ${h.director_status_id}")

        if (statusId == null) {
            // Skip this history record because we didn't match a status
            log.warn("Skipping history record for lcfsReportId: ${lcfsReportId} due to null statusId.")
            return
        }

        try {
            historyStmt.setInt(1, lcfsReportId)
            historyStmt.setInt(2, statusId)

            if (userProfileId == null) {
                historyStmt.setNull(3, java.sql.Types.INTEGER)
            } else {
                historyStmt.setInt(3, userProfileId)
            }

            // create_user (String)
            if (createUser == null) {
                historyStmt.setNull(4, java.sql.Types.VARCHAR)
            } else {
                historyStmt.setString(4, createUser)
            }

            // create_date (timestamp)
            historyStmt.setTimestamp(5, timestamp)

            // update_user (String) - same as create_user for simplicity
            if (createUser == null) {
                historyStmt.setNull(6, java.sql.Types.VARCHAR)
            } else {
                historyStmt.setString(6, createUser)
            }

            // update_date (timestamp)
            historyStmt.setTimestamp(7, timestamp)

            historyStmt.addBatch()
            count++
        } catch (Exception e) {
            log.error("Error inserting compliance report history for lcfsReportId: ${lcfsReportId}", e)
        }
    }

    try {
        historyStmt.executeBatch()
    } catch (Exception e) {
        log.error("Error executing batch insert for compliance report history", e)
        throw e
    }

    return count
}

def insertTransactionForReport(PreparedStatement stmt, int orgId, int quantity, String action, String createUser, Timestamp createDate, Timestamp effectiveDate = null) {
    def effDate = effectiveDate ?: createDate ?: Timestamp.valueOf("1970-01-01 00:00:00")

    stmt.setInt(1, quantity)
    stmt.setInt(2, orgId)
    stmt.setString(3, action)
    stmt.setTimestamp(4, effDate)

    if (createUser == null) {
        stmt.setNull(5, java.sql.Types.VARCHAR)
    } else {
        stmt.setString(5, createUser)
    }

    stmt.setTimestamp(6, createDate ?: Timestamp.valueOf("1970-01-01 00:00:00"))

    def rs = stmt.executeQuery()
    def transactionId = null
    if (rs.next()) {
        transactionId = rs.getInt('transaction_id')
    }
    rs.close()
    return transactionId
}

def updateComplianceReportWithTransaction(Connection conn, int lcfsReportId, int transactionId) {
    def updateStmt = conn.prepareStatement("UPDATE compliance_report SET transaction_id = ? WHERE compliance_report_id = ?")
    updateStmt.setInt(1, transactionId)
    updateStmt.setInt(2, lcfsReportId)
    updateStmt.executeUpdate()
    updateStmt.close()
}
