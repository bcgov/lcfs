#!/bin/bash
set -e

# Enhanced PostgreSQL data transfer script with verification and reliability features
#
# Expected parameters:
# $1 = 'tfrs' or 'lcfs' (application)
# $2 = 'test', 'prod', or 'dev' (environment)
# $3 = 'import' or 'export' (direction of data transfer)
# $4 = local container name or id
# $5 = (optional) table name to dump (e.g., compliance_report_history)
#
# Example commands:
# . data-transfer-enhanced.sh lcfs dev export 398cd4661173 compliance_report_history
# . data-transfer-enhanced.sh tfrs prod import 398cd4661173

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

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_status() {
    echo -e "${GREEN}** $1${NC}"
}

print_error() {
    echo -e "${RED}ERROR: $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}WARNING: $1${NC}"
}

# Validate direction
if [ "$direction" != "import" ] && [ "$direction" != "export" ]; then
    print_error "Invalid direction. Use 'import' or 'export'."
    exit 1
fi

# Check if the operation is supported
if [ "$application" = "tfrs" ] && [ "$direction" = "export" ]; then
    print_error "Export operation is not supported for the TFRS application."
    exit 1
fi

# Check if you are logged in to OpenShift
print_status "Checking Openshift creds"
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
        print_error "Invalid application. Use 'tfrs' or 'lcfs'."
        exit 1
        ;;
esac

print_status "Setting project $project_name"
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
    print_error "No leader pod identified."
    exit 1
fi
print_status "Leader pod identified: $pod_name"

# Set up table option for pg_dump if a table name is provided.
table_option=""
file_suffix="$db_name"
if [ -n "$table" ]; then
    table_option="-t $table"
    file_suffix="${db_name}_${table}"
fi

# Function to verify tar file integrity
verify_tar_file() {
    local tar_file=$1
    local expected_min_size=${2:-1000000}  # Default 1MB minimum
    
    if [ ! -f "$tar_file" ]; then
        print_error "Tar file $tar_file does not exist"
        return 1
    fi
    
    local file_size=$(stat -f%z "$tar_file" 2>/dev/null || stat -c%s "$tar_file" 2>/dev/null)
    
    if [ "$file_size" -lt "$expected_min_size" ]; then
        print_warning "Tar file seems too small: $file_size bytes"
        return 1
    fi
    
    # Check if tar file is valid
    if ! tar -tf "$tar_file" >/dev/null 2>&1; then
        print_error "Tar file is corrupted or invalid"
        return 1
    fi
    
    print_status "Tar file verified: $file_size bytes"
    return 0
}

# Function to get database size estimate
get_db_size_estimate() {
    local size_query="SELECT pg_database_size('$db_name')"
    if [ -n "$table" ]; then
        size_query="SELECT pg_total_relation_size('$table')"
    fi
    
    local size_bytes=$(oc exec $pod_name -- bash -c "psql -U $remote_db_user -tAc \"$size_query\" $db_name" 2>/dev/null || echo "0")
    echo $size_bytes
}

# Function to perform database dump with retry logic
dump_with_retry() {
    local max_retries=3
    local retry_count=0
    local dump_file="${file_suffix}.tar"
    
    # Get size estimate
    local expected_size=$(get_db_size_estimate)
    local min_expected_size=$((expected_size / 10))  # Allow for compression, expect at least 10% of original
    
    print_status "Expected database/table size: $(numfmt --to=iec-i --suffix=B $expected_size 2>/dev/null || echo "$expected_size bytes")"
    
    while [ $retry_count -lt $max_retries ]; do
        retry_count=$((retry_count + 1))
        print_status "Dump attempt $retry_count of $max_retries"
        
        # Method 1: Direct streaming with progress monitoring
        if [ $retry_count -eq 1 ]; then
            print_status "Using direct streaming method..."
            oc exec $pod_name -- bash -c "pg_dump -U $remote_db_user $table_option -F t --no-privileges --no-owner -c -d $db_name" > "$dump_file"
        
        # Method 2: Dump to pod first, then download
        elif [ $retry_count -eq 2 ]; then
            print_status "Using two-stage method (dump to pod, then download)..."
            oc exec $pod_name -- bash -c "pg_dump -U $remote_db_user $table_option -F t --no-privileges --no-owner -c -d $db_name > /tmp/${file_suffix}.tar"
            
            # Check file size on pod
            remote_size=$(oc exec $pod_name -- bash -c "stat -c%s /tmp/${file_suffix}.tar 2>/dev/null || echo 0")
            print_status "Remote file size: $(numfmt --to=iec-i --suffix=B $remote_size 2>/dev/null || echo "$remote_size bytes")"
            
            # Download with oc exec cat
            oc exec $pod_name -- cat /tmp/${file_suffix}.tar > "$dump_file"
            
            # Clean up remote file
            oc exec $pod_name -- rm -f /tmp/${file_suffix}.tar
        
        # Method 3: Use base64 encoding for more reliable transfer
        else
            print_status "Using base64 encoded transfer method..."
            oc exec $pod_name -- bash -c "pg_dump -U $remote_db_user $table_option -F t --no-privileges --no-owner -c -d $db_name | base64 -w0" | base64 -d > "$dump_file"
        fi
        
        # Verify the downloaded file
        if verify_tar_file "$dump_file" "$min_expected_size"; then
            print_status "Download successful!"
            return 0
        else
            print_warning "Download verification failed, retrying..."
            rm -f "$dump_file"
        fi
    done
    
    print_error "Failed to download database dump after $max_retries attempts"
    return 1
}

