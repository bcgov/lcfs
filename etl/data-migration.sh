#!/bin/bash
# Optimized NiFi Processor Management Script with Advanced Logging
# This script manages NiFi processors, updates database connections, and establishes port-forwarding.
# Usage:
#   ./nifi_processor_manager.sh [dev|test|prod] [--debug|--verbose]
#
# Arguments:
#   [dev|test|prod] - The environment for which the script will run.
#   --debug         - Enables debug logging (most verbose).
#   --verbose       - Enables verbose logging.
#
# Features:
#   - Logs with multiple debug levels for clear tracing.
#   - Automatically manages port-forwarding.
#   - Handles processor execution and tracks its state.
#   - Updates NiFi database controller connections.
#
# Requirements:
#   - `jq` for JSON parsing.
#   - `lsof` for port check.
#   - OpenShift CLI (`oc`).

# Exit immediately if a command exits with a non-zero status and treat unset variables as errors
set -euo pipefail

# Debug Levels
readonly DEBUG_NONE=0
readonly DEBUG_ERROR=1
readonly DEBUG_WARN=2
readonly DEBUG_INFO=3
readonly DEBUG_VERBOSE=4
readonly DEBUG_DEBUG=5

# Default Debug Level
DEBUG_LEVEL=${DEBUG_LEVEL:-$DEBUG_INFO}

# NiFi Processor IDs
# Update these IDs as needed
readonly ORGANIZATION_PROCESSOR="328e2539-0192-1000-0000-00007a4304c1"
readonly USER_PROCESSOR="e6c63130-3eac-1b13-a947-ee0103275138"
readonly TRANSFER_PROCESSOR="b9d73248-1438-1418-a736-cc94c8c21e70"

# Global Port Configuration (Update these based on your setup)
declare -A LOCAL_PORTS=(
    [tfrs]=5435
    [lcfs]=5432
)
readonly TARGET_PORT=5432

# Centralized configuration for the NiFi API
readonly NIFI_API_URL="http://localhost:8091/nifi-api"
readonly MAX_RETRIES=5

# Advanced logging function
_log() {
    local level=$1
    local message=$2
    local caller=${FUNCNAME[1]}
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    # Check if the message's log level is less than or equal to current debug level
    if [ "$level" -le "$DEBUG_LEVEL" ]; then
        case $level in
        $DEBUG_ERROR)
            printf "\e[31m[ERROR][%s] %s\e[0m\n" "$timestamp" "$message" >&2
            ;;
        $DEBUG_WARN)
            printf "\e[33m[WARN][%s] %s\e[0m\n" "$timestamp" "$message" >&2
            ;;
        $DEBUG_INFO)
            printf "\e[32m[INFO][%s] %s\e[0m\n" "$timestamp" "$message" >&2
            ;;
        $DEBUG_VERBOSE)
            printf "\e[34m[VERBOSE][%s] %s\e[0m\n" "$timestamp" "$message" >&2
            ;;
        $DEBUG_DEBUG)
            printf "\e[36m[DEBUG][%s] %s\e[0m\n" "$timestamp" "$message" >&2
            ;;
        esac
    fi
}

# Shortcut logging functions
error() { _log $DEBUG_ERROR "$1"; }
warn() { _log $DEBUG_WARN "$1"; }
info() { _log $DEBUG_INFO "$1"; }
verbose() { _log $DEBUG_VERBOSE "$1"; }
debug() { _log $DEBUG_DEBUG "$1"; }

# Error handling function
error_exit() {
    error "$1"
    exit 1
}

