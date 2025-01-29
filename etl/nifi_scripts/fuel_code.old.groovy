import org.apache.nifi.processor.io.StreamCallback
import groovy.json.JsonSlurper
import groovy.json.JsonOutput

def transformCallback = { inputStream, outputStream ->
    try {
        // Parse JSON input
        def record = new JsonSlurper().parseText(inputStream.text)

        // Map the fuel_id to the corresponding new value
        def fuelIdMapping = [
            8  : 13, // Propane
            21 : 15, // Renewable naphtha
            10 : 14, // Renewable gasoline
            19 : 16, // Fossil-derived diesel
            11 : 17, // Fossil-derived gasoline
            20 : 17  // Fossil-derived gasoline
        ]

        // Replace fuel_id if it matches one of the keys in the map
        if (fuelIdMapping.containsKey(record.fuel_id)) {
            record.fuel_id = fuelIdMapping[record.fuel_id]
        }

        // Parse facility location
        def locationParts = (record.facility_location ?: '').split(',').collect { it.trim() }
        def facilityCity = null
        def facilityProvinceState = null
        def facilityCountry = null

        // Map of provinces and states to their full names (only those appearing in the data)
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
            'CONNETICUT': 'Connecticut',  // Add misspelled variant
            'CONNECTICUT': 'Connecticut',
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
        ]

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

        // Map the fields from the source to the target schema
        // The following fields are not used in the migration: fuel_code_id, facility_location, renewable_percentage, facility_nameplate_capacity_unit
        def transformedRecord = [
            fuel_status_id                     : record.status_id,
            prefix_id                          : 1, // BCLCF
            fuel_suffix                        : "${record.fuel_code_version}.${record.fuel_code_version_minor}",
            company                            : record.company,
            carbon_intensity                   : record.carbon_intensity,
            edrms                              : '',
            last_updated                       : record.update_timestamp,
            application_date                   : record.application_date,
            approval_date                      : record.approval_date,
            fuel_type_id                       : record.fuel_id,
            feedstock                          : record.feedstock,
            feedstock_location                 : record.feedstock_location,
            feedstock_misc                     : record.feedstock_misc,
            facility_nameplate_capacity        : record.facility_nameplate,
            former_company                     : record.former_company,
            notes                              : null,
            create_date                        : record.create_timestamp,
            update_date                        : record.update_timestamp,
            create_user                        : null,
            update_user                        : null,
            effective_date                     : record.effective_date,
            expiration_date                    : record.expiry_date,
            effective_status                   : true,
            fuel_production_facility_city      : facilityCity,
            fuel_production_facility_province_state: facilityProvinceState,
            fuel_production_facility_country   : facilityCountry,
            contact_name                       : null,
            contact_email                      : null
        ]

        // Write the transformed data back to the output
        outputStream.write(JsonOutput.toJson(transformedRecord).getBytes('UTF-8'))
    } catch (Exception e) {
        def recordId = record?.id
        if (recordId) {
            flowFile = session.putAttribute(flowFile, 'failed_record_id', recordId.toString())
        }
        throw e
    }
}

// Obtain the flowFile from the session
flowFile = session.get()
if (flowFile != null) {
    try {
        // Write the transformed data using the transformCallback
        flowFile = session.write(flowFile, transformCallback as StreamCallback)
        session.transfer(flowFile, REL_SUCCESS)
    } catch (Exception e) {
        session.transfer(flowFile, REL_FAILURE)
    }
}
