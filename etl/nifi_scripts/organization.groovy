import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet

// SQL query to fetch data from the source
def sourceQuery = """
    SELECT
        o.id as organization_id,
        o.name,
        cast(null as varchar) as operating_name,
        cast(null as varchar) as email,
        cast(null as varchar) as phone,
        o.edrms_record,
        (
            case
                when os.status = 'Archived' then 'Suspended'
                when oat.the_type = 'Buy And Sell' or oat.the_type = 'Sell Only' then 'Registered'
                else 'Unregistered'
            end
        ) as org_status,
        'fuel_supplier' as organization_type,
        oa.address_line_1 as service_street_address,
        oa.address_line_2 as service_address_other,
        oa.city as service_city,
        oa.state as service_province_state,
        oa.postal_code as "service_postalCode_zipCode",
        oa.country as service_country,
        oa.attorney_street_address,
        oa.attorney_address_other,
        oa.attorney_city as attorney_city,
        oa.attorney_province as attorney_province_state,
        oa.attorney_postal_code as "attorney_postalCode_zipCode",
        oa.attorney_country as attorney_country
    FROM
        organization o
        INNER JOIN organization_status os ON os.id = o.status_id
        INNER JOIN organization_actions_type oat ON oat.id = o.actions_type_id
        INNER JOIN organization_address oa ON oa.organization_id = o.id;
"""

// SQL queries to fetch the status and type IDs from the destination database
def getStatusIdQuery = "SELECT organization_status_id FROM organization_status WHERE status = ?"
def getTypeIdQuery = "SELECT organization_type_id FROM organization_type WHERE org_type = ?"

// SQL queries to backup existing records from the destination
def backupOrganizationSQL = "SELECT * FROM organization"
def backupOrganizationAddressSQL = "SELECT * FROM organization_address"
def backupAttorneyAddressSQL = "SELECT * FROM organization_attorney_address"

// Fetch connections to both the source and destination databases
def sourceDbcpService = context.controllerServiceLookup.getControllerService("TFRS")
def destinationDbcpService = context.controllerServiceLookup.getControllerService("LCFS")

Connection sourceConn = null
Connection destinationConn = null

