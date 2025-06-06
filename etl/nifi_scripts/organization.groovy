import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.util.Random

log.warn("**** STARTING ORGANIZATION ETL ****")

// SQL query to fetch data from the source
def sourceQuery = """
    SELECT
        oa.organization_id,
        o.name,
        cast(null as varchar) as operating_name,
        cast(null as varchar) as email,
        cast(null as varchar) as phone,
        coalesce(o.edrms_record, '') as edrms_record,
        (
            case
                when oat.the_type = 'Buy And Sell' or oat.the_type = 'Sell Only' then 'Registered'
                else 'Unregistered'
            end
        ) as org_status,
        'fuel_supplier' as organization_type,
        oa.address_line_1 as service_street_address,
        oa.address_line_2 as service_address_other,
        oa.city as service_city,
        case
            when upper(oa.state) SIMILAR TO '%(BC|B.C.|BRITISH COLUMBIA)%' then 'BC'
            else oa.state
        end as service_province_state,
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
        INNER JOIN organization_address oa ON oa.organization_id = o.id and oa.expiration_date is null;
"""

// SQL query to check if the record with the same organization_id already exists
def checkDuplicateQuery = "SELECT COUNT(*) FROM organization WHERE organization_id = ?"

// SQL queries to fetch the status and type IDs from the destination database
def getStatusIdQuery = "SELECT organization_status_id FROM organization_status WHERE status = ?::org_status_enum"
def getTypeIdQuery = "SELECT organization_type_id FROM organization_type WHERE org_type = ?::org_type_enum"

// SQL query to check if an organization code already exists
def checkOrganizationCodeQuery = "SELECT COUNT(*) FROM organization WHERE organization_code = ?"

// SQL query to insert new organizations with the generated code
def insertOrganizationSQL = """
    INSERT INTO organization (
        effective_status, organization_id, organization_code, name, operating_name, email, phone, edrms_record, organization_status_id, organization_type_id, organization_address_id, organization_attorney_address_id, records_address
    ) VALUES (true, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (organization_id) DO NOTHING
"""

// Fetch connections to both the source and destination databases
def sourceDbcpService = context.controllerServiceLookup.getControllerService("3245b078-0192-1000-ffff-ffffba20c1eb")
def destinationDbcpService = context.controllerServiceLookup.getControllerService("3244bf63-0192-1000-ffff-ffffc8ec6d93")

Connection sourceConn = null
Connection destinationConn = null

// Function to generate a random alphanumeric code
def generateRandomCode() {
    def chars = ('A'..'Z') + ('0'..'9')
    def random = new Random()
    return (1..4).collect { chars[random.nextInt(chars.size())] }.join('')
}

// Function to check if the generated organization code is unique
// Passing the SQL query (checkOrganizationCodeQuery) as a parameter
def isOrganizationCodeUnique(Connection conn, String code, String checkQuery) {
    PreparedStatement checkCodeStmt = conn.prepareStatement(checkQuery)
    checkCodeStmt.setString(1, code)
    ResultSet rs = checkCodeStmt.executeQuery()
    rs.next()
    return rs.getInt(1) == 0 // Return true if the count is 0, meaning the code is unique
}

