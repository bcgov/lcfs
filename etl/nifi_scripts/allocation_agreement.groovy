/*
Migrate Allocation Agreements from TFRS to LCFS

1. Finds all LCFS compliance reports having a TFRS legacy_id.
2. For each TFRS compliance report, determines its chain (root_report_id).
3. Retrieves allocation agreement records for each version in the chain.
4. Computes a diff (CREATE / UPDATE) between consecutive versions.
5. Inserts rows in allocation_agreement with a stable, random group_uuid (UUID) per agreement record.
6. Versions these allocation_agreement entries so that subsequent changes increment the version.
7. Logs the actions taken for easier traceability.
*/

import groovy.transform.Field
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.util.UUID

@Field
Map < Integer, String > recordUuidMap = [: ]

@Field
String SELECT_LCFS_IMPORTED_REPORTS_QUERY = '''
SELECT compliance_report_id, legacy_id
FROM compliance_report
WHERE legacy_id IS NOT NULL
'''

@Field
String SELECT_ROOT_REPORT_ID_QUERY = '''
SELECT root_report_id
FROM compliance_report
WHERE id = ?
'''

@Field
String SELECT_REPORT_CHAIN_QUERY = '''
SELECT
c.id AS tfrs_report_id,
  c.traversal
FROM compliance_report c
WHERE c.root_report_id = ?
  ORDER BY c.traversal, c.id '''

@Field
String SELECT_ALLOCATION_AGREEMENTS_QUERY = """
SELECT
crear.id AS agreement_record_id,
  case when tt.the_type = 'Purchased'
then 'Allocated from'
else 'Allocated to'
end as responsibility,
aft.name as fuel_type,
  aft.id as fuel_type_id,
  crear.transaction_partner,
  crear.postal_address,
  crear.quantity,
  uom.name as units,
  crear.quantity_not_sold,
  tt.id as transaction_type_id
FROM compliance_report cr
INNER JOIN compliance_report_exclusion_agreement crea
ON cr.exclusion_agreement_id = crea.id
INNER JOIN compliance_report_exclusion_agreement_record crear
ON crear.exclusion_agreement_id = crea.id
INNER JOIN transaction_type tt
ON crear.transaction_type_id = tt.id
INNER JOIN approved_fuel_type aft
ON crear.fuel_type_id = aft.id
INNER JOIN unit_of_measure uom
ON aft.unit_of_measure_id = uom.id
WHERE cr.id = ?
  AND cr.exclusion_agreement_id is not null
ORDER BY crear.id """

@Field
String SELECT_LCFS_COMPLIANCE_REPORT_BY_TFRSID_QUERY = '''
SELECT compliance_report_id
FROM compliance_report
WHERE legacy_id = ? '''

@Field
String SELECT_CURRENT_VERSION_QUERY = '''
SELECT version
FROM allocation_agreement
WHERE group_uuid = ?
  ORDER BY version DESC
LIMIT 1 '''

@Field
String INSERT_ALLOCATION_AGREEMENT_SQL = '''
INSERT INTO allocation_agreement(
  compliance_report_id,
  transaction_partner,
  postal_address,
  quantity,
  quantity_not_sold,
  units,
  allocation_transaction_type_id,
  fuel_type_id,
  fuel_category_id,
  group_uuid,
  version,
  action_type
) VALUES( ?
  , ?
  , ?
  , ?
  , ?
  , ?
  , ?
  , ?
  , ?
  , ?
  , ?
  , ?::actiontypeenum
)
'''
@Field
Map<String, Integer> responsibilityToTransactionTypeCache = [:]

@Field
Map<String, Integer> fuelTypeNameToIdCache = [:]

@Field
String SELECT_TRANSACTION_TYPE_ID_QUERY = """
    SELECT allocation_transaction_type_id 
    FROM allocation_transaction_type 
    WHERE type = ?
"""

@Field
String SELECT_FUEL_TYPE_ID_QUERY = """
    SELECT fuel_type_id 
    FROM fuel_type 
    WHERE fuel_type = ?
"""
// =========================================
// NiFi Controller Services
// =========================================
def sourceDbcpService = context.controllerServiceLookup.getControllerService('3245b078-0192-1000-ffff-ffffba20c1eb')
def destinationDbcpService = context.controllerServiceLookup.getControllerService('3244bf63-0192-1000-ffff-ffffc8ec6d93')

// =========================================
// Helper Functions
// =========================================

/**
 * Checks if any relevant fields in an allocation agreement record differ between old and new.
 */
def isRecordChanged(Map oldRow, Map newRow) {
  if (oldRow == null || newRow == null) return true

  if (oldRow.quantity?.compareTo(newRow.quantity) != 0) return true
  if (oldRow.quantity_not_sold?.compareTo(newRow.quantity_not_sold) != 0) return true
  if (oldRow.transaction_type_id != newRow.transaction_type_id) return true
  if (oldRow.fuel_type_id != newRow.fuel_type_id) return true
  if (oldRow.transaction_partner != newRow.transaction_partner) return true
  if (oldRow.postal_address != newRow.postal_address) return true
  if (oldRow.units != newRow.units) return true

  return false
}

