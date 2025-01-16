import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import groovy.json.JsonSlurper

log.warn('**** STARTING FUEL CODE ETL ****')

def fuelIdMapping = [
    8  : 13,
    9  : 5,  // TODO: need to double check this
    10 : 14,
    11 : 17,
    19 : 16,
    20 : 17,
    21 : 15,
]

def transportModeMapping = [
    1 : 6,
    3 : 7
]

def provinceStateMap = [
    // Canadian Provinces
    'BC': 'British Columbia',
    'AB': 'Alberta',
    'SK': 'Saskatchewan',
    'MB': 'Manitoba',
    'ON': 'Ontario',
    'QC': 'Quebec',
    'NL': 'Newfoundland and Labrador',
    'BRITISH COLUMBIA': 'British Columbia',
    'ALBERTA': 'Alberta',
    'SASKATCHEWAN': 'Saskatchewan',
    'MANITOBA': 'Manitoba',
    'ONTARIO': 'Ontario',
    'QUEBEC': 'Quebec',
    'NEWFOUNDLAND': 'Newfoundland and Labrador',

    // US States
    'CA': 'California',
    'CT': 'Connecticut',
    'GA': 'Georgia',
    'IA': 'Iowa',
    'IL': 'Illinois',
    'IN': 'Indiana',
    'KS': 'Kansas',
    'LA': 'Louisiana',
    'MN': 'Minnesota',
    'MS': 'Mississippi',
    'MO': 'Missouri',
    'MT': 'Montana',
    'ND': 'North Dakota',
    'NE': 'Nebraska',
    'NM': 'New Mexico',
    'OH': 'Ohio',
    'OK': 'Oklahoma',
    'OR': 'Oregon',
    'SD': 'South Dakota',
    'TX': 'Texas',
    'WA': 'Washington',
    'WI': 'Wisconsin',
    'WY': 'Wyoming',
    'CALIFORNIA': 'California',
    'GEORGIA': 'Georgia',
    'IOWA': 'Iowa',
    'ILLINOIS': 'Illinois',
    'INDIANA': 'Indiana',
    'KANSAS': 'Kansas',
    'LOUISIANA': 'Louisiana',
    'MINNESOTA': 'Minnesota',
    'MISSISSIPPI': 'Mississippi',
    'MISSOURI': 'Missouri',
    'MONTANA': 'Montana',
    'NORTH DAKOTA': 'North Dakota',
    'NEBRASKA': 'Nebraska',
    'NEW MEXICO': 'New Mexico',
    'OHIO': 'Ohio',
    'OKLAHOMA': 'Oklahoma',
    'OREGON': 'Oregon',
    'SOUTH DAKOTA': 'South Dakota',
    'TEXAS': 'Texas',
    'WASHINGTON': 'Washington',
    'WISCONSIN': 'Wisconsin',
    'WYOMING': 'Wyoming',
    'WYOMING.': 'Wyoming',  // Add variant with period
    'CONNETICUT': 'Connecticut',  // Add misspelled variant
    'CONNECTICUT': 'Connecticut',
]

def fuelCodeQuery = '''
    SELECT
        fc.*,
        array_agg(DISTINCT finishedFtm.transport_mode_id) AS finished_fuel_transport_modes,
        array_agg(DISTINCT feedstockFtf.transport_mode_id) AS feedstock_fuel_transport_modes
    FROM
        fuel_code fc
    LEFT JOIN
        fuel_transport_mode_fuel_code finishedFtm ON fc.id = finishedFtm.fuel_code_id
    LEFT JOIN
        feedstock_transport_mode_fuel_code feedstockFtf ON fc.id = feedstockFtf.fuel_code_id
    GROUP BY
        fc.id;
'''

// Insert `fuel_code` into the target database
def insertFuelCodeSQL = '''
    INSERT INTO fuel_code (
        fuel_status_id,
        fuel_suffix,
        company,
        carbon_intensity,
        last_updated,
        application_date,
        approval_date,
        fuel_type_id,
        feedstock,
        feedstock_location,
        feedstock_misc,
        facility_nameplate_capacity,
        former_company,
        create_date,
        update_date,
        effective_date,
        expiration_date,
        fuel_production_facility_city,
        fuel_production_facility_province_state,
        fuel_production_facility_country,
        prefix_id,
        edrms,
        notes,
        create_user,
        update_user,
        effective_status,
        contact_name,
        contact_email
    )
    VALUES (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        1,
        '',
        null,
        null,
        null,
        true,
        null,
        null
    )
    RETURNING fuel_code_id;
'''

// Insert into `finished_fuel_transport_mode`
def insertFinishedFuelTransportModeSQL = '''
    INSERT INTO finished_fuel_transport_mode (fuel_code_id, transport_mode_id)
    VALUES (?, ?);
'''

// Insert into `feedstock_fuel_transport_mode`
def insertFeedstockFuelTransportModeSQL = '''
    INSERT INTO feedstock_fuel_transport_mode (fuel_code_id, transport_mode_id)
    VALUES (?, ?);
'''

// Fetch connections to both source and destination databases
def sourceDbcpService = context.controllerServiceLookup.getControllerService('3245b078-0192-1000-ffff-ffffba20c1eb')
def destinationDbcpService = context.controllerServiceLookup.getControllerService('3244bf63-0192-1000-ffff-ffffc8ec6d93')

sourceConn = null
destinationConn = null

