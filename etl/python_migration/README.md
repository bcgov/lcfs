# TFRS to LCFS Migration Framework

A comprehensive Python-based framework for migrating data from the legacy TFRS (Transportation Fuels Reporting System) to the new LCFS (Low Carbon Fuel Standard) system.

## 📁 Project Structure

```
python_migration/
├── core/                          # Core infrastructure
│   ├── config.py                  # Database and environment configuration
│   ├── database.py                # Database connection utilities
│   └── utils.py                   # Common utility functions
│
├── migrations/                    # Migration scripts
│   ├── migrate_compliance_summaries.py
│   ├── migrate_compliance_summary_updates.py
│   ├── migrate_fuel_supply.py
│   ├── migrate_notional_transfers.py
│   ├── migrate_other_uses.py
│   ├── migrate_allocation_agreements.py
│   ├── migrate_orphaned_allocation_agreements.py
│   ├── migrate_compliance_report_history.py
│   └── run_all_migrations.py      # Migration orchestrator
│
├── setup/                         # Setup and orchestration
│   ├── database_manager.py        # Database setup and data transfer
│   ├── migration_orchestrator.py  # Complete migration workflow
│   └── validation_runner.py       # Validation orchestrator
│
├── validation/                    # Validation scripts
│   ├── validation_base.py         # Base validation class
│   ├── validate_allocation_agreements.py
│   ├── validate_fuel_supply.py
│   ├── validate_notional_transfers.py
│   ├── validate_other_uses.py
│   └── README.md                  # Validation documentation
│
├── docs/                          # Documentation
│   ├── README_SETUP.md            # Setup and usage guide
│   └── VERSIONING_REVIEW.md       # Group UUID versioning analysis
│
├── requirements.txt               # Python dependencies
└── README.md                      # This file
```

## 🚀 Quick Start

### 1. Simple Makefile Commands (Recommended)

**New!** Simple make commands for common operations:

```bash
# Complete migration with dev data (one command!)
make quick-start

# Setup with production data (requires: oc login)
make setup-prod

# Setup with dev data  
make setup-dev

# Show all available commands
make help

# Check status of containers and databases
make status
```

### 2. Automatic Migration Scripts

Fully automated setup with Docker containers managed automatically:

```bash
# One-command complete migration (starts containers, imports data, migrates, validates)
./quick-start.sh

# With options
./quick-start.sh --env dev --skip-validation

# Setup Docker environment only
./quick-start.sh --setup-only

# Using Python directly
python setup/migration_orchestrator.py auto-complete --env dev
python setup/migration_orchestrator.py auto-setup --env dev
```

### 3. Manual Migration Process

Run the entire migration with manual container management:

```bash
# Complete migration with database setup
python setup/migration_orchestrator.py complete \
  --tfrs-container my-tfrs-container \
  --lcfs-container my-lcfs-container \
  --env dev

# Migration using existing databases
python setup/migration_orchestrator.py complete --skip-setup
```

### 4. Individual Components

Set up databases only:
```bash
# Development/test data
python setup/migration_orchestrator.py setup my-tfrs-container my-lcfs-container --env dev

# Production data (with confirmation)
python setup/migration_orchestrator.py setup-prod my-tfrs-container my-lcfs-container
```

Run migrations only:
```bash
python setup/migration_orchestrator.py migrate
```

Run validations only:
```bash
python setup/migration_orchestrator.py validate
```

### 3. Database Management

```bash
# Setup test environment
python setup/database_manager.py setup my-tfrs-container my-lcfs-container dev

# Setup with production data
python setup/database_manager.py setup-prod my-tfrs-container my-lcfs-container

# Check migration readiness
python setup/database_manager.py check-readiness

# Verify database population
python setup/database_manager.py verify-tfrs
python setup/database_manager.py verify-lcfs
```

## 📋 Prerequisites

1. **Project Structure**
   ```bash
   # Run path setup helper
   ./setup-paths.sh
   
   # Expected structure (relative to main LCFS project):
   lcfs/
   ├── docker-compose.yml        # Main LCFS environment
   └── etl/
       └── python_migration/
           ├── docker-compose.yml # TFRS database only
           └── Makefile
   ```

