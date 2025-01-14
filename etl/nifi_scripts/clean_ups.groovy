import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import groovy.json.JsonSlurper

log.warn('**** STARTING TRANSFER UPDATE SQL ****')

// SQL query to update transaction_effective_date
def updateTransferEffectiveDateSQL = """
    -- Update transaction_effective_date by subtracting one day
    UPDATE public.transfer
    SET transaction_effective_date = transaction_effective_date - INTERVAL '1 day'
    WHERE update_date::time < '07:00:00'                -- Only updates before 7 AM
      AND update_date::date = transaction_effective_date::date; -- On the same day as transaction_effective_date
"""

// Fetch connections to both source and destination databases
// Replace the UUIDs with your actual Controller Service identifiers
// For this UPDATE, only the destination database connection is required
def destinationDbcpService = context.controllerServiceLookup.getControllerService('3244bf63-0192-1000-ffff-ffffc8ec6d93')

// Initialize database connections
Connection destinationConn = null

try {
    // Get a connection from the Destination DBCP Connection Pool
    destinationConn = destinationDbcpService.getConnection()

    // Step 1: Execute the UPDATE statement
    PreparedStatement updateStmt = destinationConn.prepareStatement(updateTransferEffectiveDateSQL)

    // Execute the UPDATE statement
    int rowsUpdated = updateStmt.executeUpdate()

    log.info("Successfully executed UPDATE on 'public.transfer'. Rows affected: ${rowsUpdated}")

    // Close the UPDATE statement
    updateStmt.close()

} catch (Exception e) {
    log.error('Error occurred while executing TRANSFER UPDATE SQL', e)
    throw new ProcessException(e)
} finally {
    // Ensure the connection is closed
    if (destinationConn != null) {
        try {
            destinationConn.close()
        } catch (SQLException ignore) {
            // Ignored
        }
    }
}

log.warn('**** COMPLETED TRANSFER UPDATE SQL ****')