try {
    // Get connections
    sourceConn = sourceDbcpService.getConnection()
    destinationConn = destinationDbcpService.getConnection()

    // Step 1: Insert new records from the source database
    // Prepare statements for fetching org_status_id and organization_type_id
    PreparedStatement statusStmt = destinationConn.prepareStatement(getStatusIdQuery)
    PreparedStatement typeStmt = destinationConn.prepareStatement(getTypeIdQuery)
    PreparedStatement checkDuplicateStmt = destinationConn.prepareStatement(checkDuplicateQuery)

    // Prepare the SQL insert statements for organization_address and organization_attorney_address
    def insertAddressSQL = """
        INSERT INTO organization_address (
            organization_address_id, name, street_address, address_other, city, province_state, "postalCode_zipCode", country, effective_status
        ) VALUES (DEFAULT, ?, ?, ?, ?, ?, ?, ?, true)
        RETURNING organization_address_id
    """

    def insertAttorneyAddressSQL = """
        INSERT INTO organization_attorney_address (
            organization_attorney_address_id, name, street_address, address_other, city, province_state, "postalCode_zipCode", country, effective_status
        ) VALUES (DEFAULT, ?, ?, ?, ?, ?, ?, ?, true)
        RETURNING organization_attorney_address_id
    """

    // Execute the query on the source database
    PreparedStatement sourceStmt = sourceConn.prepareStatement(sourceQuery)
    ResultSet resultSet = sourceStmt.executeQuery()

    while (resultSet.next()) {
        def organizationId = resultSet.getInt("organization_id")

        // Check if the organization already exists in the destination
        checkDuplicateStmt.setInt(1, organizationId)
        ResultSet duplicateResult = checkDuplicateStmt.executeQuery()
        if (duplicateResult.next() && duplicateResult.getInt(1) > 0) {
            // If a duplicate exists, skip this record
            log.info("Skipping duplicate organization with organization_id: " + organizationId)
            continue
        }

        // If no duplicate exists, proceed with the insert logic
        def name = resultSet.getString("name") ?: ""
        def operatingName = resultSet.getString("operating_name") ?: "" // not nullable string field
        def email = resultSet.getString("email") ?: ""
        def phone = resultSet.getString("phone") ?: ""
        def edrmsRecord = resultSet.getString("edrms_record") ?: ""
        def orgStatusChar = resultSet.getString("org_status") ?: ""
        def orgTypeChar = resultSet.getString("organization_type") ?: ""
        def serviceStreetAddress = resultSet.getString("service_street_address") ?: ""
        def serviceAddressOther = resultSet.getString("service_address_other") ?: ""
        def serviceCity = resultSet.getString("service_city") ?: ""
        def serviceProvinceState = resultSet.getString("service_province_state") ?: ""
        def servicePostalCodeZipCode = resultSet.getString("service_postalCode_zipCode") ?: ""
        def serviceCountry = resultSet.getString("service_country") ?: ""
        def attorneyStreetAddress = resultSet.getString("attorney_street_address") ?: ""
        def attorneyAddressOther = resultSet.getString("attorney_address_other") ?: ""
        def attorneyCity = resultSet.getString("attorney_city") ?: ""
        def attorneyProvinceState = resultSet.getString("attorney_province_state") ?: ""
        def attorneyPostalCodeZipCode = resultSet.getString("attorney_postalCode_zipCode") ?: ""
        def attorneyCountry = resultSet.getString("attorney_country") ?: ""

        // Fetch organization_status_id and organization_type_id
        statusStmt.setString(1, orgStatusChar)
        ResultSet statusResult = statusStmt.executeQuery()
        def orgStatusId = statusResult.next() ? statusResult.getInt("organization_status_id") : null

        typeStmt.setString(1, orgTypeChar)
        ResultSet typeResult = typeStmt.executeQuery()
        def orgTypeId = typeResult.next() ? typeResult.getInt("organization_type_id") : null

        // If either orgStatusId or orgTypeId is null, log and skip this record
        if (orgStatusId == null || orgTypeId == null) {
            log.error("Failed to map organization status or type for record: " + organizationId)
            continue
        }

        // Check if serviceProvinceState is "BC" or "British Columbia"
        def trimmedServiceProvince = serviceProvinceState.trim()
        boolean isBC = trimmedServiceProvince.equalsIgnoreCase("BC")

        if (isBC) {
            // If province is BC, use addresses as they are
            serviceAddressParams = [name, serviceStreetAddress, serviceAddressOther, serviceCity,
                               trimmedServiceProvince, servicePostalCodeZipCode, serviceCountry]

            attorneyAddressParams = [] // Head office

            // Combine attorney address into a single line for records_address
            def addressParts = []
            if (attorneyStreetAddress) addressParts.add(attorneyStreetAddress)
            if (attorneyAddressOther) addressParts.add(attorneyAddressOther)
            if (attorneyCity) addressParts.add(attorneyCity)
            if (attorneyProvinceState) addressParts.add(attorneyProvinceState)
            if (attorneyCountry) addressParts.add(attorneyCountry)
            if (attorneyPostalCodeZipCode) addressParts.add(attorneyPostalCodeZipCode)

            recordsAddress = addressParts.join(", ")
            log.warn("records_address", recordsAddress)
        } else {
            // If province is not BC, swap the addresses
            serviceAddressParams = [name, attorneyStreetAddress, attorneyAddressOther, attorneyCity,
                               attorneyProvinceState, attorneyPostalCodeZipCode, attorneyCountry] // Address for service

            attorneyAddressParams = [name, serviceStreetAddress, serviceAddressOther, serviceCity,
                                serviceProvinceState, servicePostalCodeZipCode, serviceCountry] // Head office address

            // records_address is set to null when not in BC
            recordsAddress = null
        }

        // Step 2: Insert service address into organization_address table
        PreparedStatement insertAddressStmt = destinationConn.prepareStatement(insertAddressSQL)
        def organizationAddressId = null

        for (int i = 0; i < serviceAddressParams.size(); i++) {
            insertAddressStmt.setString(i + 1, serviceAddressParams[i])
        }
        if (serviceAddressParams.size() > 0) {
            ResultSet addressResultSet = insertAddressStmt.executeQuery()
            if (addressResultSet.next()) {
                organizationAddressId = addressResultSet.getInt("organization_address_id")
            }
        }

        // Step 3: Insert head office address
        PreparedStatement insertAttorneyAddressStmt = destinationConn.prepareStatement(insertAttorneyAddressSQL)
        def organizationAttorneyAddressId = null

        for (int i = 0; i < attorneyAddressParams.size(); i++) {
            insertAttorneyAddressStmt.setString(i + 1, attorneyAddressParams[i])
        }
        if (attorneyAddressParams.size() > 0) {
            ResultSet attorneyAddressResultSet = insertAttorneyAddressStmt.executeQuery()
            if (attorneyAddressResultSet.next()) {
                organizationAttorneyAddressId = attorneyAddressResultSet.getInt("organization_attorney_address_id")
            }
        }

        // Step 4: Generate a unique organization_code
        def organizationCode = null
        while (true) {
            organizationCode = generateRandomCode()
            // Pass the checkOrganizationCodeQuery as a parameter
            if (isOrganizationCodeUnique(destinationConn, organizationCode, checkOrganizationCodeQuery)) {
                break
            }
        }

        // Step 5: Insert into the organization table with the generated address IDs and organization code
        PreparedStatement insertOrgStmt = destinationConn.prepareStatement(insertOrganizationSQL)
        insertOrgStmt.setInt(1, organizationId)
        insertOrgStmt.setString(2, organizationCode)  // Generated organization code
        insertOrgStmt.setString(3, name)
        insertOrgStmt.setString(4, operatingName)
        insertOrgStmt.setString(5, email)
        insertOrgStmt.setString(6, phone)
        insertOrgStmt.setString(7, edrmsRecord)
        insertOrgStmt.setInt(8, orgStatusId)
        insertOrgStmt.setInt(9, orgTypeId)
        // Address for service in BC
        if (organizationAddressId != null) {
            insertOrgStmt.setInt(10, organizationAddressId)
        } else {
            insertOrgStmt.setNull(10, java.sql.Types.INTEGER)
        }
        // Head office address ID
        if (organizationAttorneyAddressId != null) {
            insertOrgStmt.setInt(11, organizationAttorneyAddressId)
        } else {
            insertOrgStmt.setNull(11, java.sql.Types.INTEGER)
        }
        insertOrgStmt.setString(12, recordsAddress)
        insertOrgStmt.executeUpdate()
    }

} catch (Exception e) {
    log.error("Error occurred while processing data", e)
} finally {
    if (sourceConn != null) sourceConn.close()
    if (destinationConn != null) destinationConn.close()
}

log.warn("**** COMPLETED ORGANIZATION ETL ****")
