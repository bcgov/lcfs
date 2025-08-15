import groovy.json.JsonSlurper
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.sql.Timestamp
import java.util.UUID
import java.nio.charset.StandardCharsets
import java.time.OffsetDateTime
import java.time.Instant

/*
Simplified and revised script for migrating compliance reports from Source DB to Destination DB.

Key Features:
1. Processes each compliance report individually using a single comprehensive query.
2. Assigns a deterministic group_uuid based on root_report_id.
3. Excludes "Deleted" reports and includes "Rejected" reports.
4. Maps create_user and update_user to user.display_name.
5. Inserts compliance reports, their histories, and associated transactions.
6. Ensures sequence integrity for compliance_report_id.
7. Facilitates efficient testing by allowing deletion of inserted records based on display_name.
8. Adds handling for 'in reserve' transactions based on snapshot data.
9. After all existing compliance reports are processed, queries for unassociated credit trades of type 3 or 4
   and creates new transactions for them.
*/

// =========================================
// Queries
// =========================================

// Consolidated source query that gathers all relevant information for each compliance report
def SOURCE_CONSOLIDATED_QUERY = """
WITH
    compliance_history AS (
        SELECT
            crh.compliance_report_id,
            json_agg(
                json_build_object(
                    'history_id', crh.id,
                    'create_user_id', crh.create_user_id,
                    'create_timestamp', crh.create_timestamp,
                    'fuel_supplier_status_id', cws.fuel_supplier_status_id,
                    'analyst_status_id', cws.analyst_status_id,
                    'manager_status_id', cws.manager_status_id,
                    'director_status_id', cws.director_status_id
                )
            ) AS history_json
        FROM compliance_report_history crh
        JOIN compliance_report_workflow_state cws ON crh.status_id = cws.id
        GROUP BY crh.compliance_report_id
    )
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
    cr.credit_transaction_id,
    ch.history_json,
    crs.snapshot AS compliance_report_snapshot, -- Added snapshot
    -- CreditTrade Fields (One-to-One Relationship)
    ct.id AS credit_trade_id,
    ct.initiator_id,
    ct.respondent_id,
    ct.date_of_written_agreement,
    ct.trade_effective_date,
    ct.number_of_credits,
    ct.create_user_id AS ct_create_user_id,
    ct.create_timestamp AS ct_create_timestamp,
    ct.update_user_id AS ct_update_user_id,
    ct.update_timestamp AS ct_update_timestamp,
    ctt.the_type AS credit_trade_type,
    ct.fair_market_value_per_credit
FROM compliance_report cr
JOIN compliance_report_type crt ON cr.type_id = crt.id
JOIN compliance_period cp ON cp.id = cr.compliance_period_id
JOIN compliance_report_workflow_state cws ON cr.status_id = cws.id
LEFT JOIN compliance_history ch ON cr.id = ch.compliance_report_id
LEFT JOIN compliance_report_snapshot crs ON cr.id = crs.compliance_report_id -- Added join
LEFT JOIN credit_trade ct ON cr.credit_transaction_id = ct.id
LEFT JOIN credit_trade_type ctt ON ct.type_id = ctt.id
LEFT JOIN credit_trade_status cts ON ct.status_id = cts.id
WHERE cr.type_id = 1
ORDER BY cr.root_report_id NULLS FIRST, cr.traversal, cr.id;
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

    // Disable refresh of the materialized views
    def stmt = destinationConn.createStatement()

    stmt.execute(dropAuditTriggers)

    stmt.execute('DROP FUNCTION IF EXISTS refresh_transaction_aggregate() CASCADE;')
    stmt.execute("""
        CREATE OR REPLACE FUNCTION refresh_transaction_aggregate()
        RETURNS void AS \$\$
        BEGIN
            -- Temporarily disable the materialized view refresh
        END;
        \$\$ LANGUAGE plpgsql;
    """)

    stmt.execute('DROP FUNCTION IF EXISTS refresh_mv_director_review_transaction_count() CASCADE;')
    stmt.execute("""
        CREATE OR REPLACE FUNCTION refresh_mv_director_review_transaction_count()
        RETURNS void AS \$\$
        BEGIN
            -- Temporarily disable the materialized view refresh
        END;
        \$\$ LANGUAGE plpgsql;
    """)
    stmt.execute('DROP FUNCTION IF EXISTS refresh_mv_org_compliance_report_count() CASCADE;')
    destinationConn.createStatement().execute("""
        CREATE OR REPLACE FUNCTION refresh_mv_org_compliance_report_count()
        RETURNS void AS \$\$
        BEGIN
            -- Temporarily disable the materialized view refresh
        END;
        \$\$ LANGUAGE plpgsql;
    """)
    stmt.execute('DROP FUNCTION IF EXISTS refresh_mv_compliance_report_count() CASCADE;')
    destinationConn.createStatement().execute("""
        CREATE OR REPLACE FUNCTION refresh_mv_compliance_report_count()
        RETURNS void AS \$\$
        BEGIN
            -- Temporarily disable the materialized view refresh
        END;
        \$\$ LANGUAGE plpgsql;
    """)
    stmt.close()

    // Load reference data for status mapping
    def referenceData = loadReferenceData(destinationConn)

    // Fetch user profiles to map user IDs to display names
    def userProfiles = fetchUserProfiles(sourceConn)

    // Prepare database statements
    def statements = prepareStatements(destinationConn)

    // Initialize counters
    int totalInserted = 0
    int totalHistoryInserted = 0
    int totalTransactionsInserted = 0

    // Create a prepared statement for checking legacy_id existence in LCFS.
    def legacyCheckStmt = destinationConn.prepareStatement("SELECT compliance_report_id FROM compliance_report WHERE legacy_id = ?")

    // Execute the consolidated compliance reports query
    PreparedStatement consolidatedStmt = sourceConn.prepareStatement(SOURCE_CONSOLIDATED_QUERY)
    ResultSet rs = consolidatedStmt.executeQuery()

    log.warn("Creating Compliance Report Objects")

    while (rs.next()) {
        def record = [
            compliance_report_id    : rs.getInt('compliance_report_id'),
            type_id                 : rs.getInt('type_id'),
            organization_id         : rs.getInt('organization_id'),
            compliance_period_id    : rs.getInt('compliance_period_id'),
            supplements_id          : rs.getObject('supplements_id'),
            root_report_id          : rs.getObject('root_report_id'),
            latest_report_id        : rs.getObject('latest_report_id'),
            traversal               : rs.getInt('traversal'),
            nickname                : rs.getString('nickname'),
            supplemental_note       : rs.getString('supplemental_note'),
            fuel_supplier_status_id : rs.getString('fuel_supplier_status_id'), // Now String
            analyst_status_id       : rs.getString('analyst_status_id'),
            manager_status_id       : rs.getString('manager_status_id'),
            director_status_id      : rs.getString('director_status_id'),
            create_user_id          : rs.getInt('create_user_id'),
            create_timestamp        : rs.getTimestamp('create_timestamp'),
            update_user_id          : rs.getInt('update_user_id'),
            update_timestamp        : rs.getTimestamp('update_timestamp'),
            report_type             : rs.getString('report_type'),
            compliance_period_desc  : rs.getString('compliance_period_desc'),
            is_supplemental         : rs.getBoolean('is_supplemental'),
            credit_transaction_id   : rs.getObject('credit_transaction_id'),
            history_json            : rs.getString('history_json'),
            compliance_report_snapshot : rs.getString('compliance_report_snapshot'), // Added snapshot
            // CreditTrade Fields
            credit_trade_id         : rs.getObject('credit_trade_id'),
            initiator_id            : rs.getObject('initiator_id'),
            respondent_id           : rs.getObject('respondent_id'),
            date_of_written_agreement : rs.getDate('date_of_written_agreement'),
            trade_effective_date    : rs.getDate('trade_effective_date'),
            number_of_credits       : rs.getInt('number_of_credits'),
            ct_create_user_id       : rs.getObject('ct_create_user_id'),
            ct_create_timestamp     : rs.getTimestamp('ct_create_timestamp'),
            ct_update_user_id       : rs.getObject('ct_update_user_id'),
            ct_update_timestamp     : rs.getTimestamp('ct_update_timestamp'),
            credit_trade_type       : rs.getString('credit_trade_type'),
            fair_market_value_per_credit : rs.getBigDecimal('fair_market_value_per_credit')
        ]

        // Check if a compliance report with this legacy_id (from source compliance_report_id) already exists in LCFS.
        legacyCheckStmt.setInt(1, record.compliance_report_id)
        ResultSet legacyRs = legacyCheckStmt.executeQuery()
        if (legacyRs.next()) {
            log.warn("Skipping compliance_report_id: ${record.compliance_report_id} because legacy record already exists in LCFS.")
            legacyRs.close()
            continue
        }
        legacyRs.close()

        // Map TFRS compliance period ID to LCFS compliance period ID
        record.compliance_period_id = mapCompliancePeriodId(record.compliance_period_id)

        // Insert Compliance Report History from JSON
        def historyJson = record.history_json
        def historyRecords = historyJson ? new JsonSlurper().parseText(historyJson).sort { a, b ->
            def aTime = a.create_timestamp ? OffsetDateTime.parse(a.create_timestamp).toInstant() : Instant.EPOCH
            def bTime = b.create_timestamp ? OffsetDateTime.parse(b.create_timestamp).toInstant() : Instant.EPOCH
            aTime <=> bTime
        } : []

        // Parse the snapshot JSON to extract in reserve quantity and convert it to an Integer
        def snapshotJson = record.compliance_report_snapshot
        def inReserveQuantity = null
        if (snapshotJson) {
            try {
                def snapshot = new JsonSlurper().parseText(snapshotJson)
                def quantityStr = snapshot?.summary?.lines?.get('25')
                if (quantityStr != null) {
                    inReserveQuantity = safeConvertToInt(quantityStr)
                    if (inReserveQuantity == null) {
                        log.error("Invalid in reserve quantity format for compliance_report_id: ${record.compliance_report_id}")
                    }
                } else {
                    log.warn("In reserve quantity not found in snapshot for compliance_report_id: ${record.compliance_report_id}")
                }
            } catch (Exception e) {
                log.error("Error parsing snapshot JSON for compliance_report_id: ${record.compliance_report_id}", e)
            }
        } else {
            log.warn("No snapshot found for compliance_report_id: ${record.compliance_report_id}")
        }

        // Determine the root ID for UUID generation
        def rootId = record.root_report_id ?: record.compliance_report_id

        // Generate a deterministic UUID based on rootId
        def groupUuid = UUID.nameUUIDFromBytes(rootId.toString().getBytes(StandardCharsets.UTF_8))

        def version = (record.compliance_report_id == record.root_report_id) ? 0 : (record.traversal ?: 0)

        // Determine the current status ID based on workflow states and history
        def currentStatusId = mapCurrentStatus(
            record.fuel_supplier_status_id,
            record.analyst_status_id,
            record.manager_status_id,
            record.director_status_id,
            referenceData,
            historyRecords
        )

        // Exclude reports with non-matching statuses like deleted
        if (currentStatusId == null) {
            continue
        }

        // Map create_user and update_user to display_name
        def reportCreateUser = userProfiles[record.create_user_id] ?: "imported_user"
        def reportUpdateUser = userProfiles[record.update_user_id] ?: reportCreateUser

        def supplementalInitiator = record.is_supplemental ? "SUPPLIER_SUPPLEMENTAL" : null
        def reportingFrequency = "ANNUAL"

        // Insert Compliance Report into LCFS
        def lcfsReportId = insertComplianceReport(
            statements.insertComplianceReportStmt,
            record,
            groupUuid.toString(),
            version,
            supplementalInitiator,
            reportingFrequency,
            currentStatusId,
            reportCreateUser,
            reportUpdateUser
        )
        totalInserted++

        def insertedHistoryCount = insertComplianceReportHistory(
            lcfsReportId,
            historyRecords,
            statements.insertComplianceReportHistoryStmt,
            referenceData,
            userProfiles
        )
        totalHistoryInserted += insertedHistoryCount

        // Determine organization ID
        def orgId = record.organization_id

        if (orgId == null) {
            log.error("No organization_id found for compliance_report_id: ${record.compliance_report_id}. Skipping transaction creation.")
        } else {
            if (record.credit_trade_id) {
                // **Accepted Report:** Create only an Adjustment transaction
                def ctCreateUser = userProfiles[record.ct_create_user_id] ?: "imported_user"
                def quantity = record.number_of_credits
                if (record.credit_trade_type == "Credit Reduction") {
                    quantity = -quantity
                }

                def associatedTransactionId = insertTransactionForReport(
                    statements.insertTransactionStmt,
                    record.organization_id,
                    quantity,
                    "Adjustment",
                    ctCreateUser,
                    record.ct_create_timestamp,
                    record.trade_effective_date ? Timestamp.valueOf(record.trade_effective_date.toLocalDate().atStartOfDay()) : null
                )
                totalTransactionsInserted++

                if (associatedTransactionId != null) {
                    updateComplianceReportWithTransaction(destinationConn, lcfsReportId, associatedTransactionId)
                }
            } else {
                // After determining currentStatusName and having processed "In Reserve" transactions:
                def currentStatusName = referenceData.statusIdToName[currentStatusId]?.toLowerCase()

                // Check if not the latest report in the chain or status is rejected
                boolean isLatestReport = (record.compliance_report_id == record.latest_report_id)

                // Determine if we should consider a "Reserved" transaction
                def shouldReserve = ["submitted", "recommended by analyst", "recommended by manager", "not recommended"].contains(currentStatusName)

                if (shouldReserve && inReserveQuantity != null && inReserveQuantity < 0) {
                    boolean mustRelease = false

                    // If current report is rejected, release immediately
                    if (currentStatusName == "rejected") {
                        mustRelease = true
                    } else {
                        // If not the latest report, check the source DB for a future report
                        if (!isLatestReport) {
                            def futureQuery = """
                                SELECT c.id,
                                      s.fuel_supplier_status_id,
                                      s.analyst_status_id,
                                      s.manager_status_id,
                                      s.director_status_id
                                FROM compliance_report c
                                JOIN compliance_report_workflow_state s ON c.status_id = s.id
                                WHERE c.root_report_id = ?
                                AND c.id > ?
                                ORDER BY c.id ASC LIMIT 1
                            """

                            PreparedStatement futureStmt = sourceConn.prepareStatement(futureQuery)
                            futureStmt.setObject(1, record.root_report_id)
                            futureStmt.setInt(2, record.compliance_report_id)
                            ResultSet futureRs = futureStmt.executeQuery()

                            if (futureRs.next()) {
                                def futureFuelStatus = futureRs.getString("fuel_supplier_status_id")
                                def futureAnalystStatus = futureRs.getString("analyst_status_id")
                                def futureManagerStatus = futureRs.getString("manager_status_id")
                                def futureDirectorStatus = futureRs.getString("director_status_id")

                                // Map these future statuses to a final mapped status ID
                                def futureStatusId = mapCurrentStatus(
                                    futureFuelStatus,
                                    futureAnalystStatus,
                                    futureManagerStatus,
                                    futureDirectorStatus,
                                    referenceData,
                                    []
                                )

                                if (futureStatusId != null) {
                                    def futureStatusName = referenceData.statusIdToName[futureStatusId]?.toLowerCase()
                                    log.warn("Future report found with mapped status: ${futureStatusName}")

                                    // If the future report progresses beyond current (e.g., submitted or recommended), we must release immediately
                                    if (["submitted", "recommended by analyst", "recommended by manager", "assessed"].contains(futureStatusName)) {
                                        mustRelease = true
                                    }
                                } else {
                                    log.warn("Future report found but no valid mapped status. Not releasing at this time.")
                                }
                            }

                            futureRs.close()
                            futureStmt.close()
                        }
                    }

                    // Determine final action: if mustRelease is true, directly release; otherwise reserve
                    def finalAction = mustRelease ? "Released" : "Reserved"

                    log.warn("Inserting a single ${finalAction} transaction for compliance_report_id: ${record.compliance_report_id} with quantity: ${inReserveQuantity}")

                    def transactionId = insertTransactionForReport(
                        statements.insertTransactionStmt,
                        orgId,
                        inReserveQuantity,
                        finalAction,
                        reportCreateUser,
                        record.create_timestamp,
                        null
                    )
                    totalTransactionsInserted++
                    if (transactionId != null) {
                        updateComplianceReportWithTransaction(destinationConn, lcfsReportId, transactionId)
                    }

                } else if (currentStatusName == "rejected") {
                    // Report is rejected but no inReserveQuantity or not in the reservable statuses, no transaction
                    log.debug("Rejected report_id: ${record.compliance_report_id}. No transaction created.")
                } else {
                    // Unhandled status or inReserveQuantity is null
                    log.warn("No action for compliance_report_id: ${record.compliance_report_id}, status: ${currentStatusName}, inReserveQuantity: ${inReserveQuantity}.")
                }
            }
        }
    }

    rs.close()
    consolidatedStmt.close()
    legacyCheckStmt.close()  // Close the legacy check statement after processing

    // Commit all changes from the original compliance report processing
    destinationConn.commit()

    // =========================================
    // Process Unassociated Credit Trades
    // =========================================
    // This section identifies credit trades of type 3 or 4 (Credit Validation or Credit Reduction)
    // that are not currently associated with any compliance_report. Instead of creating new 
    // compliance reports, it only creates corresponding transactions. (to be reviewed at a later date)
    //
    // For each unassociated credit trade:
    // 1. Determines if it's a credit validation or a credit reduction.
    // 2. Creates a transaction (positive units for validations, negative units for reductions).
    // 3. Does not associate the transaction with any compliance report, leaving them as standalone transactions.
    //
    // This ensures that all known credit trades have corresponding transactions, 
    // even if they do not currently relate to a compliance report.

    log.warn("Processing Unassociated Credit Trades of Type 3 or 4 to Create Transactions Only")

    // Query for unassociated credit trades of type 3 or 4 and approved status
    // These trades exist in the credit_trade table but are not linked to a compliance_report.
    def UNASSOCIATED_CREDIT_TRADES_QUERY = """
    SELECT ct.id AS credit_trade_id,
          ct.respondent_id AS organization_id,
          ct.compliance_period_id AS period_id,
          ct.type_id AS credit_trade_type_id,
          ct.trade_effective_date,
          ct.number_of_credits,
          ct.status_id,
          ct.create_user_id AS ct_create_user_id,
          ct.create_timestamp AS ct_create_timestamp
    FROM credit_trade ct
    LEFT JOIN compliance_report cr ON cr.credit_transaction_id = ct.id
    WHERE ct.type_id IN (3,4)
      AND ct.status_id = 7
      AND cr.id IS NULL;
    """

    PreparedStatement unassociatedTradesStmt = sourceConn.prepareStatement(UNASSOCIATED_CREDIT_TRADES_QUERY)
    ResultSet unassocRs = unassociatedTradesStmt.executeQuery()

    while (unassocRs.next()) {
        def credit_trade_id = unassocRs.getInt("credit_trade_id")
        def organization_id = unassocRs.getInt("organization_id")
        def credit_trade_type_id = unassocRs.getInt("credit_trade_type_id")
        def trade_effective_date = unassocRs.getTimestamp("trade_effective_date")
        def number_of_credits = unassocRs.getInt("number_of_credits")
        def ct_create_user_id = unassocRs.getInt("ct_create_user_id")
        def ct_create_timestamp = unassocRs.getTimestamp("ct_create_timestamp")

        def createUser = userProfiles[ct_create_user_id] ?: "imported_user"

        // Determine transaction direction based on trade type
        // type_id = 3 (Credit Validation) => positive credits
        // type_id = 4 (Credit Reduction) => negative credits
        def adjustedCredits = (credit_trade_type_id == 4) ? -number_of_credits : number_of_credits

        // Create a standalone transaction for this credit trade
        def transactionId = insertTransactionForReport(
            statements.insertTransactionStmt,
            organization_id,
            adjustedCredits,
            "Adjustment",
            createUser,
            ct_create_timestamp,
            trade_effective_date
        )
        totalTransactionsInserted++

        log.warn("Created standalone transaction ${transactionId} for credit_trade_id ${credit_trade_id} (no associated compliance report)")
    }

    unassocRs.close()
    unassociatedTradesStmt.close()

    // Commit changes for the newly created transactions
    destinationConn.commit()

    log.warn("Inserted ${totalInserted} compliance reports (from earlier processing), ${totalHistoryInserted} history records, and ${totalTransactionsInserted} transactions into LCFS, including standalone transactions for unassociated credit trades.")

    // Re-enable and refresh the materialized views
    stmt = destinationConn.createStatement()
    stmt.execute("""
        CREATE OR REPLACE FUNCTION refresh_transaction_aggregate()
        RETURNS void AS \$\$
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_aggregate;
        END;
        \$\$ LANGUAGE plpgsql;
    """)
    stmt.execute('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_aggregate')

    stmt.execute("""
        CREATE OR REPLACE FUNCTION refresh_mv_director_review_transaction_count()
        RETURNS void AS \$\$
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_director_review_transaction_count;
        END;
        \$\$ LANGUAGE plpgsql;
    """)
    // stmt.execute('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_director_review_transaction_count')

    stmt.execute("""
        CREATE OR REPLACE FUNCTION refresh_mv_org_compliance_report_count()
        RETURNS void AS \$\$
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_org_compliance_report_count;
        END;
        \$\$ LANGUAGE plpgsql;
    """)
    // stmt.execute('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_org_compliance_report_count')

    stmt.execute("""
        CREATE OR REPLACE FUNCTION refresh_mv_compliance_report_count()
        RETURNS void AS \$\$
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_compliance_report_count;
        END;
        \$\$ LANGUAGE plpgsql;
    """)
    // stmt.execute('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_compliance_report_count')

    stmt.execute(reAddAuditTriggers)

    stmt.close()

    log.warn("Inserted ${totalInserted} compliance reports, ${totalHistoryInserted} history records, and ${totalTransactionsInserted} transactions into LCFS.")
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

/**
 * Safely converts a value to Integer.
 * @param value The value to convert.
 * @return The Integer value or null if conversion fails.
 */
def safeConvertToInt(def value) {
    if (value instanceof Number) {
        return value.intValue()
    } else if (value instanceof String) {
        try {
            return Integer.parseInt(value)
        } catch (NumberFormatException e) {
            log.error("Failed to convert value to Integer: ${value}", e)
            return null
        }
    }
    return null
}

/**
 * Fetches user profiles and maps id to display_name.
 * @param conn Source database connection.
 * @return A map of id to display_name.
 */
def fetchUserProfiles(Connection conn) {
    def stmt = conn.createStatement()
    def rs = stmt.executeQuery("SELECT id, display_name FROM public.user")
    def userMap = [:]
    while (rs.next()) {
        userMap[rs.getInt("id")] = rs.getString("display_name")
    }
    rs.close()
    stmt.close()
    return userMap
}

/**
 * Loads reference data for status mapping.
 * @param conn Destination database connection.
 * @return A map containing status mappings.
 */
def loadReferenceData(Connection conn) {
    def statusMap = [:]
    def idToName = [:]
    def stmt = conn.createStatement()
    def rs = stmt.executeQuery("SELECT compliance_report_status_id, status FROM compliance_report_status")
    while (rs.next()) {
        statusMap[rs.getString('status').toLowerCase()] = rs.getInt('compliance_report_status_id')
        idToName[rs.getInt('compliance_report_status_id')] = rs.getString('status').toLowerCase()
    }
    rs.close()
    stmt.close()

    return [
        statusMap      : statusMap,
        statusIdToName : idToName
    ]
}

/**
 * Maps workflow statuses to LCFS compliance_report_status_id.
 * Handles 'requested supplemental' and 'not recommended' by referencing the history.
 * @param fuelStatusName Fuel supplier status name.
 * @param analystStatusName Analyst status name.
 * @param managerStatusName Manager status name.
 * @param directorStatusName Director status name.
 * @param referenceData Reference data for status mapping.
 * @param historyRecords List of history records for the compliance report.
 * @return Mapped compliance_report_status_id or null if excluded.
 */
def mapCurrentStatus(fuelStatusName, analystStatusName, managerStatusName, directorStatusName, referenceData, List historyRecords) {
    // Normalize to lowercase for consistent comparison
    fuelStatusName = fuelStatusName?.toLowerCase()
    analystStatusName = analystStatusName?.toLowerCase()
    managerStatusName = managerStatusName?.toLowerCase()
    directorStatusName = directorStatusName?.toLowerCase()

    // Flags to determine special conditions
    def isRequestedSupplemental = [
        fuelStatusName,
        analystStatusName,
        managerStatusName,
        directorStatusName
    ].any { it?.contains("requested supplemental") }

    def isNotRecommended = [
        fuelStatusName,
        analystStatusName,
        managerStatusName,
        directorStatusName
    ].any { it == "not recommended" }

    // Handle 'requested supplemental'
    if (isRequestedSupplemental) {
        log.debug("Status contains 'requested supplemental'. Processing history to determine previous status.")
        if (historyRecords) {
            // Iterate through history records in reverse (most recent first)
            for (int i = historyRecords.size() - 1; i >= 0; i--) {
                def previousRecord = historyRecords[i]
                def prevFuelStatus = previousRecord.fuel_supplier_status_id ? previousRecord.fuel_supplier_status_id.toLowerCase() : null
                def prevAnalystStatus = previousRecord.analyst_status_id ? previousRecord.analyst_status_id.toLowerCase() : null
                def prevManagerStatus = previousRecord.manager_status_id ? previousRecord.manager_status_id.toLowerCase() : null
                def prevDirectorStatus = previousRecord.director_status_id ? previousRecord.director_status_id.toLowerCase() : null

                // Check if the previous record does not have 'requested supplemental'
                def wasRequestedSupplemental = [
                    prevFuelStatus,
                    prevAnalystStatus,
                    prevManagerStatus,
                    prevDirectorStatus
                ].any { it?.contains("requested supplemental") }

                if (!wasRequestedSupplemental) {
                    // Determine the previous status based on priority: Director > Manager > Analyst > Supplier
                    def previousStatusName = null
                    if (prevDirectorStatus) {
                        previousStatusName = prevDirectorStatus
                    } else if (prevManagerStatus) {
                        previousStatusName = prevManagerStatus
                    } else if (prevAnalystStatus) {
                        previousStatusName = prevAnalystStatus
                    } else if (prevFuelStatus) {
                        previousStatusName = prevFuelStatus
                    }

                    if (previousStatusName) {
                        if (previousStatusName == "accepted") {
                            log.debug("Previous status was 'accepted'. Mapping to 'assessed'.")
                            return referenceData.statusMap["assessed"]
                        } else if (previousStatusName == "recommended" || previousStatusName == "submitted") {
                            log.debug("Previous status was '${previousStatusName}'. Mapping back to 'submitted'.")
                            return referenceData.statusMap["submitted"]
                        }
                        // Add additional mappings if necessary
                    }
                }
            }
        }
        // If no valid previous status is found, exclude the report
        log.debug("No valid previous status found for 'requested supplemental'. Excluding report.")
        return null
    }

    // Handle 'not recommended'
    if (isNotRecommended) {
        log.debug("Status contains 'not recommended'. Mapping back to 'submitted'.")
        return referenceData.statusMap["submitted"]
    }

    // Determine the current status based on all status fields
    // Priority: Director > Manager > Analyst > Supplier
    // Adjust mappings based on your specific business rules

    // Check Director Status
    if (directorStatusName) {
        if (directorStatusName == "accepted") {
            return referenceData.statusMap["assessed"]
        } else if (directorStatusName == "rejected") {
            return referenceData.statusMap["rejected"]
        }
    }

    // Check Manager Status
    if (managerStatusName) {
        if (managerStatusName == "recommended") {
            return referenceData.statusMap["recommended by manager"]
        }
    }

    // Check Analyst Status
    if (analystStatusName) {
        if (analystStatusName == "recommended") {
            return referenceData.statusMap["recommended by analyst"]
        }
    }

    // Check Fuel Supplier Status
    if (fuelStatusName) {
        if (fuelStatusName == "submitted") {
            return referenceData.statusMap["submitted"]
        } else if (fuelStatusName == "draft") {
            return referenceData.statusMap["draft"]
        } else if (fuelStatusName == "deleted") {
            // Exclude deleted reports
            return null
        }
    }

    // Default case
    return null
}

// =========================================
// Add a mapping function for compliance_period_id
// =========================================
def mapCompliancePeriodId(Integer tfrsId) {
    // This mapping adjusts for the doubled up years in TFRS (2012-13, 2013-14)
    // and ensures correct alignment with LCFS single-year periods.
    //
    // TFRS IDs vs. Descriptions:
    // 3 -> "2012-13"
    // 4 -> "2013-14"
    // LCFS has each year individually:
    // 3 -> "2012"
    // 4 -> "2013"
    // 5 -> "2014"
    //
    // Because TFRS combines two-year periods, align them as follows:
    // TFRS:3 (2012-13) -> LCFS:3 (2012)
    // TFRS:4 (2013-14) -> LCFS:5 (2014), skipping LCFS:4 (2013)
    // After handling these two combined periods, subsequent years shift by 1.

    def compliancePeriodMapping = [
        1:  1,
        2:  2,
        3:  3, // 2012-13 mapped to 2012
        4:  5, // 2013-14 mapped to 2014, skipping 2013
        5:  6,
        6:  7,
        7:  8,
        8:  9,
        9:  10,
        10: 11,
        11: 12,
        12: 13,
        13: 14,
        14: 15,
        15: 16,
        16: 17,
        17: 18,
        18: 19,
        19: 20,
        20: 21
    ]

    return compliancePeriodMapping[tfrsId] ?: tfrsId
}

/**
 * Prepares SQL statements for insertion and updates.
 * @param conn Destination database connection.
 * @return A map of prepared statements.
 */
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
            update_date,
            legacy_id
        ) VALUES (?, ?, ?, NULL, ?, ?, ?::SupplementalInitiatorType, ?::ReportingFrequency, ?, ?, ?, ?, ?, ?, ?)
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
        ON CONFLICT (compliance_report_id, status_id) DO NOTHING
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
        insertComplianceReportStmt           : conn.prepareStatement(INSERT_COMPLIANCE_REPORT_SQL),
        insertComplianceReportHistoryStmt    : conn.prepareStatement(INSERT_COMPLIANCE_REPORT_HISTORY_SQL),
        insertTransactionStmt                : conn.prepareStatement(INSERT_TRANSACTION_SQL),
        updateComplianceReportTransactionStmt: conn.prepareStatement(UPDATE_COMPLIANCE_REPORT_TRANSACTION_SQL)
    ]
}

/**
 * Inserts a compliance report into LCFS.
 * @param stmt PreparedStatement for inserting compliance_report.
 * @param report Compliance report data.
 * @param groupUuid Group UUID as string.
 * @param version Version number.
 * @param supplementalInitiator Supplemental initiator type.
 * @param reportingFrequency Reporting frequency.
 * @param currentStatusId Mapped status ID.
 * @param createUser Display name of the creator.
 * @param updateUser Display name of the updater.
 * @return Inserted compliance_report_id.
 */
def insertComplianceReport(PreparedStatement stmt, Map report, String groupUuid, int version, String supplementalInitiator, String reportingFrequency, Integer currentStatusId, String createUser, String updateUser) {
    // Generate nickname based on version
    def nickname = (version == 0) ? "Original Report" : "Supplemental Report ${version}"
    
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
    stmt.setString(8, nickname)
    stmt.setString(9, report.supplemental_note)
    stmt.setString(10, createUser)
    stmt.setTimestamp(11, report.create_timestamp ?: Timestamp.valueOf("1970-01-01 00:00:00"))
    stmt.setString(12, updateUser)
    stmt.setTimestamp(13, report.update_timestamp ?: report.create_timestamp ?: Timestamp.valueOf("1970-01-01 00:00:00"))
    stmt.setInt(14, report.compliance_report_id)

    def rs = null
    try {
        rs = stmt.executeQuery()
        if (rs.next()) {
            def insertedId = rs.getInt('compliance_report_id')
            return insertedId
        }
    } catch (Exception e) {
        log.error("Failed to insert compliance report for compliance_report_id: ${report.compliance_report_id}", e)
    } finally {
        if (rs != null) rs.close()
    }
    return null
}

/**
 * Inserts compliance report history records into LCFS.
 * @param lcfsReportId Inserted compliance_report_id in LCFS.
 * @param historyRecords List of history records.
 * @param historyStmt PreparedStatement for inserting compliance_report_history.
 * @param referenceData Reference data for status mapping.
 * @param userProfiles Map of user_id to display_name.
 * @return Number of history records inserted.
 */
def insertComplianceReportHistory(Integer lcfsReportId, List historyRecords,
                                  PreparedStatement historyStmt,
                                  Map referenceData,
                                  Map userProfiles) {
    int count = 0
    if (!historyRecords) return count

    historyRecords.each { h ->
        def statusId = mapCurrentStatus(
            h.fuel_supplier_status_id,
            h.analyst_status_id,
            h.manager_status_id,
            h.director_status_id,
            referenceData,
            [] // Pass an empty list to prevent recursive history processing
        )

        if (statusId == null) {
            // Skip history with no mapped status
            return
        }

        // Convert create_timestamp from String to Timestamp
        def timestamp = h.create_timestamp ? Timestamp.from(OffsetDateTime.parse(h.create_timestamp).toInstant()) : Timestamp.valueOf("1970-01-01 00:00:00")

        def userProfileId = h.create_user_id

        def reportCreateUser = userProfiles[h.create_user_id] ?: "imported_user"
        def reportUpdateUser = userProfiles[h.update_user_id] ?: reportCreateUser

        try {
            historyStmt.setInt(1, lcfsReportId)
            historyStmt.setInt(2, statusId)

            historyStmt.setInt(3, userProfileId)

            historyStmt.setString(4, reportCreateUser)
            historyStmt.setTimestamp(5, timestamp)
            historyStmt.setString(6, reportUpdateUser)
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

/**
 * Inserts a transaction into LCFS.
 * @param stmt PreparedStatement for inserting transaction.
 * @param orgId Organization ID.
 * @param quantity Number of compliance units.
 * @param action Transaction action type.
 * @param createUser Display name of the creator.
 * @param createDate Creation timestamp.
 * @param effectiveDate Effective date of the transaction.
 * @return Inserted transaction_id or null.
 */
def insertTransactionForReport(PreparedStatement stmt, Integer orgId, int quantity, String action, String createUser, Timestamp createDate, Timestamp effectiveDate = null) {
    if (orgId == null) {
        log.error("Organization ID is null. Cannot insert transaction.")
        return null
    }

    def effDate = effectiveDate ?: createDate ?: Timestamp.valueOf("1970-01-01 00:00:00")

    stmt.setInt(1, quantity)
    stmt.setInt(2, orgId)
    stmt.setString(3, action)
    stmt.setTimestamp(4, effDate)
    stmt.setString(5, createUser)
    stmt.setTimestamp(6, createDate ?: Timestamp.valueOf("1970-01-01 00:00:00"))

    def rs = null
    try {
        rs = stmt.executeQuery()
        if (rs.next()) {
            return rs.getInt('transaction_id')
        }
    } catch (Exception e) {
        log.error("Failed to insert transaction for compliance_report_id", e)
    } finally {
        if (rs != null) rs.close()
    }
    return null
}

/**
 * Updates a compliance report with the associated transaction ID.
 * @param conn Destination database connection.
 * @param lcfsReportId Compliance report ID in LCFS.
 * @param transactionId Transaction ID to associate.
 */
def updateComplianceReportWithTransaction(Connection conn, int lcfsReportId, int transactionId) {
    def updateStmt = conn.prepareStatement("UPDATE compliance_report SET transaction_id = ? WHERE compliance_report_id = ?")
    try {
        updateStmt.setInt(1, transactionId)
        updateStmt.setInt(2, lcfsReportId)
        updateStmt.executeUpdate()
    } catch (Exception e) {
        log.error("Failed to update compliance_report with transaction_id: ${transactionId} for lcfsReportId: ${lcfsReportId}", e)
    } finally {
        updateStmt.close()
    }
}

// =========================================
// Script Termination
// =========================================

log.warn("**** COMPLETED COMPLIANCE REPORT ETL ****")
