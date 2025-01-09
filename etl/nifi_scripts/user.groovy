import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import groovy.json.JsonSlurper

log.warn('**** STARTING USER ETL ****')

def userProfileQuery = """
    WITH ranked_users AS (
        SELECT 
            u.id AS user_profile_id,
            u.keycloak_user_id,
            
            -- If external_username is empty or null, make it null for easier handling
            CASE WHEN COALESCE(NULLIF(ucr.external_username, ''), NULL) IS NULL THEN NULL
                ELSE ucr.external_username
            END AS raw_external_username,

            -- Use a window function to identify duplicates within each external_username group
            ROW_NUMBER() OVER (
                PARTITION BY COALESCE(NULLIF(ucr.external_username, ''), '___EMPTY___')
                ORDER BY 
                    CASE WHEN u.keycloak_user_id IS NOT NULL THEN 0 ELSE 1 END, 
                    u.id
            ) AS occurrence,

            COALESCE(NULLIF(ucr.keycloak_email, ''), u.email) AS keycloak_email,
            COALESCE(NULLIF(u.email, ''), '') AS email,
            u.title,
            u.phone,
            u.cell_phone AS mobile_phone,
            u.first_name,
            u.last_name,
            u.is_active,
            CASE WHEN u.organization_id = 1 THEN NULL ELSE u.organization_id END AS organization_id
        FROM public.user u
        LEFT JOIN user_creation_request ucr ON ucr.user_id = u.id
    ),
    resolved_users AS (
        SELECT
            user_profile_id,
            keycloak_user_id,

            CASE 
                -- 1) No external_username => "FIXME<n>"
                WHEN raw_external_username IS NULL THEN 
                    CONCAT('FIXME', occurrence)

                -- 2) Duplicate external_username => add "_<occurrence>"
                WHEN occurrence > 1 THEN
                    CONCAT(raw_external_username, '_', occurrence)

                -- 3) Unique or first occurrence => use raw_external_username
                ELSE raw_external_username
            END AS keycloak_username,

            keycloak_email,
            email,
            title,
            phone,
            mobile_phone,
            first_name,
            last_name,
            is_active,
            organization_id
        FROM ranked_users
    )
    SELECT
        user_profile_id,
        keycloak_user_id,
        keycloak_username,
        keycloak_email,
        email,
        title,
        phone,
        mobile_phone,
        first_name,
        last_name,
        is_active,
        organization_id
    FROM resolved_users;
"""


// SQL query to extract user roles
def userRoleQuery = """
    WITH RoleData AS (
        SELECT ur.user_id AS user_profile_id,
        CASE
            -- Government Roles
            WHEN u.organization_id = 1 THEN
                CASE
                    WHEN r.name = 'Admin' THEN 'ADMINISTRATOR'
                    WHEN r.name = 'GovUser' THEN 'ANALYST'
                    WHEN r.name IN ('GovDirector', 'GovDeputyDirector') THEN 'DIRECTOR'
                    WHEN r.name = 'GovComplianceManager' THEN 'COMPLIANCE_MANAGER'
                END
            -- Supplier Roles
            WHEN u.organization_id > 1 THEN
                CASE
                    WHEN r.name = 'FSAdmin' THEN 'MANAGE_USERS'
                    WHEN r.name = 'FSUser' THEN 'TRANSFER'
                    WHEN r.name = 'FSManager' THEN 'SIGNING_AUTHORITY'
                    WHEN r.name = 'FSNoAccess' THEN 'READ_ONLY'
                    WHEN r.name = 'ComplianceReporting' THEN 'COMPLIANCE_REPORTING'
                END
        END AS role_name,
        u.organization_id
        FROM public.user u
        INNER JOIN user_role ur ON ur.user_id = u.id
        INNER JOIN role r ON r.id = ur.role_id
        WHERE r.name NOT IN ('FSDocSubmit', 'GovDoc')
    ),
    FilteredRoles AS (
        SELECT user_profile_id,
            organization_id,
            ARRAY_AGG(role_name) AS roles
        FROM RoleData
        WHERE role_name IS NOT NULL
        GROUP BY user_profile_id, organization_id
    ),
    ProcessedRoles AS (
        SELECT
            user_profile_id,
            CASE
                -- Rule 1: Government Users
                WHEN organization_id = 1 THEN
                    CASE
                        -- Retain Administrator and one prioritized gov role
                        WHEN 'ADMINISTRATOR' = ANY(roles) THEN
                            ARRAY_REMOVE(ARRAY[
                                'ADMINISTRATOR',
                                CASE
                                    WHEN 'DIRECTOR' = ANY(roles) THEN 'DIRECTOR'
                                    WHEN 'COMPLIANCE_MANAGER' = ANY(roles) THEN 'COMPLIANCE_MANAGER'
                                    WHEN 'ANALYST' = ANY(roles) THEN 'ANALYST'
                                END
                            ], NULL)
                        -- Priority among gov roles (no Administrator)
                        ELSE ARRAY_REMOVE(ARRAY[
                            CASE
                                WHEN 'DIRECTOR' = ANY(roles) THEN 'DIRECTOR'
                                WHEN 'COMPLIANCE_MANAGER' = ANY(roles) THEN 'COMPLIANCE_MANAGER'
                                WHEN 'ANALYST' = ANY(roles) THEN 'ANALYST'
                            END
                        ], NULL)
                    END
                -- Rule 2: Supplier Users
                WHEN organization_id > 1 THEN
                    CASE
                        -- Return empty array if READ_ONLY exists
                        WHEN 'READ_ONLY' = ANY(roles) THEN
                            ARRAY[]::text[]
                        ELSE ARRAY(
                            SELECT UNNEST(roles)
                            EXCEPT
                            SELECT UNNEST(ARRAY['ADMINISTRATOR', 'ANALYST', 'DIRECTOR', 'COMPLIANCE_MANAGER'])
                        )
                    END
            END AS filtered_roles,
            organization_id
        FROM FilteredRoles
    )
    SELECT 
        user_profile_id,
        organization_id,
        array_to_string(filtered_roles, ',') as roles_string
    FROM ProcessedRoles;
"""

