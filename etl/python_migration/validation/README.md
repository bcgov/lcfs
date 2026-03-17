# LCFS Migration Validation Scripts

This folder contains Python validation scripts that verify the integrity and correctness of data migrated from TFRS to LCFS systems.

## Overview

The validation scripts are Python equivalents of the original Groovy validation scripts, designed to:

1. **Compare record counts** between source (TFRS) and destination (LCFS) systems
2. **Validate sample records** to ensure data integrity and correct mapping
3. **Check for data anomalies** such as NULL values in critical fields
4. **Verify version chain integrity** for records with group_uuid versioning
5. **Validate action type distributions** (CREATE vs UPDATE)
6. **Ensure no new-period records were impacted** by the ETL process
7. **Check for duplicate records** and other data quality issues

## Available Validators

### 1. validate_allocation_agreements.py
- Validates migration of allocation agreement records
- Checks transaction type mapping
- Verifies partner information and quantities

### 2. validate_fuel_supply.py  
- Validates Schedule B (fuel supply) record migration
- Includes special validation for GHGenius records
- Checks calculation consistency (energy, compliance units)
- Verifies carbon intensity mappings

### 3. validate_notional_transfers.py
- Validates Schedule A (notional transfer) record migration  
- Checks transfer type mapping (Received vs Transferred)
- Verifies trading partner information

### 4. validate_other_uses.py
- Validates Schedule C (other uses) record migration
- Checks expected use type mappings
- Handles cases where expected_use table may not exist in source

## Usage

### Run Individual Validators

```bash
# From the validation directory
python validate_allocation_agreements.py
python validate_fuel_supply.py  
python validate_notional_transfers.py
python validate_other_uses.py
```

### Run All Validations

```bash
# From the setup directory
python ../setup/validation_runner.py
```

This will:
- Execute all validators in sequence
- Generate a comprehensive report
- Save results to a timestamped JSON file
- Exit with appropriate status codes

## Configuration

The validators use the same configuration as the migration scripts:
- Database connections are managed through `../config.py`
- Environment variables should be set in `.env` file in the parent directory

## Output

Validators produce:
1. **Console output** with detailed validation results
2. **JSON report files** with structured results for further analysis
3. **Status indicators** (✓ for success, ✗ for failures)

## Key Validation Patterns

### Record Count Comparison
```python
results['record_counts'] = self.compare_record_counts(
    source_query="SELECT COUNT(*) FROM source_table",
    dest_query="SELECT COUNT(*) FROM dest_table WHERE create_user = 'ETL'"
)
```

### Sample Record Validation
- Validates 10 sample records by default
- Matches records based on key fields (legacy_id, quantities, etc.)
- Reports match success rate

### Version Chain Validation
- Identifies records with multiple versions (group_uuid)
- Verifies versions are sequential
- Reports version chain integrity

### Data Anomaly Detection
- Checks for NULL values in critical fields
- Reports counts of problematic records
- Helps identify mapping issues

## GHGenius Processing Note

The fuel supply validator includes special handling for GHGenius records, which require carbon intensity values to be calculated from Schedule D data. See `ghgenius_processing.md` for detailed information about this process.

## Error Handling

- Validators gracefully handle missing tables or connection issues
- Detailed error messages help diagnose problems
- Failed validations don't prevent other validators from running

## Integration

These validation scripts are designed to be run:
1. **After migration scripts** to verify results
2. **As part of CI/CD pipelines** for automated validation
3. **During testing** to catch regressions
4. **Before go-live** as final verification

## Extending Validators

To add new validation checks:

1. Inherit from `BaseValidator`
2. Implement required abstract methods
3. Use provided utility methods for common patterns
4. Add to `run_all_validations.py` for integration