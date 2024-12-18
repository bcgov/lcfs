#!/usr/bin/env bash
# A Simplified NiFi Processor Management Script for Local Databases
#
# This script manages NiFi processors and updates database connection configurations
# for a local setup, without OpenShift or port-forwarding. It assumes:
#  - NiFi is running locally and accessible at http://localhost:8091
#  - TFRS and LCFS databases are running locally on specified ports.
#
# Usage:
#   ./local_nifi_manager.sh [--debug|--verbose]
#
# Features:
#   - No OpenShift or port-forwarding; everything runs locally.
#   - Updates NiFi database controller connections to point to local DBs.
#   - Triggers NiFi processors to run once and waits for them to finish.
#
# Requirements:
#   - `jq` for JSON parsing.
#   - NiFi running locally and accessible via the NiFi API.
#
# Notes:
#   Update the processor and controller service IDs, as well as the database credentials,
#   according to your local environment.

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

# Processor and Controller Service IDs (Update these as needed)
ORGANIZATION_PROCESSOR="328e2539-0192-1000-0000-00007a4304c1"
USER_PROCESSOR="e6c63130-3eac-1b13-a947-ee0103275138"
TRANSFER_PROCESSOR="b9d73248-1438-1418-a736-cc94c8c21e70"
TRANSACTIONS_PROCESSOR="7a010ef5-0193-1000-ffff-ffff8c22e67e"

# Controller Service IDs for local DB connections (Update these)
LCFS_CONTROLLER_SERVICE_ID="32417e8c-0192-1000-ffff-ffff8ccb5dfa"
TFRS_CONTROLLER_SERVICE_ID="3245b078-0192-1000-ffff-ffffba20c1eb"

# Local Database Configuration (Update as needed)
# Example: TFRS DB at localhost:5435, LCFS DB at localhost:5432
TFRS_DB_PORT=5435
TFRS_DB_USER="tfrs"
TFRS_DB_PASS="development_only"
TFRS_DB_NAME="tfrs"

LCFS_DB_PORT=5432
LCFS_DB_USER="lcfs"
LCFS_DB_PASS="development_only"
LCFS_DB_NAME="lcfs"

# NiFi API URL
NIFI_API_URL="http://localhost:8091/nifi-api"
MAX_RETRIES=5

# Logging function
_log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    if [ "$level" -le "$DEBUG_LEVEL" ]; then
        case $level in
            $DEBUG_ERROR)  printf "\e[31m[ERROR][%s] %s\e[0m\n" "$timestamp" "$message" >&2 ;;
            $DEBUG_WARN)   printf "\e[33m[WARN][%s] %s\e[0m\n" "$timestamp" "$message" >&2 ;;
            $DEBUG_INFO)   printf "\e[32m[INFO][%s] %s\e[0m\n" "$timestamp" "$message" >&2 ;;
            $DEBUG_VERBOSE)printf "\e[34m[VERBOSE][%s] %s\e[0m\n" "$timestamp" "$message" >&2 ;;
            $DEBUG_DEBUG)  printf "\e[36m[DEBUG][%s] %s\e[0m\n" "$timestamp" "$message" >&2 ;;
        esac
    fi
}

error() { _log $DEBUG_ERROR "$1"; }
warn() { _log $DEBUG_WARN "$1"; }
info() { _log $DEBUG_INFO "$1"; }
verbose() { _log $DEBUG_VERBOSE "$1"; }
debug() { _log $DEBUG_DEBUG "$1"; }

error_exit() {
    error "$1"
    exit 1
}

curl_with_retry() {
    local max_attempts=$1
    shift
    local url=$1
    local method=${2:-GET}
    local data=${3:-}
    local attempt=1

    info "Curl Request: $method $url"
    verbose "Max Attempts: $max_attempts"

    while [ $attempt -le "$max_attempts" ]; do
        debug "Attempt $attempt for $url"
        local response
        local http_code

        if [ -z "$data" ]; then
            response=$(curl -sS -w "%{http_code}" -X "$method" "$url")
        else
            response=$(curl -sS -w "%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$url")
        fi

        http_code="${response: -3}"
        response_body="${response:0:${#response}-3}"

        if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
            verbose "Curl successful. HTTP Code: $http_code"
            echo "$response_body"
            return 0
        fi

        warn "Curl attempt $attempt failed (HTTP $http_code). Retrying..."
        ((attempt++))
        sleep $((attempt * 2))
    done

    error_exit "Curl failed after $max_attempts attempts: $url"
}

enable_controller_service() {
    local service_id=$1
    info "Enabling controller service $service_id"
    local current_config revision_version

    current_config=$(curl_with_retry 3 "$NIFI_API_URL/controller-services/$service_id")
    revision_version=$(echo "$current_config" | jq -r '.revision.version')

    curl_with_retry 3 "$NIFI_API_URL/controller-services/$service_id/run-status" PUT "{\"state\": \"ENABLED\", \"revision\": { \"version\": $revision_version }}"
    info "Controller service $service_id enabled."
}

