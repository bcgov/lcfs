# Parallel Backend Testing Setup

This document explains the parallel test execution setup for the LCFS backend tests.

## Overview

The backend tests have been configured to run in parallel using GitHub Actions matrix strategy. This reduces test execution time from ~15-20 minutes to ~3-5 minutes by running tests across 6 parallel jobs.

## How It Works

### Job Distribution

Tests are distributed across 6 parallel jobs by domain/business functionality:

1. **Job 1**: `compliance_report` (10 test files - largest module)
2. **Job 2**: `fuel_supply,final_supply_equipment,allocation_agreement` (15 files)
3. **Job 3**: `fuel_export,fuel_code,other_uses,notional_transfer` (16 files)
4. **Job 4**: `services,user,transfer,transaction` (12 files)
5. **Job 5**: `organization,organization_snapshot,notification,initiative_agreement` (9 files)
6. **Job 6**: `credit_ledger,calculator,audit_log,organizations,internal_comment,document,admin_adjustment` (remaining files)

### Database Isolation

Each parallel job uses its own isolated database:
- Job 1: `lcfs_test_job_1`
- Job 2: `lcfs_test_job_2`
- Job 3: `lcfs_test_job_3`
- Job 4: `lcfs_test_job_4`
- Job 5: `lcfs_test_job_5`
- Job 6: `lcfs_test_job_6`

This prevents conflicts between tests running simultaneously.

## Configuration Files

### GitHub Actions Workflow
- **File**: `.github/workflows/backend-tests.yml`
- **Purpose**: Defines the parallel job matrix and execution strategy
- **Services**: PostgreSQL, Redis, RabbitMQ (each job gets isolated access)

### Backend Configuration
- **File**: `backend/lcfs/conftest.py`
- **Changes**: Modified `_engine` fixture to support dynamic database names
- **Environment**: Uses `LCFS_DB_BASE` environment variable for database naming

### Pytest Configuration
- **File**: `backend/pyproject.toml`
- **Changes**: Updated pytest options for better parallel execution
- **Discovery**: Enhanced test discovery patterns

## Local Development

### Running Tests Locally (Sequential)
```bash
cd backend
poetry run pytest lcfs/tests/
```

### Testing Parallel Setup Locally
```bash
# Test a specific group with custom database name
export LCFS_DB_BASE=lcfs_test_local_1
cd backend
poetry run pytest lcfs/tests/compliance_report/ -v
```

### Testing Multiple Groups Locally
```bash
# Simulate parallel execution (requires multiple terminal windows)
# Terminal 1:
export LCFS_DB_BASE=lcfs_test_local_1
poetry run pytest lcfs/tests/compliance_report/

# Terminal 2:  
export LCFS_DB_BASE=lcfs_test_local_2
poetry run pytest lcfs/tests/fuel_supply/
```

## GitHub Actions Usage

### Triggering Parallel Tests
The workflow automatically triggers on:
- Push to `main`, `develop`, or `release-*` branches (when backend files change)
- Pull requests to `main`, `develop`, or `release-*` branches (when backend files change)

### GitHub Actions Versions
The workflow uses current stable versions:
- `actions/checkout@v4`
- `actions/setup-python@v5` 
- `actions/cache@v4`
- `actions/upload-artifact@v4`
- `codecov/codecov-action@v4`

### Monitoring Execution
1. Go to GitHub Actions tab in the repository
2. Look for "Backend Tests (Parallel)" workflow
3. Each job shows individual progress and logs
4. Test results are aggregated in the final summary

### Adding New Test Modules
When adding new test modules:

1. Create test directory: `backend/lcfs/tests/new_module/`
2. Add test files following naming convention: `test_*.py`
3. Update workflow grouping in `.github/workflows/backend-tests.yml` if needed
4. Tests will be automatically discovered and executed

## Performance Benefits

- **Execution Time**: Reduced from 15-20 minutes to 3-5 minutes
- **Parallel Jobs**: 6 simultaneous executions
- **Speedup Factor**: ~4-5x improvement
- **Resource Usage**: Better CI resource utilization

## Troubleshooting

### Database Connection Issues
- Check PostgreSQL service is running in CI
- Verify database permissions for test user
- Ensure each job has unique database name

### Test Failures in Parallel Mode
- Check for shared state dependencies between tests
- Verify test isolation (no cross-test data dependencies)
- Review database rollback behavior in fixtures

### Job Imbalance
- Monitor job execution times in GitHub Actions
- Redistribute test groups if some jobs take significantly longer
- Consider test complexity when grouping modules

## Migration from Sequential to Parallel

### Backward Compatibility
- Local development remains unchanged (runs sequentially by default)
- Existing test commands continue to work
- No changes required to individual test files

### Environment Variables
- `LCFS_DB_BASE`: Database name (defaults to `lcfs_test`)
- `APP_ENVIRONMENT`: Always set to `pytest` for tests
- Other settings remain unchanged

## Future Enhancements

### Phase 2 Optimizations
- Add pytest-xdist for within-job parallelization
- Implement UUID-based IDs to eliminate sequence conflicts
- Add job-level retry logic for transient failures
- Optimize fixture setup for faster database operations

### Monitoring
- Add execution time tracking per job
- Implement test result analytics
- Monitor for test flakiness in parallel mode