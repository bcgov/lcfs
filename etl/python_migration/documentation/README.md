# TFRS to LCFS Data Migration - Python Scripts

This directory contains Python migration scripts that replace the Groovy scripts used for migrating data from the TFRS (Transportation Fuels Reporting System) to the LCFS (Low Carbon Fuel Standard) system.

## Overview

These scripts migrate historical compliance data from TFRS to LCFS, handling schema differences between the two systems. The migration includes compliance summaries, history records, fuel supply data, allocation agreements, and other uses data.

## Project Structure

```
python_migration/
├── README.md                           # This file
├── requirements.txt                    # Python dependencies
├── .env.example                        # Environment configuration template
├── config.py                          # Database configuration
├── database.py                        # Database connection utilities
├── utils.py                          # Common utility functions
├── compliance_summary.py              # Compliance summary migration
├── compliance_summary_update.py       # Compliance summary updates
├── compliance_report_history.py       # Compliance report history migration
├── allocation_agreement.py            # Allocation agreement migration
├── other_uses.py                      # Other uses (Schedule C) migration
├── notional_transfer.py               # Notional transfer (Schedule A) migration
├── fuel_supply.py                     # Fuel supply (Schedule B) migration
├── orphaned_allocation_agreement.py   # Orphaned allocation agreement migration
├── run_all_migrations.py              # Script to run all migrations in order
└── VERSIONING_REVIEW.md               # Group UUID versioning system review
```

## Setup

1. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Database Configuration**
   
   Update the `.env` file with your database connection details:
   ```
   # TFRS (source) database
   TFRS_DB_HOST=localhost
   TFRS_DB_PORT=5432
   TFRS_DB_NAME=tfrs
   TFRS_DB_USER=tfrs_user
   TFRS_DB_PASSWORD=tfrs_password

   # LCFS (destination) database
   LCFS_DB_HOST=localhost
   LCFS_DB_PORT=5432
   LCFS_DB_NAME=lcfs
   LCFS_DB_USER=lcfs_user
   LCFS_DB_PASSWORD=lcfs_password
   ```

## Migration Scripts

### 1. compliance_summary.py
Migrates compliance report summary data from TFRS to LCFS.

**What it does:**
- Fetches compliance summary records from TFRS
- Maps legacy compliance report IDs to LCFS IDs
- Inserts summary records with proper field mapping
- Handles gasoline/diesel class data mapping

**Usage:**
```bash
python compliance_summary.py
```

### 2. compliance_summary_update.py
Updates existing compliance summary records with snapshot data from TFRS.

**What it does:**
- Parses JSON snapshot data from TFRS
- Extracts line-by-line compliance data
- Updates LCFS summary records with calculated values
- Stores historical snapshot data

**Usage:**
```bash
python compliance_summary_update.py
```

### 3. compliance_report_history.py
Migrates compliance report workflow history.

**What it does:**
- Maps TFRS workflow states to LCFS status IDs
- Handles status progression logic
- Excludes draft and supplemental records
- Maintains audit trail of report changes

**Usage:**
```bash
python compliance_report_history.py
```

### 4. allocation_agreement.py
Migrates allocation agreement data between organizations.

**What it does:**
- Processes exclusion agreement records
- Maps fuel types and transaction types
- Implements versioning for agreement changes
- Handles partner and quantity information

**Usage:**
```bash
python allocation_agreement.py
```

### 5. other_uses.py
Migrates Schedule C (other uses) data.

**What it does:**
- Processes fuel use records for non-transportation purposes
- Handles supplemental report chains
- Maps expected use types and fuel categories
- Implements change detection and versioning

**Usage:**
```bash
python other_uses.py
```

## Common Features

All migration scripts include:

- **Error Handling**: Comprehensive exception handling with detailed logging
- **Data Validation**: Input validation and safe type conversion
- **Logging**: Detailed logging to files and console
- **Transaction Management**: Proper database transaction handling
- **Mapping Logic**: Handles schema differences between TFRS and LCFS
- **Progress Tracking**: Reports on successful/skipped records

## Running Migrations

1. **Test Database Connections**
   ```python
   from database import tfrs_db, lcfs_db
   print("TFRS:", tfrs_db.test_connection())
   print("LCFS:", lcfs_db.test_connection())
   ```

2. **Run Individual Scripts**
   ```bash
   # Run specific migration
   python compliance_summary.py
   
   # Run with debug logging
   python -c "
   import logging
   logging.basicConfig(level=logging.DEBUG)
   exec(open('compliance_summary.py').read())
   "
   ```

3. **Monitor Progress**
   - Check console output for real-time progress
   - Review log files for detailed information
   - Monitor database for inserted records

## Key Differences from Groovy Scripts

- **Database Connections**: Uses connection pooling with context managers
- **Error Handling**: More granular exception handling
- **Type Safety**: Explicit type conversion and validation
- **Logging**: Structured logging with multiple output formats
- **Configuration**: Environment-based configuration management
- **Testing**: Built-in connection testing capabilities

## Troubleshooting

### Common Issues

1. **Connection Errors**
   - Verify database credentials in `.env`
   - Check network connectivity
   - Ensure databases are running

2. **Permission Errors**
   - Verify user has read access to TFRS database
   - Verify user has write access to LCFS database
   - Check table-level permissions

3. **Data Issues**
   - Review log files for validation errors
   - Check for missing reference data
   - Verify legacy_id mappings exist

4. **Performance Issues**
   - Monitor database connections
   - Consider batch size adjustments
   - Check database indexes

### Log Analysis

Log files are created with timestamps:
```
migration_YYYYMMDD_HHMMSS.log
```

Look for:
- `ERROR` level messages for failures
- `WARNING` level messages for data issues
- `INFO` level messages for progress updates

## Migration Order

Recommended order for running migrations:

1. `compliance_summary.py` - Base summary data
2. `compliance_summary_update.py` - Enhanced summary data
3. `compliance_report_history.py` - Workflow history
4. `allocation_agreement.py` - Agreement data
5. `other_uses.py` - Schedule C data

## Data Mapping Notes

### Status Mapping
- TFRS workflow states → LCFS status IDs
- Handles multi-stage approval process
- Excludes draft and supplemental states

### Fuel Type Mapping
- TFRS fuel types → LCFS fuel types
- Includes category classification
- Handles legacy type conversions

### Unit Conversion
- Standardizes unit representations
- Maps abbreviated units to full names
- Validates unit compatibility

## Performance Considerations

- Scripts process records in batches
- Database connections are managed per operation
- Memory usage is optimized for large datasets
- Progress is logged for monitoring

## Maintenance

- Review and update mappings as schemas evolve
- Monitor log files for data quality issues
- Test scripts against sample data before production runs
- Keep configuration files secure and backed up