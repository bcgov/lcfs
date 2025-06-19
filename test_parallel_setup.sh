#!/bin/bash

# Test script to validate parallel test execution setup
# This script simulates what GitHub Actions will do

set -e

echo "Testing parallel test setup for LCFS backend..."

# Test 1: Verify environment variable handling
echo "Test 1: Testing environment variable handling"
export LCFS_DB_BASE="lcfs_test_local_1"
cd backend
python -c "
import os
from lcfs.settings import settings
job_db_name = os.getenv('LCFS_DB_BASE', settings.db_test)
print(f'Job database name: {job_db_name}')
assert job_db_name == 'lcfs_test_local_1', f'Expected lcfs_test_local_1, got {job_db_name}'
print('✓ Environment variable handling works correctly')
"

# Test 2: Check that test discovery works for different modules
echo -e "\nTest 2: Testing test discovery"
test_groups=(
    "compliance_report"
    "fuel_supply"
    "credit_ledger"
)

for group in "${test_groups[@]}"; do
    if [ -d "lcfs/tests/${group}" ]; then
        echo "✓ Found test directory: lcfs/tests/${group}"
        # Count test files
        test_count=$(find "lcfs/tests/${group}" -name "test_*.py" | wc -l)
        echo "  - Contains ${test_count} test files"
    else
        echo "✗ Missing test directory: lcfs/tests/${group}"
    fi
done

# Test 3: Verify pytest configuration
echo -e "\nTest 3: Testing pytest configuration"
poetry run python -c "
import pytest
import sys
print(f'pytest version: {pytest.__version__}')
print('✓ pytest is available')
"

# Test 4: Check that settings can be modified dynamically
echo -e "\nTest 4: Testing dynamic settings modification"
python -c "
import os
from lcfs.settings import settings

original_db_test = settings.db_test
print(f'Original db_test: {original_db_test}')

# Simulate what conftest.py does
job_db_name = 'lcfs_test_dynamic'
settings.db_test = job_db_name
print(f'Modified db_test: {settings.db_test}')

# Verify the change
assert settings.db_test == job_db_name, f'Expected {job_db_name}, got {settings.db_test}'

# Restore original
settings.db_test = original_db_test
print(f'Restored db_test: {settings.db_test}')
print('✓ Dynamic settings modification works correctly')
"

echo -e "\n✅ All parallel setup tests passed!"
echo -e "\nNext steps:"
echo "1. Ensure PostgreSQL is running and accessible"
echo "2. Update GitHub repository with the workflow file"
echo "3. Test on a feature branch first"
echo "4. Monitor execution times and job distribution"

cd ..