# Robust curl wrapper with retry mechanism
curl_with_retry() {
    local max_attempts=$1
    shift
    local url=$1
    local method=${2:-GET}
    local data=${3:-}
    local attempt=1

    info "Curl Request: $method $url"
    verbose "Max Attempts: $max_attempts"

    while [ $attempt -lt "$max_attempts" ]; do
        debug "Attempt $attempt for $url"
        local response
        local http_code

        if [ -z "$data" ]; then
            response=$(curl -sS -w "%{http_code}" -X "$method" "$url")
        else
            response=$(curl -sS -w "%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$url")
        fi

        http_code=$(echo "$response" | tail -c 4)
        response_body=$(echo "$response" | head -c -4)

        if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
            verbose "Curl successful. HTTP Code: $http_code"
            echo "$response_body"
            return 0
        fi

        warn "Curl attempt $attempt failed. HTTP Code: $http_code"
        ((attempt++))
        sleep $((attempt * 2))
    done

    error_exit "Curl failed after $max_attempts attempts: $url"
}

# Enhanced controller service enable function
enable_controller_service() {
    local service_id=$1

    info "Enabling controller service $service_id"
    local current_config revision_version response

    current_config=$(curl_with_retry 3 "$NIFI_API_URL/controller-services/$service_id")
    revision_version=$(echo "$current_config" | jq -r '.revision.version')

    verbose "Current Revision: $revision_version"

    response=$(curl_with_retry 3 "$NIFI_API_URL/controller-services/$service_id/run-status" PUT "{\"state\": \"ENABLED\", \"revision\": { \"version\": $revision_version }}")

    info "Controller service $service_id enabled successfully."
}

# Improved processor execution tracking for single run
execute_processor() {
    local processor_id=$1
    local env=$2

    info "Triggering single execution for processor $processor_id"
    local current_config revision_version response

    # Fetch the current processor configuration
    current_config=$(curl_with_retry 3 "$NIFI_API_URL/processors/$processor_id")
    revision_version=$(echo "$current_config" | jq -r '.revision.version')

    verbose "Processor current revision: $revision_version"

    # Prepare payload for single run
    local run_once_payload=$(jq -n \
        --argjson revision_version "$revision_version" \
        '{
            "revision": { "version": $revision_version },
            "state": "RUN_ONCE",
            "disconnectedNodeAcknowledged": false,
        }')

    # Send run once request
    response=$(curl -sS -w "%{http_code}" -X PUT \
        -H "Content-Type: application/json" \
        -d "$run_once_payload" \
        "$NIFI_API_URL/processors/$processor_id/run-status")

    local http_code=$(echo "$response" | tail -c 4)
    local response_body=$(echo "$response" | head -c -4)

    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        info "Processor $processor_id triggered for single run successfully"
        sleep 60
    else
        error "Failed to trigger single run for processor $processor_id. HTTP Code: $http_code"
        error "Response: $response_body"
        return 1
    fi

    # Monitor processor execution with timeout
    local max_wait_time=300  # 5 minutes max wait
    local start_time=$(date +%s)
    local timeout=$((start_time + max_wait_time))

    while true; do
        local current_time=$(date +%s)
        
        # Check if we've exceeded timeout
        if [ "$current_time" -gt "$timeout" ]; then
            error "Processor $processor_id execution timed out after $max_wait_time seconds"
            return 1
        fi

        # Get processor status
        local processor_status
        processor_status=$(curl_with_retry 3 "$NIFI_API_URL/processors/$processor_id" | jq '.status.aggregateSnapshot')
        
        local active_threads=$(echo "$processor_status" | jq '.activeThreadCount')
        local processed_count=$(echo "$processor_status" | jq '.flowFilesProcessed')

        verbose "Processor $processor_id - Active Threads: $active_threads, Processed: $processed_count"

        # Check if processing is complete
        if [ "$active_threads" -eq 0 ]; then
            info "Processor $processor_id completed single run execution"
            break
        fi

        sleep 2
    done
}

# Robust leader pod detection
get_leader_pod() {
    local namespace=$1
    local app_label=$2

    info "Detecting leader pod for $app_label in $namespace"

    local leader_pod
    leader_pod=$(oc get pods -n "$namespace" -o name | grep "$app_label" | while read -r pod; do
        debug "Checking pod: $pod"
        if oc exec -n "$namespace" "$pod" -- bash -c "psql -U postgres -tAc \"SELECT pg_is_in_recovery()\"" | grep -q 'f'; then
            echo "$pod"
            break
        fi
    done)

    if [ -z "$leader_pod" ]; then
        error_exit "No leader pod found for $app_label in $namespace"
    fi

    verbose "Leader pod detected: $leader_pod"
    echo "$leader_pod"
}