/**
 * Gets allocation transaction type ID from cache or database if not cached
 */
def getTransactionTypeId(Connection destConn, String responsibility) {
    // Check if we already have this value cached
    if (responsibilityToTransactionTypeCache.containsKey(responsibility)) {
        return responsibilityToTransactionTypeCache[responsibility]
    }
    
    // Not in cache, query the database
    PreparedStatement stmt = null
    ResultSet rs = null
    try {
        stmt = destConn.prepareStatement(SELECT_TRANSACTION_TYPE_ID_QUERY)
        stmt.setString(1, responsibility)
        rs = stmt.executeQuery()
        
        if (rs.next()) {
            int typeId = rs.getInt("allocation_transaction_type_id")
            // Cache for future use
            responsibilityToTransactionTypeCache[responsibility] = typeId
            return typeId
        } else {
            log.warn("No transaction type found for responsibility: ${responsibility}")
            return 1 // Default value
        }
    } finally {
        if (rs != null) rs.close()
        if (stmt != null) stmt.close()
    }
}

/**
 * Gets fuel type ID from cache or database if not cached
 */
def getFuelTypeId(Connection destConn, String fuelType) {
    // Check if we already have this value cached
    if (fuelTypeNameToIdCache.containsKey(fuelType)) {
        return fuelTypeNameToIdCache[fuelType]
    }
    
    // Not in cache, query the database
    PreparedStatement stmt = null
    ResultSet rs = null
    try {
        stmt = destConn.prepareStatement(SELECT_FUEL_TYPE_ID_QUERY)
        stmt.setString(1, fuelType)
        rs = stmt.executeQuery()
        
        if (rs.next()) {
            int typeId = rs.getInt("fuel_type_id")
            // Cache for future use
            fuelTypeNameToIdCache[fuelType] = typeId
            return typeId
        } else {
            log.warn("No fuel type found for: ${fuelType}")
            return 1 // Default value
        }
    } finally {
        if (rs != null) rs.close()
        if (stmt != null) stmt.close()
    }
}
/**
 * Inserts a new row in allocation_agreement with action=CREATE/UPDATE
 * We always do version = oldVersion + 1 or 0 if none yet.
 */
def insertVersionRow(Connection destConn, Integer lcfsCRid, Map rowData, String action) {
  def recordId = rowData.agreement_record_id

  // Retrieve or generate the stable random group uuid for this record
  def groupUuid = recordUuidMap[recordId]
  if (!groupUuid) {
    groupUuid = UUID.randomUUID().toString()
    recordUuidMap[recordId] = groupUuid
  }

  // Find current highest version in allocation_agreement for that group_uuid
  def currentVer = -1
  PreparedStatement verStmt = destConn.prepareStatement(SELECT_CURRENT_VERSION_QUERY)
  verStmt.setString(1, groupUuid)
  ResultSet verRS = verStmt.executeQuery()
  if (verRS.next()) {
    currentVer = verRS.getInt('version')
  }
  verRS.close()
  verStmt.close()

  def nextVer = (currentVer < 0) ? 0 : currentVer + 1

  // Map TFRS fields => LCFS fields
  def allocTransactionTypeId = getTransactionTypeId(destConn, rowData.responsibility)
  def fuelTypeId = getFuelTypeId(destConn, rowData.fuel_type)
  def quantity = rowData.quantity ?: 0
  def quantityNotSold = rowData.quantity_not_sold ?: 0
  def transactionPartner = rowData.transaction_partner ?: ''
  def postalAddress = rowData.postal_address ?: ''
  def units = rowData.units ?: ''

  // Insert the new row
  PreparedStatement insStmt = destConn.prepareStatement(INSERT_ALLOCATION_AGREEMENT_SQL)
  insStmt.setInt(1, lcfsCRid)
  insStmt.setString(2, transactionPartner)
  insStmt.setString(3, postalAddress)
  insStmt.setInt(4, quantity)
  insStmt.setInt(5, quantityNotSold)
  insStmt.setString(6, units)
  insStmt.setInt(7, allocTransactionTypeId)
  insStmt.setInt(8, fuelTypeId)
  insStmt.setNull(9, java.sql.Types.INTEGER)
  insStmt.setString(10, groupUuid)
  insStmt.setInt(11, nextVer)
  insStmt.setString(12, action)
  insStmt.executeUpdate()
  insStmt.close()

  log.info(" -> allocation_agreement row: recordId=${recordId}, action=${action}, groupUuid=${groupUuid}, version=${nextVer}")
}

// =========================================
// Main Execution
// =========================================

log.warn('**** BEGIN ALLOCATION AGREEMENT MIGRATION ****')

Connection sourceConn = null
Connection destinationConn = null