try {
    // Get connections
    sourceConn = sourceDbcpService.getConnection()
    destinationConn = destinationDbcpService.getConnection()

    fetchFuelCodes = sourceConn.prepareStatement(fuelCodeQuery)
    fuelCodes = fetchFuelCodes.executeQuery()

    while (fuelCodes.next()) {
        def fuelCodeVersion = fuelCodes.getString('fuel_code_version')
        def fuelCodeVersionMinor = fuelCodes.getString('fuel_code_version_minor')

        def fuelStatusId = fuelCodes.getInt('status_id')
        def fuelSuffix = "${fuelCodeVersion}.${fuelCodeVersionMinor}"
        def company = fuelCodes.getString('company')
        def carbonIntensity = fuelCodes.getDouble('carbon_intensity')
        def lastUpdated = fuelCodes.getDate('update_timestamp')
        def applicationDate = fuelCodes.getDate('application_date')
        def approvalDate = fuelCodes.getDate('approval_date')
        def fuelTypeId = fuelCodes.getInt('fuel_id')
        def feedstock = fuelCodes.getString('feedstock')
        def feedstockLocation = fuelCodes.getString('feedstock_location')
        def feedstockMisc = fuelCodes.getString('feedstock_misc')
        def facilityNameplateCapacity = fuelCodes.getDouble('facility_nameplate')
        def formerCompany = fuelCodes.getString('former_company')
        def createDate = fuelCodes.getDate('create_timestamp')
        def updateDate = fuelCodes.getDate('update_timestamp')
        def effectiveDate = fuelCodes.getDate('effective_date')
        def expirationDate = fuelCodes.getDate('expiry_date')

        def facilityLocation = fuelCodes.getString('facility_location')

        def locationParts = (facilityLocation ?: '').split(',').collect { it.trim() }
        def facilityCity = null
        def facilityProvinceState = null
        def facilityCountry = null

        if (locationParts.size() == 1) {
            def location = locationParts[0].toUpperCase()
            if (location == 'US CENTRAL') {
                facilityCountry = 'United States of America'
            } else if (provinceStateMap.containsKey(location)) {
                facilityProvinceState = provinceStateMap[location]
            }
        } else if (locationParts.size() == 2) {
            // First part is always city
            facilityCity = locationParts[0]

            // Process second part - could be province/state or country
            def location = locationParts[1].toUpperCase()
            if (provinceStateMap.containsKey(location)) {
                facilityProvinceState = provinceStateMap[location]
            } else {
                // If not a recognized province/state, treat as country
                facilityCountry = locationParts[1]
            }
        } else if (locationParts.size() == 3) {
            // First part is always city
            facilityCity = locationParts[0]

            // Second part is province/state
            def location = locationParts[1].toUpperCase()
            if (provinceStateMap.containsKey(location)) {
                facilityProvinceState = provinceStateMap[location]
            } else {
                facilityProvinceState = locationParts[1]
            }

            // Third part is always country - expand USA to full name
            def country = locationParts[2].toUpperCase()
            if (country == 'USA') {
                facilityCountry = 'United States of America'
            } else {
                facilityCountry = locationParts[2]
            }
        }

        def finishedModes = fuelCodes.getArray('finished_fuel_transport_modes')?.getArray() ?: []
        def feedstockModes = fuelCodes.getArray('feedstock_fuel_transport_modes')?.getArray() ?: []

        // Insert `fuel_code` and get the new ID
        def insertFuelCode = destinationConn.prepareStatement(insertFuelCodeSQL)
        insertFuelCode.setInt(1, fuelStatusId)
        insertFuelCode.setString(2, fuelSuffix)
        insertFuelCode.setString(3, company)
        insertFuelCode.setDouble(4, carbonIntensity)
        insertFuelCode.setDate(5, lastUpdated)
        insertFuelCode.setDate(6, applicationDate)
        insertFuelCode.setDate(7, approvalDate)
        insertFuelCode.setInt(8, fuelIdMapping[fuelTypeId] ?: fuelTypeId)
        insertFuelCode.setString(9, feedstock)
        insertFuelCode.setString(10, feedstockLocation)
        insertFuelCode.setString(11, feedstockMisc)
        insertFuelCode.setDouble(12, facilityNameplateCapacity)
        insertFuelCode.setString(13, formerCompany)
        insertFuelCode.setDate(14, createDate)
        insertFuelCode.setDate(15, updateDate)
        insertFuelCode.setDate(16, effectiveDate)
        insertFuelCode.setDate(17, expirationDate)
        insertFuelCode.setString(18, facilityCity)
        insertFuelCode.setString(19, facilityProvinceState)
        insertFuelCode.setString(20, facilityCountry)

        def rs = insertFuelCode.executeQuery()
        def newFuelCodeId = rs.next() ? rs.getInt('fuel_code_id') : null
        rs.close()

        // Insert finished fuel transport modes
        finishedModes.each { mode ->
            def insertFinishedMode = destinationConn.prepareStatement(insertFinishedFuelTransportModeSQL)
            insertFinishedMode.setInt(1, newFuelCodeId)
            insertFinishedMode.setInt(2, transportModeMapping[mode] ?: mode)
            insertFinishedMode.executeUpdate()
        }

        // Insert feedstock fuel transport modes
        feedstockModes.each { mode ->
            def insertFeedstockMode = destinationConn.prepareStatement(insertFeedstockFuelTransportModeSQL)
            insertFeedstockMode.setInt(1, newFuelCodeId)
            insertFeedstockMode.setInt(2, transportModeMapping[mode] ?: mode)
            insertFeedstockMode.executeUpdate()
        }
    }
} catch (Exception e) {
    log.error('Error occurred during ETL process', e)
} finally {
    if (fetchFuelCodes) fetchFuelCodes.close()
    if (sourceConn) sourceConn.close()
    if (destinationConn) destinationConn.close()
}

log.warn('**** COMPLETED FUEL CODE ETL ****')