# Function to verify restoration success
verify_restoration() {
    local container=$1
    local user=$2
    local database=$3
    
    print_status "Verifying database restoration..."
    
    # Count tables
    local table_count=$(docker exec $container psql -U $user -d $database -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'")
    print_status "Tables restored: $table_count"
    
    # Count total rows across major tables
    local total_rows=$(docker exec $container psql -U $user -d $database -tAc "
        SELECT SUM(n_live_tup) 
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
    " 2>/dev/null || echo "0")
    
    print_status "Total rows across all tables: $(numfmt --to=si $total_rows 2>/dev/null || echo "$total_rows")"
    
    # Check for specific important tables
    for important_table in compliance_report organization user_profile; do
        if docker exec $container psql -U $user -d $database -tAc "SELECT 1 FROM information_schema.tables WHERE table_name = '$important_table'" | grep -q 1; then
            local row_count=$(docker exec $container psql -U $user -d $database -tAc "SELECT COUNT(*) FROM $important_table")
            print_status "Table $important_table: $row_count rows"
        fi
    done
}

if [ "$direction" = "import" ]; then
    print_status "Starting database import process..."
    
    # Perform dump with retry logic
    if ! dump_with_retry; then
        exit 1
    fi
    
    print_status "Copying .tar to local database container $local_container"
    docker cp ${file_suffix}.tar $local_container:/tmp/${file_suffix}.tar
    
    print_status "Starting database restoration (this may take several minutes)..."
    print_warning "You may see some errors during restoration - this is normal when importing into an existing database"
    
    # Run restore with detailed error logging
    docker exec $local_container bash -c "
        pg_restore -U $local_db_user --dbname=$db_name --no-owner --clean --if-exists --verbose /tmp/${file_suffix}.tar 2>&1 | 
        tee /tmp/restore_log.txt | 
        grep -E '(ERROR|WARNING|restored|processing|creating)' || true
    " || true
    
    # Check for critical errors
    if docker exec $local_container grep -q "ERROR:  could not access file" /tmp/restore_log.txt 2>/dev/null; then
        print_error "Critical errors detected during restoration"
    fi
    
    # Verify restoration
    verify_restoration $local_container $local_db_user $db_name
    
    print_status "Cleaning up temporary files..."
    docker exec $local_container rm -f /tmp/${file_suffix}.tar /tmp/restore_log.txt
    rm -f ${file_suffix}.tar
    
elif [ "$direction" = "export" ]; then
    print_status "Starting database export process..."
    
    print_status "Creating pg_dump on local container (using local user $local_db_user)"
    docker exec $local_container bash -c "pg_dump -U $local_db_user $table_option -F t --no-privileges --no-owner -c -d $db_name > /tmp/${file_suffix}.tar"
    
    print_status "Copying .tar file from local container"
    docker cp $local_container:/tmp/${file_suffix}.tar ./
    
    # Verify the exported file
    if ! verify_tar_file "${file_suffix}.tar"; then
        print_error "Export verification failed"
        exit 1
    fi
    
    print_status "Preparing .tar file for OpenShift pod"
    mkdir -p tmp_transfer
    mv ${file_suffix}.tar tmp_transfer/
    
    print_status "Uploading .tar file to OpenShift pod"
    # First create the directory on the pod
    oc exec $pod_name -- mkdir -p /tmp/tmp_transfer
    
    # Upload the file
    oc cp ./tmp_transfer/${file_suffix}.tar ${pod_name#pod/}:/tmp/tmp_transfer/${file_suffix}.tar
    
    print_status "Restoring database on OpenShift pod (using remote user $remote_db_user)"
    oc exec $pod_name -- bash -c "pg_restore -U $remote_db_user --dbname=$db_name --no-owner --clean --if-exists --verbose /tmp/tmp_transfer/${file_suffix}.tar" || true
    
    print_status "Cleaning up temporary files on OpenShift pod"
    oc exec $pod_name -- bash -c "rm -rf /tmp/tmp_transfer"
    
    print_status "Cleaning up dump file from local container"
    docker exec $local_container bash -c "rm -f /tmp/${file_suffix}.tar" || true
    
    print_status "Cleaning up local temporary directory"
    rm -rf tmp_transfer
fi

print_status "Data transfer completed successfully!"
print_status "Summary:"
print_status "  Application: $application"
print_status "  Environment: $env"
print_status "  Direction: $direction"
print_status "  Database: $db_name"
if [ -n "$table" ]; then
    print_status "  Table: $table"
fi

# Provide helpful next steps
if [ "$direction" = "import" ]; then
    echo
    print_status "Next steps:"
    echo "1. Connect to your database: docker exec -it $local_container psql -U $local_db_user -d $db_name"
    echo "2. Verify your data: \\dt (list tables), SELECT COUNT(*) FROM <table_name>;"
    echo "3. Check for any missing data or errors in the restoration"
fi