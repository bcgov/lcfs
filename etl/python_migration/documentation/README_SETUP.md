# Database Setup and Complete Migration Guide

This document explains how to use the new Python database setup and migration orchestration tools.

## Overview

The Python migration framework now includes automated database setup and orchestration capabilities that replace and enhance the original `data-transfer.sh` script.

## Key Components

### 1. `database_setup.py`
Python equivalent of `data-transfer.sh` with additional features:
- Automated database setup from OpenShift environments
- Database population verification
- Migration readiness checks
- Support for both TFRS and LCFS systems

### 2. `run_complete_migration.py`
Complete migration orchestrator that handles:
- Database setup (optional)
- Migration readiness verification
- Running all migration scripts
- Running all validation scripts
- Comprehensive reporting

## Usage Examples

### Complete Migration Process

Run the entire migration process from start to finish:

```bash
# Complete migration with database setup
python run_complete_migration.py complete \
  --tfrs-container my-tfrs-container \
  --lcfs-container my-lcfs-container \
  --env dev

# Complete migration using existing databases
python run_complete_migration.py complete --skip-setup

# Migration without validation (faster for testing)
python run_complete_migration.py complete \
  --tfrs-container my-tfrs-container \
  --lcfs-container my-lcfs-container \
  --skip-validation
```

### Individual Components

Set up databases only:
```bash
python run_complete_migration.py setup my-tfrs-container my-lcfs-container --env dev
```

Run migration only (assumes databases are ready):
```bash
python run_complete_migration.py migrate
```

Run validation only (assumes migration is complete):
```bash
python run_complete_migration.py validate
```

Check if databases are ready for migration:
```bash
python run_complete_migration.py check
```

### Database Setup Utilities

```bash
# Set up test environment with both databases
python database_setup.py setup my-tfrs-container my-lcfs-container dev

# Transfer specific data
python database_setup.py transfer tfrs dev import my-tfrs-container

# Verify database population
python database_setup.py verify-tfrs
python database_setup.py verify-lcfs

# Check migration readiness
python database_setup.py check-readiness
```

## Prerequisites

### 1. OpenShift CLI Setup
- Install and configure `oc` CLI
- Login to OpenShift: `oc login`
- Ensure you have access to both TFRS and LCFS projects

### 2. Docker Setup  
- Ensure Docker is running
- Have local PostgreSQL containers for TFRS and LCFS
- Containers should be running and accessible

### 3. Environment Configuration
- Set up `.env` file with database connection details
- Ensure Python dependencies are installed: `pip install -r requirements.txt`

## Database Container Setup

Example Docker commands to create local PostgreSQL containers:

```bash
# TFRS container
docker run -d --name my-tfrs-container \
  -e POSTGRES_DB=tfrs \
  -e POSTGRES_USER=tfrs \
  -e POSTGRES_PASSWORD=tfrs \
  -p 5432:5432 \
  postgres:13

# LCFS container  
docker run -d --name my-lcfs-container \
  -e POSTGRES_DB=lcfs \
  -e POSTGRES_USER=lcfs \
  -e POSTGRES_PASSWORD=lcfs \
  -p 5433:5432 \
  postgres:13
```

## Environment Variables

Required in `.env` file:

```bash
# TFRS (Source) Database
TFRS_DB_HOST=localhost
TFRS_DB_PORT=5432
TFRS_DB_NAME=tfrs
TFRS_DB_USER=tfrs
TFRS_DB_PASSWORD=tfrs

# LCFS (Destination) Database
LCFS_DB_HOST=localhost
LCFS_DB_PORT=5433
LCFS_DB_NAME=lcfs
LCFS_DB_USER=lcfs
LCFS_DB_PASSWORD=lcfs
```

## Migration Process Flow

1. **Database Setup** (Optional)
   - Downloads data from OpenShift environments
   - Restores to local PostgreSQL containers
   - Verifies data population

2. **Readiness Check**
   - Verifies source database has required tables and data
   - Confirms destination database is accessible
   - Checks for minimum data requirements

3. **Migration Execution**
   - Runs all migration scripts in correct order
   - Tracks progress and errors
   - Provides detailed logging

4. **Validation** (Optional)
   - Runs comprehensive validation suite
   - Compares source vs destination data
   - Generates detailed reports

## Output and Logging

The orchestrator produces:
- **Console output** with progress indicators and summaries
- **Detailed logs** with timestamps and component information
- **JSON result files** for validation results
- **Status codes** for integration with CI/CD systems

## Error Handling

- Each step validates prerequisites before proceeding
- Failed components don't prevent other components from running
- Detailed error messages help diagnose issues
- Cleanup operations ensure no leftover temporary files

## Advantages Over Shell Script

1. **Better Error Handling**: More robust error detection and recovery
2. **Integration**: Seamlessly integrates with Python migration scripts
3. **Validation**: Built-in verification of database state and migration results
4. **Flexibility**: Modular design allows running individual components
5. **Logging**: Comprehensive logging and reporting
6. **Cross-Platform**: Works on any platform with Python and Docker

## Troubleshooting

### Common Issues

**OpenShift Connection Failed**
```bash
# Check login status
oc whoami

# Re-login if needed  
oc login --server=https://your-openshift-server
```

**Docker Container Not Found**
```bash
# Check running containers
docker ps

# Start container if stopped
docker start my-tfrs-container
```

**Database Connection Failed**
- Verify `.env` file configuration
- Check container ports and networking
- Ensure PostgreSQL is accepting connections

**Insufficient Data**
- Verify source environment has sufficient test data
- Check table population with `verify-tfrs` command
- Consider using a different source environment

## Testing Workflow

Recommended workflow for development and testing:

```bash
# 1. Set up test environment
python run_complete_migration.py setup my-tfrs-container my-lcfs-container --env dev

# 2. Run migration with validation
python run_complete_migration.py complete --skip-setup

# 3. During development, run individual components
python run_complete_migration.py migrate  # Quick migration testing
python run_complete_migration.py validate # Validation only

# 4. Check readiness between iterations
python run_complete_migration.py check
```

This setup provides a robust, automated foundation for TFRS to LCFS migration testing and development.