2. **Python Environment**
   ```bash
   pip install -r requirements.txt
   cp env.example .env  # Update with your settings
   ```

3. **Docker Setup**
   - Docker and Docker Compose installed
   - LCFS environment accessible (see path setup above)

4. **OpenShift Access** (for database setup)
   - OpenShift CLI (`oc`) installed and configured
   - Access to TFRS and LCFS projects
   - Login required: `oc login`

## ⚙️ Configuration

Create a `.env` file with database connection details:

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

## 🔄 Migration Components

### Core Infrastructure (`core/`)
- **config.py**: Environment and database configuration management
- **database.py**: Database connection pooling and transaction management
- **utils.py**: Common utilities for type conversion and logging

### Migration Scripts (`migrations/`)
Each script handles a specific data type:
- **Compliance Summaries**: Report summary data and JSON snapshots
- **Fuel Supply**: Schedule B (fuel supply) records with GHGenius processing
- **Notional Transfers**: Schedule A (notional transfer) records
- **Other Uses**: Schedule C (other uses) records
- **Allocation Agreements**: Allocation agreement and exclusion records
- **Compliance Report History**: Historical compliance reports

### Setup Tools (`setup/`)
- **database_manager.py**: Database setup and data transfer from OpenShift
- **migration_orchestrator.py**: Complete workflow orchestration
- **validation_runner.py**: Validation suite runner

### Validation (`validation/`)
Comprehensive validation suite that verifies:
- Record count accuracy
- Data mapping integrity
- Version chain consistency
- Calculation accuracy
- Data quality checks

## 🎯 Key Features

✅ **Automated Database Setup**: Import data from OpenShift environments (dev/test/prod)  
✅ **Production Data Support**: Safe import of production data with confirmations  
✅ **Security First**: NO EXPORT to production allowed - import only  
✅ **Simple Make Commands**: Easy-to-use Makefile for common operations  
✅ **Complete Migration Suite**: All TFRS data types supported  
✅ **Group UUID Versioning**: Proper version chain management  
✅ **Comprehensive Validation**: Extensive data integrity checks  
✅ **Error Handling**: Robust error detection and recovery  
✅ **Modular Design**: Run complete process or individual components  
✅ **Progress Tracking**: Detailed logging and progress reporting  
✅ **CI/CD Ready**: Proper exit codes and automation support  

## 📊 Migration Process

1. **Database Setup** (Optional)
   - Download data from OpenShift environments
   - Restore to local PostgreSQL containers
   - Verify data population

2. **Migration Execution**
   - Run migrations in dependency order
   - Handle group UUID versioning
   - Process chain-based supplemental reports
   - Track progress and errors

3. **Validation** (Optional)
   - Compare source vs destination counts
   - Validate sample records
   - Check version chain integrity
   - Verify calculations and mappings

## 🔧 Development

### Running Individual Migrations

```bash
cd migrations/
python migrate_fuel_supply.py
python migrate_notional_transfers.py
```

### Running Individual Validations

```bash
cd validation/
python validate_fuel_supply.py
python validate_allocation_agreements.py
```

### Adding New Migrations

1. Create new migration script in `migrations/`
2. Inherit from appropriate base class
3. Implement required methods
4. Add to `run_all_migrations.py`
5. Create corresponding validation script

## 📖 Documentation

- **[Setup Guide](docs/README_SETUP.md)**: Detailed setup and usage instructions
- **[Validation Guide](validation/README.md)**: Validation framework documentation
- **[Versioning Review](docs/VERSIONING_REVIEW.md)**: Group UUID versioning analysis

## 🚨 Important Notes

### Group UUID Versioning
The migration scripts implement a critical group UUID versioning system. See `docs/VERSIONING_REVIEW.md` for detailed analysis of this system and known issues.

### GHGenius Processing
Fuel supply records with GHGenius determination require special processing to calculate carbon intensity from Schedule D data.

### Chain Processing
Some reports are processed in chains where supplemental reports reference base reports.

## 🤝 Contributing

1. Follow the established project structure
2. Add tests for new functionality
3. Update documentation
4. Run validation suite before submitting changes

## 📞 Support

For issues and questions:
1. Check existing documentation
2. Review validation reports for data issues
3. Check logs for detailed error information