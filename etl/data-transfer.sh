#!/bin/bash
set -e

# This script handles PostgreSQL data transfer between OpenShift and local containers
#
# Expected parameters:
# $1 = 'tfrs' or 'lcfs' (application)
# $2 = 'test', 'prod', or 'dev' (environment)
# $3 = 'import' or 'export' (direction of data transfer)
# $4 = local container name or id
# $5 = (optional) table name to dump (e.g., compliance_report_history)
#
# Example commands:
# . data-transfer.sh lcfs dev export 398cd4661173 compliance_report_history
# . data-transfer.sh tfrs prod import 398cd4661173

if [ "$#" -lt 4 ] || [ "$#" -gt 5 ]; then
    echo "Passed $# parameters. Expected 4 or 5."
    echo "Usage: $0 <application> <environment> <direction> <local_container> [<table>]"
    echo "Where:"
    echo "  <application> is 'tfrs' or 'lcfs'"
    echo "  <environment> is 'test', 'prod', or 'dev'"
    echo "  <direction> is 'import' or 'export'"
    echo "  <local_container> is the name or id of your local Docker container"
    echo "  <table> (optional) is the table name to dump (e.g., compliance_report_history)"
    exit 1
fi

application=$1
env=$2
direction=$3
local_container=$4

# Optional parameter: table name
table=""
if [ "$#" -eq 5 ]; then
    table=$5
fi

# Validate direction
if [ "$direction" != "import" ] && [ "$direction" != "export" ]; then
    echo "Invalid direction. Use 'import' or 'export'."
    exit 1
fi

# Check if the operation is supported
if [ "$application" = "tfrs" ] && [ "$direction" = "export" ]; then
    echo "Export operation is not supported for the TFRS application."
    exit 1
fi

# Check if you are logged in to OpenShift
echo "** Checking Openshift creds"
oc whoami
echo "logged in"
echo

# Set project, app label, database name, and credentials
case $application in
    "tfrs")
        project_name="0ab226-$env"
        if [ "$env" = "prod" ]; then
            app_label="tfrs-crunchy-prod-tfrs"
        else
            app_label="tfrs-spilo"
        fi
        db_name="tfrs"
        remote_db_user="postgres"
        local_db_user="tfrs"
        ;;
    "lcfs")
        project_name="d2bd59-$env"
        app_label="lcfs-crunchy-$env-lcfs"
        db_name="lcfs"
        if [ "$env" = "prod" ]; then
            remote_db_user="postgres"
            local_db_user="lcfs"
        else
            remote_db_user="postgres"
            local_db_user="lcfs"
        fi
        ;;
    *)
        echo "Invalid application. Use 'tfrs' or 'lcfs'."
        exit 1
        ;;
esac

echo "** Setting project $project_name"
oc project $project_name
echo

# Function to get the leader pod for Crunchy Data PostgreSQL clusters
get_leader_pod() {
    local project=$1
    local app_label=$2
    
    # Get all pods with the given app label
    pods=$(oc get pods -n $project_name -o name | grep "$app_label")
    
    # Loop through pods to find the leader (using remote_db_user)
    for pod in $pods; do
        is_leader=$(oc exec -n $project $pod -- bash -c "psql -U $remote_db_user -tAc \"SELECT pg_is_in_recovery()\"")
        if [ "$is_leader" = "f" ]; then
            echo $pod
            return
        fi
    done
    
    echo "No leader pod found"
    exit 1
}

# Get the appropriate pod
pod_name=$(get_leader_pod $project_name $app_label)
if [ -z "$pod_name" ]; then
    echo "Error: No leader pod identified."
    exit 1
fi
echo "** Leader pod identified: $pod_name"

# Set up table option for pg_dump if a table name is provided.
table_option=""
file_suffix="$db_name"
if [ -n "$table" ]; then
    table_option="-t $table"
    file_suffix="${db_name}_${table}"
fi

if [ "$direction" = "import" ]; then
    echo "** Starting pg_dump on OpenShift pod and streaming directly to local file"
    oc exec $pod_name -- bash -c "pg_dump -U $remote_db_user $table_option -F t --no-privileges --no-owner -c -d $db_name" > ${file_suffix}.tar
    echo

    echo "** Copying .tar to local database container $local_container"
    docker cp ${file_suffix}.tar $local_container:/tmp/${file_suffix}.tar
    echo

    echo "** Restoring local database (using local user $local_db_user)"
    docker exec $local_container bash -c "pg_restore -U $local_db_user --dbname=$db_name --no-owner --clean --if-exists --verbose /tmp/${file_suffix}.tar" || true
    echo

    echo "** Cleaning up local dump file"
    rm ${file_suffix}.tar

elif [ "$direction" = "export" ]; then
    echo "** Starting pg_dump on local container (using local user $local_db_user)"
    docker exec $local_container bash -c "pg_dump -U $local_db_user $table_option -F t --no-privileges --no-owner -c -d $db_name > /tmp/${file_suffix}.tar"
    echo

    echo "** Copying .tar file from local container"
    docker cp $local_container:/tmp/${file_suffix}.tar ./
    echo

    echo "** Preparing .tar file for OpenShift pod"
    mkdir -p tmp_transfer
    mv ${file_suffix}.tar tmp_transfer/
    echo

    echo "** Uploading .tar file to OpenShift pod"
    oc cp ./tmp_transfer/${file_suffix}.tar ${pod_name#pod/}:/tmp/tmp_transfer/${file_suffix}.tar
    echo

    echo "** Restoring database on OpenShift pod (using remote user $remote_db_user)"
    oc exec $pod_name -- bash -c "pg_restore -U $remote_db_user --dbname=$db_name --no-owner --clean --if-exists --verbose /tmp/tmp_transfer/${file_suffix}.tar" || true
    echo

    echo "** Cleaning up temporary files on OpenShift pod"
    oc exec $pod_name -- bash -c "rm -rf /tmp/tmp_transfer"
    echo

    echo "** Cleaning up dump file from local container"
    docker exec $local_container bash -c "rm /tmp/tmp_transfer" || true
    echo

    echo "** Cleaning up local temporary directory"
    rm -rf tmp_transfer
fi

echo "** Finished data transfer and cleanup"
