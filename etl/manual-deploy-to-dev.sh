#!/bin/bash

# Manual deployment script for LCFS dev database
# This script contains the exact manual commands that work for deploying to a dev pod

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}** $1${NC}"
}

print_error() {
    echo -e "${RED}ERROR: $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}WARNING: $1${NC}"
}

# Configuration
LOCAL_CONTAINER="f7091c69420b"
DEV_POD="lcfs-postgres-dev-3006-postgresql-0"
DB_NAME="lcfs"
LOCAL_USER="lcfs"
REMOTE_USER="postgres"
REMOTE_PASSWORD="test"
DUMP_FILE="lcfs-manual-deploy.tar"

print_status "Manual LCFS Database Deployment to Dev Environment"
echo
echo "Configuration:"
echo "  Local Container: $LOCAL_CONTAINER"
echo "  Dev Pod: $DEV_POD"
echo "  Database: $DB_NAME"
echo "  Local User: $LOCAL_USER"
echo "  Remote User: $REMOTE_USER"
echo

# Step 1: Verify local container is running
print_status "Step 1: Verifying local container is running..."
if ! docker ps | grep -q "$LOCAL_CONTAINER"; then
    print_error "Local container $LOCAL_CONTAINER is not running"
    exit 1
fi
print_status "Local container is running"

# Step 2: Verify OpenShift connection and pod access
print_status "Step 2: Verifying OpenShift connection and pod access..."
if ! oc whoami >/dev/null 2>&1; then
    print_error "Not logged into OpenShift"
    exit 1
fi

if ! oc get pod "$DEV_POD" >/dev/null 2>&1; then
    print_error "Cannot access pod $DEV_POD"
    exit 1
fi
print_status "OpenShift connection and pod access verified"

# Step 3: Create database dump from local container
print_status "Step 3: Creating database dump from local container..."
docker exec "$LOCAL_CONTAINER" bash -c "pg_dump -U $LOCAL_USER -F t --no-privileges --no-owner -c -d $DB_NAME > /tmp/$DUMP_FILE"
print_status "Database dump created successfully"

# Step 4: Copy dump file from local container to host
print_status "Step 4: Copying dump file from container to host..."
docker cp "$LOCAL_CONTAINER:/tmp/$DUMP_FILE" "./$DUMP_FILE"

# Verify file was copied and get size
if [ ! -f "./$DUMP_FILE" ]; then
    print_error "Failed to copy dump file from container"
    exit 1
fi

file_size=$(stat -f%z "./$DUMP_FILE" 2>/dev/null || stat -c%s "./$DUMP_FILE" 2>/dev/null)
print_status "Dump file copied successfully (Size: $(numfmt --to=iec-i --suffix=B $file_size 2>/dev/null || echo "$file_size bytes"))"

# Step 5: Upload dump file to OpenShift pod
print_status "Step 5: Uploading dump file to OpenShift pod..."
oc cp "./$DUMP_FILE" "$DEV_POD:/tmp/$DUMP_FILE"
print_status "Dump file uploaded to pod"

# Step 6: Verify file exists on pod
print_status "Step 6: Verifying file exists on pod..."
if ! oc exec "$DEV_POD" -- ls -la "/tmp/$DUMP_FILE" >/dev/null 2>&1; then
    print_error "Dump file not found on pod"
    exit 1
fi
remote_size=$(oc exec "$DEV_POD" -- stat -c%s "/tmp/$DUMP_FILE" 2>/dev/null || echo "unknown")
print_status "File verified on pod (Remote size: $remote_size bytes)"

# Step 7: Test database connection
print_status "Step 7: Testing database connection..."
if ! oc exec "$DEV_POD" -- bash -c "PGPASSWORD='$REMOTE_PASSWORD' psql -U $REMOTE_USER -d $DB_NAME -c 'SELECT version();'" >/dev/null 2>&1; then
    print_error "Cannot connect to database on pod"
    exit 1
fi
print_status "Database connection test successful"

# Step 8: Show confirmation and get user approval
echo
print_warning "FINAL CONFIRMATION"
echo "=========================================="
echo "About to restore database with the following settings:"
echo "  Source: Local container $LOCAL_CONTAINER"
echo "  Destination: Pod $DEV_POD"
echo "  Database: $DB_NAME"
echo "  User: $REMOTE_USER"
echo "  File: $DUMP_FILE ($file_size bytes)"
echo
print_warning "This will COMPLETELY REPLACE the database in the dev environment!"
echo
read -p "Type 'DEPLOY' to proceed with the restore: " confirm

if [ "$confirm" != "DEPLOY" ]; then
    print_status "Deployment cancelled by user"
    # Cleanup
    oc exec "$DEV_POD" -- rm -f "/tmp/$DUMP_FILE" 2>/dev/null || true
    rm -f "./$DUMP_FILE"
    exit 0
fi

# Step 9: Perform database restore
print_status "Step 9: Performing database restore..."
print_status "This may take several minutes and you will see some expected errors..."

# Run the restore command
oc exec "$DEV_POD" -- bash -c "PGPASSWORD='$REMOTE_PASSWORD' pg_restore -U $REMOTE_USER --dbname=$DB_NAME --no-owner --clean --if-exists --verbose /tmp/$DUMP_FILE" || {
    print_warning "Restore completed with some errors (this is normal)"
}

# Step 10: Verify restore success
print_status "Step 10: Verifying restore success..."

# Check table count
table_count=$(oc exec "$DEV_POD" -- bash -c "PGPASSWORD='$REMOTE_PASSWORD' psql -U $REMOTE_USER -d $DB_NAME -tAc \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'\"")
print_status "Tables in database: $table_count"

# Check key table row counts
print_status "Checking key table row counts..."
for table in compliance_report organization transfer_history user_profile fuel_code; do
    row_count=$(oc exec "$DEV_POD" -- bash -c "PGPASSWORD='$REMOTE_PASSWORD' psql -U $REMOTE_USER -d $DB_NAME -tAc \"SELECT COUNT(*) FROM $table\" 2>/dev/null" || echo "N/A")
    echo "  $table: $row_count rows"
done

# Step 11: Cleanup files
print_status "Step 11: Cleaning up temporary files..."
oc exec "$DEV_POD" -- rm -f "/tmp/$DUMP_FILE"
docker exec "$LOCAL_CONTAINER" -- rm -f "/tmp/$DUMP_FILE"
rm -f "./$DUMP_FILE"
print_status "Cleanup completed"

# Step 12: Final summary
echo
print_status "DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo "=========================================="
echo "Summary:"
echo "  Local database exported from: $LOCAL_CONTAINER"
echo "  Deployed to dev pod: $DEV_POD"
echo "  Database: $DB_NAME"
echo "  Tables restored: $table_count"
echo
print_status "Your local changes are now live in the dev environment!"
echo
print_status "Next steps:"
echo "1. Test your application in the dev environment"
echo "2. Verify your changes are working correctly"
echo "3. Monitor application logs for any issues"

# Show how to access logs
echo
echo "Useful commands:"
echo "  Check pod logs: oc logs $DEV_POD -f"
echo "  Connect to database: oc exec $DEV_POD -- bash -c \"PGPASSWORD='$REMOTE_PASSWORD' psql -U $REMOTE_USER -d $DB_NAME\""
echo "  Check pod status: oc get pod $DEV_POD"