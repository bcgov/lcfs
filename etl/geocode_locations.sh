#!/bin/bash
set -e

# Usage:
#   For local: ./geocode_locations.sh local <local_container>
#   For remote (dev, test, prod): ./geocode_locations.sh <environment>
#       where <environment> is one of 'dev', 'test', or 'prod'

if [ "$#" -lt 1 ]; then
    echo "Usage:"
    echo "  For local: $0 local <local_container>"
    echo "  For remote: $0 <environment>    (where <environment> is 'dev', 'test', or 'prod')"
    exit 1
fi

env=$1

if [ "$env" = "local" ]; then
    if [ "$#" -ne 2 ]; then
        echo "For local environment, please provide the local Docker container name or id."
        exit 1
    fi
    local_container=$2
    echo "** Running geocode_locations in local environment (container: $local_container)"
else
    echo "** Running geocode_locations in OpenShift environment: $env"
    # These settings are for LCFS in OpenShift.
    project_name="d2bd59-$env"
    app_label="lcfs-crunchy-$env-lcfs"
    db_name="lcfs"
    remote_db_user="postgres"

    echo "** Setting project $project_name"
    oc project $project_name
fi

# Function to run SQL commands. It abstracts whether we run locally or via oc exec.
run_sql() {
    local sql_command=$1
    if [ "$env" = "local" ]; then
        docker exec -i "$local_container" bash -c "psql -U lcfs -d lcfs -c \"$sql_command\""
    else
        # Get leader pod from OpenShift.
        get_leader_pod() {
            local project=$1
            local app_label=$2
            pods=$(oc get pods -n $project -o name | grep "$app_label")
            for pod in $pods; do
                is_leader=$(oc exec -n $project $pod -- bash -c "psql -U $remote_db_user -d $db_name -tAc \"SELECT pg_is_in_recovery()\"")
                if [ "$is_leader" = "f" ]; then
                    echo $pod
                    return
                fi
            done
            echo "No leader pod found" >&2
            exit 1
        }
        pod_name=$(get_leader_pod $project_name $app_label)
        oc exec -n $project_name $pod_name -- bash -c "psql -U $remote_db_user -d $db_name -c \"$sql_command\""
    fi
}

query_sql() {
    local sql_query=$1
    if [ "$env" = "local" ]; then
        docker exec -i "$local_container" bash -c "psql -U lcfs -d lcfs -t -A -F',' -c \"$sql_query\""
    else
        pod_name=$(get_leader_pod $project_name $app_label)
        oc exec -n $project_name $pod_name -- bash -c "psql -U $remote_db_user -d $db_name -t -A -F',' -c \"$sql_query\""
    fi
}

#############################################
# Configuration for geocoding
#############################################
GEOCODE_URL="https://nominatim.openstreetmap.org/search"
USER_AGENT="LCFS_Script/1.0 (lcfs@gov.bc.ca)"

#############################################
# Step 1: Insert new unique locations into location table
#############################################
echo "** Inserting new unique locations from fuel_code into location table..."
INSERT_SQL="INSERT INTO location (city, province_state, country)
SELECT DISTINCT fuel_production_facility_city,
       fuel_production_facility_province_state,
       COALESCE(fuel_production_facility_country, '')
FROM fuel_code
WHERE fuel_production_facility_city IS NOT NULL
  AND fuel_production_facility_province_state IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM location
    WHERE location.city = fuel_code.fuel_production_facility_city
      AND location.province_state = fuel_code.fuel_production_facility_province_state
      AND location.country = COALESCE(fuel_production_facility_country, '')
  );"
run_sql "$INSERT_SQL"
echo

#############################################
# Step 2: Geocode new locations missing latitude/longitude
#############################################
echo "** Querying locations missing coordinates..."
QUERY_SQL="SELECT id, city, province_state, country FROM location WHERE latitude IS NULL OR longitude IS NULL;"
locations=$(query_sql "$QUERY_SQL")

echo "$locations" | while IFS=',' read -r id city province country; do
    # Skip empty lines
    if [ -z "$id" ]; then
        continue
    fi

    if [ -z "$country" ]; then
        QUERY_STRING="${city}, ${province}"
    else
        QUERY_STRING="${city}, ${province}, ${country}"
    fi

    echo "** Geocoding record id ${id}: ${QUERY_STRING}"

    RESPONSE=$(curl -s --get --data-urlencode "q=${QUERY_STRING}" --data "format=json" --data "limit=1" -H "User-Agent: ${USER_AGENT}" "${GEOCODE_URL}")

    lat=$(echo "$RESPONSE" | python3 -c 'import sys, json; data = json.load(sys.stdin); print(data[0]["lat"] if data and "lat" in data[0] else "")')
    lon=$(echo "$RESPONSE" | python3 -c 'import sys, json; data = json.load(sys.stdin); print(data[0]["lon"] if data and "lon" in data[0] else "")')

    if [ -n "$lat" ] && [ -n "$lon" ]; then
        echo "** Updating record id ${id} with coordinates: ${lat}, ${lon}"
        UPDATE_SQL="UPDATE location SET latitude=${lat}, longitude=${lon} WHERE id=${id};"
        run_sql "$UPDATE_SQL"
    else
        echo "** No coordinates found for record id ${id} with query '${QUERY_STRING}'"
    fi

    sleep 1
done

echo "** Geocoding process complete."