# Consolidated port forwarding
forward_database_ports() {
    local env=$1
    local pid_file=$(mktemp)

    info "Initiating port forwarding for environment: $env"

    local port_mappings=(
        "tfrs:0ab226-$env:tfrs-spilo:tfrs"
        # "lcfs:d2bd59-$env:lcfs-crunchy-$env-lcfs:lcfs"  # Uncomment if you want to load directly to LCFS openshift environment
    )

    for mapping in "${port_mappings[@]}"; do
        IFS=':' read -r app namespace app_label app_key <<<"$mapping"
        local_port=${LOCAL_PORTS[$app_key]}

        verbose "Port forwarding for $app: $local_port -> $TARGET_PORT"

        service_name=$(get_leader_pod "$namespace" "$app_label")
        oc -n "$namespace" port-forward "$service_name" "$local_port:$TARGET_PORT" &
        echo $! >>"$pid_file"
    done

    trap "
        debug 'Cleaning up port-forward processes';
        kill \$(tr '\n' ' ' < '$pid_file') 2>/dev/null;
        rm -f '$pid_file'
    " EXIT
}

# Update NiFi database connection
update_nifi_connection() {
    local controller_service_id=$1
    local namespace=$2
    local pod_pattern=$3
    local app=$4

    info "Updating NiFi connection for $app in $namespace"
    debug "Controller Service ID: $controller_service_id"
    debug "Pod Pattern: $pod_pattern"
    debug "App: $app"
    debug "Namespace: $namespace"

    local pod_name db_env_vars database_user database_pass database_name database_url
    local local_port=${LOCAL_PORTS[$app]}

    verbose "Using local port $local_port for $app"

    pod_name=$(oc get pods -n "$namespace" -o name | grep "$pod_pattern" | head -n 1)

    if [ -z "$pod_name" ]; then
        error_exit "No pod found matching $pod_pattern"
    fi

    debug "Selected pod: $pod_name"

    case "$app" in
    tfrs)
        db_env_vars=$(oc exec -n "$namespace" "$pod_name" -- env | grep 'DATABASE_')
        database_user=$(echo "$db_env_vars" | grep 'DATABASE_USER' | cut -d'=' -f2)
        database_pass=$(echo "$db_env_vars" | grep 'DATABASE_PASSWORD' | cut -d'=' -f2)
        database_name=$(echo "$db_env_vars" | grep 'DATABASE_NAME' | cut -d'=' -f2)
        ;;
    lcfs)
        db_env_vars=$(oc exec -n "$namespace" "$pod_name" -- bash -c "env | grep 'LCFS_DB_")
        database_user=$(echo "$db_env_vars" | grep 'LCFS_DB_USER' | cut -d'=' -f2)
        database_pass=$(echo "$db_env_vars" | grep 'LCFS_DB_PASS' | cut -d'=' -f2)
        database_name=$(echo "$db_env_vars" | grep 'LCFS_DB_NAME' | cut -d'=' -f2)
        ;;
    *)
        error_exit "Invalid application: $app"
        ;;
    esac

    database_url="jdbc:postgresql://host.docker.internal:$local_port/$database_name"

    verbose "Database Connection Details:"
    verbose "  URL:  $database_url"
    verbose "  User: $database_user"

    local controller_config current_name revision_version updated_config response

    # Get and update controller service configuration
    controller_config=$(curl_with_retry 3 "$NIFI_API_URL/controller-services/$controller_service_id")
    current_name=$(echo "$controller_config" | jq -r '.component.name')
    revision_version=$(echo "$controller_config" | jq '.revision.version')

    debug "Current Service Name: $current_name"
    debug "Current Revision: $revision_version"
    debug "Disabling the controller service."

    controller_config=$(curl_with_retry 3 "$NIFI_API_URL/controller-services/$controller_service_id/run-status" PUT "{\"state\": \"DISABLED\", \"revision\": { \"version\": $revision_version }}")
    current_state=$(echo "$controller_config" | jq -r '.component.state')
    current_name=$(echo "$controller_config" | jq -r '.component.name')
    revision_version=$(echo "$controller_config" | jq '.revision.version')

    # Wait for the service to be disabled
    debug "Waiting for the controller service to be disabled..."
    while true; do
        controller_config=$(curl_with_retry 3 "$NIFI_API_URL/controller-services/$controller_service_id")
        current_state=$(echo "$controller_config" | jq -r '.component.state')
        if [ "$current_state" == "DISABLED" ]; then
            break
        fi
        warn "Controller service is not yet disabled. Retrying in 2 seconds..."
        sleep 2
    done
    # Update the controller service with new credentials and keep the name unchanged
    debug "Updating NiFi controller service with new database credentials..."
    updated_config=$(jq -n \
        --arg name "$current_name" \
        --arg db_url "$database_url" \
        --arg db_user "$database_user" \
        --arg db_pass "$database_pass" \
        --argjson version "$revision_version" \
        '{
            "revision": { "version": $version },
            "component": {
                "id": "'$controller_service_id'",
                "name": "Database Connection Pool",
                "properties": {
                    "Database Connection URL": $db_url,
                    "Database User": $db_user,
                    "Password": $db_pass
                }
            }
        }')
    response=$(curl_with_retry 3 "$NIFI_API_URL/controller-services/$controller_service_id" PUT "$updated_config")

    info "Controller service updated successfully."
    enable_controller_service "$controller_service_id"
}

