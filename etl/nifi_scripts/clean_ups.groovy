import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.SQLException

log.warn('**** STARTING TRANSFER UPDATE SQL ****')

// SQL query to update transaction_effective_date
def updateTransferEffectiveDateSQL = """
    -- Update transaction_effective_date by subtracting one day
    UPDATE public.transfer
    SET transaction_effective_date = transaction_effective_date - INTERVAL '1 day'
    WHERE update_date::time < '07:00:00'                -- Only updates before 7 AM
      AND update_date::date = transaction_effective_date::date; -- On the same day as transaction_effective_date
"""

// Cleanup queries
def cleanUpQueries = [
    """
    -- 105
    UPDATE "transaction"
    SET compliance_units = -6994
    WHERE transaction_id = 1491;
    """,
    """
    -- 273
    UPDATE compliance_report
    SET transaction_id = null
    WHERE compliance_report_id = 764;
    """,
    """
    DELETE FROM "transaction"
    WHERE transaction_id = 1920;
    """
]

// Fetch connection to the destination database
def destinationDbcpService = context.controllerServiceLookup.getControllerService('3244bf63-0192-1000-ffff-ffffc8ec6d93')
Connection destinationConn = null

try {
    // Obtain a connection from the Destination DBCP Connection Pool
    destinationConn = destinationDbcpService.getConnection()
    destinationConn.setAutoCommit(false)  // Begin transaction

    // Step 1: Execute the UPDATE on public.transfer
    try (PreparedStatement updateStmt = destinationConn.prepareStatement(updateTransferEffectiveDateSQL)) {
        int rowsUpdated = updateStmt.executeUpdate()
        log.info("Successfully executed UPDATE on 'public.transfer'. Rows affected: ${rowsUpdated}")
    }

    // Step 2: Execute the cleanup queries in sequence
    cleanUpQueries.each { query ->
        try (PreparedStatement stmt = destinationConn.prepareStatement(query)) {
            stmt.executeUpdate()
        }
    }
    log.info("Cleanup queries executed successfully.")

    // Commit transaction
    destinationConn.commit()
    log.info("Transaction committed successfully.")

} catch (Exception e) {
    // Rollback transaction on error
    if (destinationConn != null) {
        try {
            destinationConn.rollback()
            log.warn("Transaction rolled back due to error.")
        } catch (SQLException rollbackEx) {
            log.error("Error occurred during transaction rollback", rollbackEx)
        }
    }
    log.error('Error occurred during SQL operations', e)
    throw new RuntimeException(e)
} finally {
    // Ensure the connection is closed
    if (destinationConn != null) {
        try {
            destinationConn.close()
            log.info("Database connection closed.")
        } catch (SQLException closeEx) {
            log.warn("Error occurred while closing the database connection", closeEx)
        }
    }
}

log.warn('**** COMPLETED TRANSFER UPDATE SQL ****')