// SQL queries to insert user profiles and roles into destination tables with ON CONFLICT handling
def insertUserProfileSQL = '''
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
'''

def insertUserRoleSQL = '''
    INSERT INTO user_role (user_profile_id, role_id)
    VALUES (?, (SELECT role_id FROM role WHERE name = ?::role_enum))
    ON CONFLICT (user_profile_id, role_id) DO NOTHING;
'''

// Fetch connections to both source and destination databases
def sourceDbcpService = context.controllerServiceLookup.getControllerService('3245b078-0192-1000-ffff-ffffba20c1eb')
def destinationDbcpService = context.controllerServiceLookup.getControllerService('3244bf63-0192-1000-ffff-ffffc8ec6d93')

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
        def userProfileId = userProfileResultSet.getInt('user_profile_id')
        def keycloakUserId = userProfileResultSet.getString('keycloak_user_id')
        def keycloakEmail = userProfileResultSet.getString('keycloak_email')
        def keycloakUsername = userProfileResultSet.getString('keycloak_username')
        def email = userProfileResultSet.getString('email')
        def title = userProfileResultSet.getString('title')
        def phone = userProfileResultSet.getString('phone')
        def mobilePhone = userProfileResultSet.getString('mobile_phone')
        def firstName = userProfileResultSet.getString('first_name')
        def lastName = userProfileResultSet.getString('last_name')
        def isActive = userProfileResultSet.getBoolean('is_active')
        def organizationId = userProfileResultSet.getObject('organization_id') // Nullable

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

    while (userRoleResultSet.next()) {
        def userProfileId = userRoleResultSet.getInt('user_profile_id')
        def rolesString = userRoleResultSet.getString('roles_string')

        if (rolesString) {
            def roles = rolesString.split(',')

            roles.each { role ->
                try {
                    insertUserRoleStmt.setInt(1, userProfileId)
                    insertUserRoleStmt.setString(2, role)
                    insertUserRoleStmt.executeUpdate()
                    log.info("Successfully inserted role ${role} for user ${userProfileId}")
            } catch (Exception e) {
                    log.error("Failed to insert role ${role} for user ${userProfileId}: ${e.message}")
                }
            }
    } else {
            log.warn("No roles found for user ${userProfileId}")
        }
    }
} catch (Exception e) {
    log.error('Error occurred during ETL process', e)
} finally {
    if (sourceConn) sourceConn.close()
    if (destinationConn) destinationConn.close()
}

log.warn('**** COMPLETED USER ETL ****')
