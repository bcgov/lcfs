#!/bin/bash
set -e

# This script handles PostgreSQL data transfer between OpenShift and local containers

# 4 Arguments 
# $1 = 'tfrs' or 'lcfs' (application)
# $2 = 'test', 'prod', or 'dev' (environment)
# $3 = 'import' or 'export' (direction of data transfer)
# $4 = 'local container name or id'
# example commands:
# . data-transfer.sh lcfs dev export 398cd4661173
# . data-transfer.sh tfrs prod import 398cd4661173

if [ "$#" -lt 4 ] || [ "$#" -gt 5 ]; then
    echo "Passed $# parameters. Expected 4 or 5."
    echo "Usage: $0 <application> <environment> <direction> <local_container> [<port>]"
    echo "Where:"
    echo "  <application> is 'tfrs' or 'lcfs'"
    echo "  <environment> is 'test', 'prod', or 'dev'"
    echo "  <direction> is 'import' or 'export'"
    echo "  <local_container> is the name or id of your local Docker container"
    exit 1
fi

application=$1
env=$2
direction=$3
local_container=$4

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

# checks if you are logged in to openshift
echo "** Checking Openshift creds"
oc whoami
echo "logged in"
echo

# Function to get the leader pod for Crunchy Data PostgreSQL clusters
get_leader_pod() {
    local project=$1
    local app_label=$2
    
    # Get all pods with the given app label
    pods=$(oc get pods -n $project_name -o name | grep "$app_label")
    
    # Loop through pods to find the leader
    for pod in $pods; do
        is_leader=$(oc exec -n $project $pod -- bash -c "psql -U postgres -tAc \"SELECT pg_is_in_recovery()\"")
        if [ "$is_leader" = "f" ]; then
            echo $pod
            return
        fi
    done
    
    echo "No leader pod found"
    exit 1
}

# Set project name and pod name based on application and environment
case $application in
    "tfrs")
        project_name="0ab226-$env"
        if [ "$env" = "prod" ]; then
            app_label="tfrs-crunchy-prod-tfrs"
        else
            app_label="tfrs-spilo"
        fi
        db_name="tfrs"
        ;;
    "lcfs")
        project_name="d2bd59-$env"
        app_label="lcfs-crunchy-$env-lcfs"
        db_name="lcfs"
        ;;
    *)
        echo "Invalid application. Use 'tfrs' or 'lcfs'."
        exit 1
        ;;
esac

echo "** Setting project $project_name"
oc project $project_name
echo

# Get the appropriate pod
pod_name=$(get_leader_pod $project_name $app_label)
if [ -z "$pod_name" ]; then
    echo "Error: No leader pod identified."
    exit 1
fi
echo "** Leader pod identified: $pod_name"

if [ "$direction" = "import" ]; then
    echo "** Starting pg_dump on OpenShift pod"
    oc exec $pod_name -- bash -c "pg_dump -U postgres -F t --no-privileges --no-owner -c -d $db_name > /tmp/$db_name.tar"
    echo

    echo "** Downloading .tar file from OpenShift pod"
    oc rsync $pod_name:/tmp/$db_name.tar ./
    echo

    echo "** Copying .tar to local database container $local_container"
    docker cp $db_name.tar $local_container:/tmp/$db_name.tar
    echo

    echo "** Restoring local database"
    docker exec $local_container bash -c "pg_restore -U $db_name --dbname=$db_name --no-owner --clean --if-exists --verbose /tmp/$db_name.tar" || true
    echo

    echo "** Cleaning up dump file from OpenShift pod"
    oc exec $pod_name -- bash -c "rm /tmp/$db_name.tar"
    echo

elif [ "$direction" = "export" ]; then
    echo "** Starting pg_dump on local container"
    docker exec $local_container bash -c "pg_dump -U $db_name -F t --no-privileges --no-owner -c -d $db_name > /tmp/$db_name.tar"
    echo

    echo "** Copying .tar file from local container"
    docker cp $local_container:/tmp/$db_name.tar ./
    echo

    echo "** Uploading .tar file to OpenShift pod"
    oc rsync ./$db_name.tar $pod_name:/tmp/
    echo

    echo "** Restoring database on OpenShift pod"
    oc exec $pod_name -- bash -c "pg_restore -U postgres --dbname=$db_name --no-owner --clean --if-exists --verbose /tmp/$db_name.tar" || true
    echo

    echo "** Cleaning up dump file from local container"
    docker exec $local_container bash -c "rm /tmp/$db_name.tar"
    echo
fi

echo "** Cleaning up dump file from local container"
docker exec $local_container bash -c "rm /tmp/$db_name.tar" || true
echo

echo "** Cleaning up local dump file"
rm $db_name.tar

echo "** Finished data transfer and cleanup"