try {
  sourceConn = sourceDbcpService.getConnection()
  destinationConn = destinationDbcpService.getConnection()

  // 1) Find all LCFS compliance reports that have TFRS legacy_id
  log.info('Retrieving LCFS compliance_report with legacy_id != null')
  PreparedStatement lcfsStmt = destinationConn.prepareStatement(SELECT_LCFS_IMPORTED_REPORTS_QUERY)
  ResultSet lcfsRS = lcfsStmt.executeQuery()

  def tfrsIds = []
  while (lcfsRS.next()) {
    def tfrsId = lcfsRS.getInt('legacy_id')
    tfrsIds << tfrsId
  }
  lcfsRS.close()
  lcfsStmt.close()

  // For each TFRS compliance_report ID, follow the chain approach
  tfrsIds.each {
    tfrsId ->
      log.info("Processing TFRS compliance_report.id = ${tfrsId}")

    // 2) Find the root_report_id
    PreparedStatement rootStmt = sourceConn.prepareStatement(SELECT_ROOT_REPORT_ID_QUERY)
    rootStmt.setInt(1, tfrsId)
    def rootRS = rootStmt.executeQuery()
    def rootId = null
    if (rootRS.next()) {
      rootId = rootRS.getInt('root_report_id')
    }
    rootRS.close()
    rootStmt.close()

    if (!rootId) {
      log.warn("No root_report_id found for TFRS #${tfrsId}; skipping.")
      return
    }

    // 3) Gather the chain in ascending order
    PreparedStatement chainStmt = sourceConn.prepareStatement(SELECT_REPORT_CHAIN_QUERY)
    chainStmt.setInt(1, rootId)
    def chainRS = chainStmt.executeQuery()

    def chainIds = []
    while (chainRS.next()) {
      chainIds << chainRS.getInt('tfrs_report_id')
    }
    chainRS.close()
    chainStmt.close()

    if (chainIds.isEmpty()) {
      log.warn("Chain empty for root=${rootId}? skipping.")
      return
    }

    // Keep the old version's allocation agreement data in memory so we can do diffs
    Map < Integer, Map > previousRecords = [: ]

    chainIds.eachWithIndex {
      chainTfrsId,
      idx -> log.info("TFRS #${chainTfrsId} (chain idx=${idx})")

      // 4) Fetch current TFRS allocation agreement records
      Map < Integer,
      Map > currentRecords = [: ]
      PreparedStatement alocStmt = sourceConn.prepareStatement(SELECT_ALLOCATION_AGREEMENTS_QUERY)
      alocStmt.setInt(1, chainTfrsId)
      ResultSet alocRS = alocStmt.executeQuery()
      while (alocRS.next()) {
        def recId = alocRS.getInt('agreement_record_id')
        currentRecords[recId] = [
          agreement_record_id: recId,
          responsibility: alocRS.getString('responsibility'),
          fuel_type: alocRS.getString('fuel_type'),
          transaction_partner: alocRS.getString('transaction_partner'),
          postal_address: alocRS.getString('postal_address'),
          quantity: alocRS.getInt('quantity'),
          units: alocRS.getString('units'),
          quantity_not_sold: alocRS.getInt('quantity_not_sold'),
          transaction_type_id: alocRS.getInt('transaction_type_id')
        ]
      }
      alocRS.close()
      alocStmt.close()

      // 5) Find the matching LCFS compliance_report
      Integer lcfsCRid = null
      PreparedStatement findCRstmt = destinationConn.prepareStatement(SELECT_LCFS_COMPLIANCE_REPORT_BY_TFRSID_QUERY)
      findCRstmt.setInt(1, chainTfrsId)
      ResultSet findCRrs = findCRstmt.executeQuery()
      if (findCRrs.next()) {
        lcfsCRid = findCRrs.getInt('compliance_report_id')
      }
      findCRrs.close()
      findCRstmt.close()

      if (!lcfsCRid) {
        log.warn("TFRS #${chainTfrsId} not found in LCFS? Skipping diff, just storing previousRecords.")
        previousRecords = currentRecords
        return
      }

      // Compare old vs new

      // A) For each record in currentRecords
      currentRecords.each {
        recId,
        newData ->
        if (!previousRecords.containsKey(recId)) {
          // wasn't in old => CREATE
          insertVersionRow(destinationConn, lcfsCRid, newData, 'CREATE')
        } else {
          // existed => check if changed
          def oldData = previousRecords[recId]
          if (isRecordChanged(oldData, newData)) {
            insertVersionRow(destinationConn, lcfsCRid, newData, 'UPDATE')
          }
        }
      }

      // Update previousRecords for the next version
      previousRecords = currentRecords
    } // end chain loop
  } // end each tfrsId
} catch (Exception e) {
  log.error('Error running allocation agreement migration', e)
  throw e
} finally {
  if (sourceConn != null) sourceConn.close()
  if (destinationConn != null) destinationConn.close()
}

log.warn('**** DONE: ALLOCATION AGREEMENT MIGRATION ****')
