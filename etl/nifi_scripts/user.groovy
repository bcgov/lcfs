import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet

// SQL query to extract user profiles
def userProfileQuery = """
    SELECT id as user_profile_id,
           keycloak_user_id,
           email as keycloak_email,
           username as keycloak_username,
           email,
           title,
           phone,
           cell_phone as mobile_phone,
           first_name,
           last_name,
           is_active,
           CASE WHEN organization_id = 1 THEN null ELSE organization_id END as organization_id
    FROM public.user;
"""

// SQL query to extract user roles
def userRoleQuery = """
    SELECT ur.user_id as user_profile_id,
           CASE
               WHEN r.name = 'Admin' THEN 'ADMINISTRATOR'
               WHEN r.name = 'GovUser' THEN 'ANALYST'
               WHEN r.name IN ('GovDirector', 'GovDeputyDirector') THEN 'DIRECTOR'
               WHEN r.name = 'GovComplianceManager' THEN 'COMPLIANCE_MANAGER'
               WHEN r.name = 'FSAdmin' THEN 'MANAGE_USERS'
               WHEN r.name = 'FSUser' THEN 'TRANSFER'
               WHEN r.name = 'FSManager' THEN 'SIGNING_AUTHORITY'
               WHEN r.name = 'FSNoAccess' THEN 'READ_ONLY'
               WHEN r.name = 'ComplianceReporting' THEN 'COMPLIANCE_REPORTING'
               ELSE NULL
           END AS role_name
    FROM public.user u
    INNER JOIN user_role ur ON ur.user_id = u.id
    INNER JOIN role r ON r.id = ur.role_id
    WHERE r.name NOT IN ('FSDocSubmit', 'GovDoc');
"""

// SQL queries to insert user profiles and roles into destination tables with ON CONFLICT handling
def insertUserProfileSQL = """
    INSERT INTO user_profile (user_profile_id, keycloak_user_id, keycloak_email, keycloak_username, email, title, phone, mobile_phone, first_name, last_name, is_active, organization_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (user_profile_id) DO UPDATE
    SET keycloak_user_id = EXCLUDED.keycloak_user_id,
        keycloak_email = EXCLUDED.keycloak_email,
        keycloak_username = EXCLUDED.keycloak_username,
        email = EXCLUDED.email,
        title = EXCLUDED.title,
        phone = EXCLUDED.phone,
        mobile_phone = EXCLUDED.mobile_phone,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        is_active = EXCLUDED.is_active,
        organization_id = EXCLUDED.organization_id;
"""

def insertUserRoleSQL = """
    INSERT INTO user_role (user_profile_id, role_id)
    VALUES (?, (SELECT role_id FROM role WHERE name = ?::role_enum))
    ON CONFLICT (user_profile_id, role_id) DO NOTHING;
"""

// Fetch connections to both source and destination databases
def sourceDbcpService = context.controllerServiceLookup.getControllerService("3245b078-0192-1000-ffff-ffffba20c1eb")
def destinationDbcpService = context.controllerServiceLookup.getControllerService("3244bf63-0192-1000-ffff-ffffc8ec6d93")

Connection sourceConn = null
Connection destinationConn = null

try {
    // Get connections
    sourceConn = sourceDbcpService.getConnection()
    destinationConn = destinationDbcpService.getConnection()

    // Step 1: Extract User Profile Data
    PreparedStatement sourceProfileStmt = sourceConn.prepareStatement(userProfileQuery)
    ResultSet userProfileResultSet = sourceProfileStmt.executeQuery()

    // Prepare the destination SQL for inserting/updating user profiles
    PreparedStatement insertUserProfileStmt = destinationConn.prepareStatement(insertUserProfileSQL)
    PreparedStatement insertUserRoleStmt = destinationConn.prepareStatement(insertUserRoleSQL)

    // Process the result set for user profiles
    while (userProfileResultSet.next()) {
        def userProfileId = userProfileResultSet.getInt("user_profile_id")
        def keycloakUserId = userProfileResultSet.getString("keycloak_user_id")
        def keycloakEmail = userProfileResultSet.getString("keycloak_email")
        def keycloakUsername = userProfileResultSet.getString("keycloak_username")
        def email = userProfileResultSet.getString("email")
        def title = userProfileResultSet.getString("title")
        def phone = userProfileResultSet.getString("phone")
        def mobilePhone = userProfileResultSet.getString("mobile_phone")
        def firstName = userProfileResultSet.getString("first_name")
        def lastName = userProfileResultSet.getString("last_name")
        def isActive = userProfileResultSet.getBoolean("is_active")
        def organizationId = userProfileResultSet.getObject("organization_id") // Nullable

        // Bind values to the prepared statement
        insertUserProfileStmt.setInt(1, userProfileId)
        insertUserProfileStmt.setString(2, keycloakUserId)
        insertUserProfileStmt.setString(3, keycloakEmail)
        insertUserProfileStmt.setString(4, keycloakUsername)
        insertUserProfileStmt.setString(5, email)
        insertUserProfileStmt.setString(6, title)
        insertUserProfileStmt.setString(7, phone)
        insertUserProfileStmt.setString(8, mobilePhone)
        insertUserProfileStmt.setString(9, firstName)
        insertUserProfileStmt.setString(10, lastName)
        insertUserProfileStmt.setBoolean(11, isActive)
        insertUserProfileStmt.setObject(12, organizationId) // Handle nulls correctly

        // Execute the insert/update for user profiles
        insertUserProfileStmt.executeUpdate()
        // Step 2: Insert user role based on organization_id
        if (organizationId == null) {
            // If organization_id is null, assign 'GOVERNMENT' role
            insertUserRoleStmt.setInt(1, userProfileId)
            insertUserRoleStmt.setString(2, 'GOVERNMENT')
        } else {
            // If organization_id is not null, assign 'SUPPLIER' role
            insertUserRoleStmt.setInt(1, userProfileId)
            insertUserRoleStmt.setString(2, 'SUPPLIER')
        }

        // Execute the insert for the user role
        insertUserRoleStmt.executeUpdate()
    }

    // Step 3: Extract User Role Data
    PreparedStatement sourceRoleStmt = sourceConn.prepareStatement(userRoleQuery)
    ResultSet userRoleResultSet = sourceRoleStmt.executeQuery()

    // Process the result set for user roles
    while (userRoleResultSet.next()) {
        def userProfileId = userRoleResultSet.getInt("user_profile_id")
        def roleName = userRoleResultSet.getString("role_name")

        // Bind values to the prepared statement
        insertUserRoleStmt.setInt(1, userProfileId)
        insertUserRoleStmt.setString(2, roleName)

        // Execute the insert/update for user roles
        insertUserRoleStmt.executeUpdate()
    }

} catch (Exception e) {
    log.error("Error occurred while processing data", e)
} finally {
    // Close the connections
    if (sourceConn != null) sourceConn.close()
    if (destinationConn != null) destinationConn.close()
}