execute_processor() {
    local processor_id=$1

    info "Triggering single execution for processor $processor_id"
    local current_config revision_version

    current_config=$(curl_with_retry 3 "$NIFI_API_URL/processors/$processor_id")
    revision_version=$(echo "$current_config" | jq -r '.revision.version')

    local run_once_payload=$(jq -n \
        --argjson revision_version "$revision_version" \
        '{
            "revision": { "version": $revision_version },
            "state": "RUN_ONCE",
            "disconnectedNodeAcknowledged": false
        }')

    local response
    response=$(curl -sS -w "%{http_code}" -X PUT \
        -H "Content-Type: application/json" \
        -d "$run_once_payload" \
        "$NIFI_API_URL/processors/$processor_id/run-status")

    local http_code="${response: -3}"
    local response_body="${response:0:${#response}-3}"

    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        info "Processor $processor_id triggered for single run successfully"
        sleep 10
    else
        error "Failed to trigger single run for processor $processor_id (HTTP $http_code)"
        error "Response: $response_body"
        return 1
    fi

    # Wait for completion
    local max_wait_time=300
    local start_time=$(date +%s)
    local timeout=$((start_time + max_wait_time))

    while true; do
        local current_time=$(date +%s)
        if [ "$current_time" -gt "$timeout" ]; then
            error "Processor $processor_id execution timed out after $max_wait_time seconds"
            return 1
        fi

        local processor_status
        processor_status=$(curl_with_retry 3 "$NIFI_API_URL/processors/$processor_id" | jq '.status.aggregateSnapshot')
        
        local active_threads=$(echo "$processor_status" | jq '.activeThreadCount')
        local processed_count=$(echo "$processor_status" | jq '.flowFilesProcessed')

        verbose "Processor $processor_id - Active Threads: $active_threads, Processed: $processed_count"

        if [ "$active_threads" -eq 0 ]; then
            info "Processor $processor_id completed execution"
            break
        fi
        sleep 2
    done
}

update_nifi_connection() {
    local controller_service_id=$1
    local db_url=$2
    local db_user=$3
    local db_pass=$4

    info "Updating NiFi controller service $controller_service_id"

    local controller_config
    controller_config=$(curl_with_retry 3 "$NIFI_API_URL/controller-services/$controller_service_id")
    local revision_version=$(echo "$controller_config" | jq '.revision.version')
    local current_name=$(echo "$controller_config" | jq -r '.component.name')

    # Disable the controller service first
    info "Disabling controller service $controller_service_id"
    curl_with_retry 3 "$NIFI_API_URL/controller-services/$controller_service_id/run-status" PUT "{\"state\": \"DISABLED\", \"revision\": { \"version\": $revision_version }}"

    # Wait until disabled
    while true; do
        controller_config=$(curl_with_retry 3 "$NIFI_API_URL/controller-services/$controller_service_id")
        local current_state=$(echo "$controller_config" | jq -r '.component.state')
        if [ "$current_state" == "DISABLED" ]; then
            break
        fi
        warn "Controller service not yet disabled. Retrying..."
        sleep 2
    done

    local updated_config
    updated_config=$(jq -n \
        --arg name "$current_name" \
        --arg db_url "$db_url" \
        --arg db_user "$db_user" \
        --arg db_pass "$db_pass" \
        --argjson version "$revision_version" \
        '{
            "revision": { "version": $version },
            "component": {
                "id": "'$controller_service_id'",
                "name": $name,
                "properties": {
                    "Database Connection URL": $db_url,
                    "Database User": $db_user,
                    "Password": $db_pass
                }
            }
        }')

    curl_with_retry 3 "$NIFI_API_URL/controller-services/$controller_service_id" PUT "$updated_config"
    info "Controller service updated."

    enable_controller_service "$controller_service_id"
}

main() {
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

    info "Starting Local NiFi Manager"
    info "Debug Level: $DEBUG_LEVEL"

    # Prepare DB URLs for local connections
    local TFRS_DB_URL="jdbc:postgresql://localhost:$TFRS_DB_PORT/$TFRS_DB_NAME"
    local LCFS_DB_URL="jdbc:postgresql://localhost:$LCFS_DB_PORT/$LCFS_DB_NAME"

    info "Updating TFRS DB connection..."
    update_nifi_connection "$TFRS_CONTROLLER_SERVICE_ID" "$TFRS_DB_URL" "$TFRS_DB_USER" "$TFRS_DB_PASS"

    info "Updating LCFS DB connection..."
    update_nifi_connection "$LCFS_CONTROLLER_SERVICE_ID" "$LCFS_DB_URL" "$LCFS_DB_USER" "$LCFS_DB_PASS"

    info "Executing processors..."
    execute_processor "$ORGANIZATION_PROCESSOR"
    execute_processor "$USER_PROCESSOR"
    execute_processor "$TRANSFER_PROCESSOR"
    execute_processor "$TRANSACTIONS_PROCESSOR"

    info "All processors executed successfully."
    info "Check your local databases for the expected data."
}

main "$@"