# Main execution
main() {
    # Parse command-line arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
        --debug)
            DEBUG_LEVEL=$DEBUG_DEBUG
            shift
            ;;
        --verbose)
            DEBUG_LEVEL=$DEBUG_VERBOSE
            shift
            ;;
        *)
            break
            ;;
        esac
    done

    local env=${1:?Usage: $0 [dev|test|prod] [--debug|--verbose]}

    [[ $env =~ ^(dev|test|prod)$ ]] || error_exit "Invalid environment. Use 'dev', 'test', or 'prod'."

    info "Starting NiFi Processor Management Script"
    info "Environment: $env"
    info "Debug Level: $DEBUG_LEVEL"

    info "Checking OpenShift credentials"
    oc whoami

    # Controller service configuration
    local LCFS_CONTROLLER_SERVICE_ID="3244bf63-0192-1000-ffff-ffffc8ec6d93"
    local TFRS_CONTROLLER_SERVICE_ID="3245b078-0192-1000-ffff-ffffba20c1eb"

    # Update NiFi connections
    # update_nifi_connection "$LCFS_CONTROLLER_SERVICE_ID" "d2bd59-$env" "lcfs-backend-$env" "lcfs" # Uncomment if we're loading the data to openshift database.
    update_nifi_connection "$TFRS_CONTROLLER_SERVICE_ID" "0ab226-$env" "tfrs-backend-$env" "tfrs"
    ## Duplicating as the connections gets disconnected when the port forwarding is enabled for first time.
    forward_database_ports "$env"
    sleep 5 # Allow time for port forwarding
    info "Executing processors in sequence..."
    execute_processor "$ORGANIZATION_PROCESSOR" "$env"
    ##
    # Actual processing starts here
    forward_database_ports "$env"
    sleep 5 # Allow time for port forwarding
    # Expand these processors as needed
    execute_processor "$ORGANIZATION_PROCESSOR" "$env"
    execute_processor "$USER_PROCESSOR" "$env"
    execute_processor "$TRANSFER_PROCESSOR" "$env"

    info "All processors executed successfully."
    info "Validate all the loaded data manually in the database."
}

main "$@"