try {
    // Get connections
    sourceConn = sourceDbcpService.getConnection()
    destinationConn = destinationDbcpService.getConnection()

    // Step 1: Backup existing records from the destination tables
    List<Map<String, Object>> organizationBackup = []
    List<Map<String, Object>> organizationAddressBackup = []
    List<Map<String, Object>> attorneyAddressBackup = []

    // Backup organization table
    PreparedStatement backupOrgStmt = destinationConn.prepareStatement(backupOrganizationSQL)
    ResultSet orgBackupRS = backupOrgStmt.executeQuery()
    while (orgBackupRS.next()) {
        organizationBackup.add([
            organization_id: orgBackupRS.getInt("organization_id"),
            name: orgBackupRS.getString("name"),
            operating_name: orgBackupRS.getString("operating_name"),
            email: orgBackupRS.getString("email"),
            phone: orgBackupRS.getString("phone"),
            edrms_record: orgBackupRS.getString("edrms_record"),
            organization_status_id: orgBackupRS.getInt("organization_status_id"),
            organization_type_id: orgBackupRS.getInt("organization_type_id")
        ])
    }

    // Backup organization_address table
    PreparedStatement backupAddressStmt = destinationConn.prepareStatement(backupOrganizationAddressSQL)
    ResultSet addressBackupRS = backupAddressStmt.executeQuery()
    while (addressBackupRS.next()) {
        organizationAddressBackup.add([
            organization_address_id: addressBackupRS.getInt("organization_address_id"),
            street_address: addressBackupRS.getString("street_address"),
            address_other: addressBackupRS.getString("address_other"),
            city: addressBackupRS.getString("city"),
            province_state: addressBackupRS.getString("province_state"),
            postalCode_zipCode: addressBackupRS.getString("postalCode_zipCode"),
            country: addressBackupRS.getString("country"),
            organization_id: addressBackupRS.getInt("organization_id")
        ])
    }

    // Backup organization_attorney_address table
    PreparedStatement backupAttorneyAddressStmt = destinationConn.prepareStatement(backupAttorneyAddressSQL)
    ResultSet attorneyBackupRS = backupAttorneyAddressStmt.executeQuery()
    while (attorneyBackupRS.next()) {
        attorneyAddressBackup.add([
            organization_attorney_address_id: attorneyBackupRS.getInt("organization_attorney_address_id"),
            street_address: attorneyBackupRS.getString("street_address"),
            address_other: attorneyBackupRS.getString("address_other"),
            city: attorneyBackupRS.getString("city"),
            province_state: attorneyBackupRS.getString("province_state"),
            postalCode_zipCode: attorneyBackupRS.getString("postalCode_zipCode"),
            country: attorneyBackupRS.getString("country"),
            organization_id: attorneyBackupRS.getInt("organization_id")
        ])
    }

    // Step 2: Insert new records from the source database
    // Prepare statements for fetching org_status_id and organization_type_id
    PreparedStatement statusStmt = destinationConn.prepareStatement(getStatusIdQuery)
    PreparedStatement typeStmt = destinationConn.prepareStatement(getTypeIdQuery)

    // Execute the query on the source database
    PreparedStatement sourceStmt = sourceConn.prepareStatement(sourceQuery)
    ResultSet resultSet = sourceStmt.executeQuery()

    // Insert data into the destination tables
    while (resultSet.next()) {
        def organizationId = resultSet.getInt("organization_id")
        def name = resultSet.getString("name")
        def operatingName = resultSet.getString("operating_name")
        def email = resultSet.getString("email")
        def phone = resultSet.getString("phone")
        def edrmsRecord = resultSet.getString("edrms_record")
        def orgStatusChar = resultSet.getString("org_status")
        def orgTypeChar = resultSet.getString("organization_type")
        def serviceStreetAddress = resultSet.getString("service_street_address")
        def serviceAddressOther = resultSet.getString("service_address_other")
        def serviceCity = resultSet.getString("service_city")
        def serviceProvinceState = resultSet.getString("service_province_state")
        def servicePostalCodeZipCode = resultSet.getString("service_postalCode_zipCode")
        def serviceCountry = resultSet.getString("service_country")
        def attorneyStreetAddress = resultSet.getString("attorney_street_address")
        def attorneyAddressOther = resultSet.getString("attorney_address_other")
        def attorneyCity = resultSet.getString("attorney_city")
        def attorneyProvinceState = resultSet.getString("attorney_province_state")
        def attorneyPostalCodeZipCode = resultSet.getString("attorney_postalCode_zipCode")
        def attorneyCountry = resultSet.getString("attorney_country")

        // Fetch organization_status_id and organization_type_id
        statusStmt.setString(1, orgStatusChar)
        ResultSet statusResult = statusStmt.executeQuery()
        def orgStatusId = statusResult.next() ? statusResult.getInt("organization_status_id") : null

        typeStmt.setString(1, orgTypeChar)
        ResultSet typeResult = typeStmt.executeQuery()
        def orgTypeId = typeResult.next() ? typeResult.getInt("organization_type_id") : null

        if (orgStatusId == null || orgTypeId == null) {
            log.error("Failed to map organization status or type for record: " + organizationId)
            continue
        }

        // Insert into the organization table
        def insertOrganizationSQL = """
            INSERT INTO organization (
                organization_id, name, operating_name, email, phone, edrms_record, organization_status_id, organization_type_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """
        PreparedStatement insertOrgStmt = destinationConn.prepareStatement(insertOrganizationSQL)
        insertOrgStmt.setInt(1, organizationId)
        insertOrgStmt.setString(2, name)
        insertOrgStmt.setString(3, operatingName)
        insertOrgStmt.setString(4, email)
        insertOrgStmt.setString(5, phone)
        insertOrgStmt.setString(6, edrmsRecord)
        insertOrgStmt.setInt(7, orgStatusId)
        insertOrgStmt.setInt(8, orgTypeId)
        insertOrgStmt.executeUpdate()
    }

    // Step 3: Re-insert backed-up records with new IDs
    organizationBackup.each { org ->
        def insertOrganizationBackupSQL = """
            INSERT INTO organization (
                name, operating_name, email, phone, edrms_record, organization_status_id, organization_type_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        PreparedStatement insertOrgBackupStmt = destinationConn.prepareStatement(insertOrganizationBackupSQL)
        insertOrgBackupStmt.setString(1, org.name)
        insertOrgBackupStmt.setString(2, org.operating_name)
        insertOrgBackupStmt.setString(3, org.email)
        insertOrgBackupStmt.setString(4, org.phone)
        insertOrgBackupStmt.setString(5, org.edrms_record)
        insertOrgBackupStmt.setInt(6, org.organization_status_id)
        insertOrgBackupStmt.setInt(7, org.organization_type_id)
        insertOrgBackupStmt.executeUpdate()
    }

    // Similarly, reinsert organization_address and organization_attorney_address backups

} catch (Exception e) {
    log.error("Error occurred while processing data", e)
} finally {
    if (sourceConn != null) sourceConn.close()
    if (destinationConn != null) destinationConn.close()
}
