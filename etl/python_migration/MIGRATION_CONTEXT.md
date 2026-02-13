# TFRS to LCFS Migration - Technical Context Document

This document provides comprehensive context for AI-assisted development on the TFRS to LCFS data migration. It captures key learnings about table structures, data relationships, and migration patterns.

## Table of Contents
1. [System Overview](#system-overview)
2. [Database Connections](#database-connections)
3. [Compliance Report Structure](#compliance-report-structure)
4. [Schedule Data Tables](#schedule-data-tables)
5. [Status Mapping](#status-mapping)
6. [Version and Group UUID System](#version-and-group-uuid-system)
7. [Migration Scripts Overview](#migration-scripts-overview)
8. [Common Issues and Solutions](#common-issues-and-solutions)
9. [Key SQL Patterns](#key-sql-patterns)

---

## System Overview

### TFRS (Transportation Fuels Reporting System)
- **Legacy system** being migrated from
- PostgreSQL database
- Contains compliance reports from 2012-2023
- Uses `compliance_report_workflow_state` for status tracking
- Reports linked via `root_report_id` and `supplements_id`

### LCFS (Low Carbon Fuel Standard)
- **Target system** being migrated to
- PostgreSQL database
- Uses `compliance_report_group_uuid` for report chain linking
- Uses `version` field (0, 1, 2, ...) for supplemental ordering
- Has audit triggers on many tables

---

## Database Connections

### Container Names (Local Development)
```
TFRS Database: tfrs-migration (postgres container)
LCFS Database: db (postgres container)
```

### Connection Configuration
Located in: `etl/python_migration/core/database.py`

```python
# TFRS (Source)
- Host: localhost
- Port: 5435
- Database: tfrs
- User: tfrs

# LCFS (Destination)
- Host: localhost
- Port: 5432
- Database: lcfs
- User: lcfs
```

---

## Compliance Report Structure

### TFRS Schema (Source)

```sql
-- Main compliance report table
compliance_report:
  - id (PK)
  - organization_id (FK)
  - compliance_period_id (FK)
  - type_id (1 = Compliance Report)
  - status_id (FK to compliance_report_workflow_state)
  - root_report_id (self-reference to original report)
  - supplements_id (FK to report being supplemented)
  - traversal (0, 1, 2... position in chain)
  - latest_report_id (points to most recent in chain)
  - exclusion_agreement_id (for exclusion reports)
  - nickname
  - supplemental_note
  - create_timestamp, update_timestamp

-- Workflow status tracking
compliance_report_workflow_state:
  - id (PK)
  - fuel_supplier_status_id (Draft, Submitted, Deleted)
  - analyst_status_id (Unreviewed, Recommended, Not Recommended, Requested Supplemental)
  - manager_status_id (same options)
  - director_status_id (Unreviewed, Accepted, Rejected)
```

### LCFS Schema (Destination)

```sql
-- Main compliance report table
compliance_report:
  - compliance_report_id (PK)
  - organization_id (FK)
  - compliance_period_id (FK)
  - current_status_id (FK to compliance_report_status)
  - compliance_report_group_uuid (UUID linking report chain)
  - version (0 = original, 1+ = supplementals)
  - legacy_id (TFRS report ID for traceability)
  - supplemental_initiator (enum: SUPPLIER_SUPPLEMENTAL, GOVERNMENT_REASSESSMENT)
  - reporting_frequency (enum: ANNUAL, QUARTERLY)
  - nickname
  - supplemental_note
  - transaction_id (FK for credit transactions)
  - create_date, update_date

-- Status reference table
compliance_report_status:
  - compliance_report_status_id (PK)
  - status (Draft, Submitted, Recommended_by_analyst, Recommended_by_manager,
            Assessed, Rejected, Not_recommended_by_analyst, Not_recommended_by_manager,
            Analyst_adjustment, Supplemental_requested)
```

### Key Differences

| Aspect | TFRS | LCFS |
|--------|------|------|
| Chain Linking | `root_report_id` + `supplements_id` | `compliance_report_group_uuid` |
| Version | `traversal` field | `version` field |
| Status | Multi-field workflow state | Single status enum |
| ID Field | `id` | `compliance_report_id` |
| Legacy Reference | N/A | `legacy_id` (stores TFRS id) |

---

## Schedule Data Tables

### Fuel Supply (Schedule B)

**TFRS Tables:**
- `compliance_report_schedule_b` - Main schedule B records
- `carbon_intensity_fuel_determination` - Links to fuel codes/approved fuels

**LCFS Table:**
- `fuel_supply` - Unified fuel supply records

**Key Fields:**
```sql
fuel_supply:
  - fuel_supply_id (PK)
  - compliance_report_id (FK)
  - group_uuid (UUID for tracking record across versions)
  - version (matches compliance_report.version when created)
  - action_type (enum: CREATE, UPDATE, DELETE)
  - fuel_type_id, fuel_category_id
  - provision_of_the_act_id, fuel_code_id
  - quantity, units, energy_density, energy
  - ci_of_fuel (Carbon Intensity)
  - target_ci, eer, energy_effectiveness_ratio
  - compliance_units
```

### Other Uses (Schedule C)

**TFRS Table:** `compliance_report_schedule_c`
**LCFS Table:** `other_uses`

**Key Fields:**
```sql
other_uses:
  - other_uses_id (PK)
  - compliance_report_id (FK)
  - group_uuid, version, action_type
  - fuel_type_id, fuel_category_id
  - provision_of_the_act_id, fuel_code_id
  - quantity_supplied, units
  - ci_of_fuel, expected_use_id
  - rationale
```

### Notional Transfers (Schedule A)

**TFRS Table:** `compliance_report_schedule_a_record`
**LCFS Table:** `notional_transfer`

**Key Fields:**
```sql
notional_transfer:
  - notional_transfer_id (PK)
  - compliance_report_id (FK)
  - group_uuid, version, action_type
  - legal_name, address_for_service
  - fuel_category_id
  - received_or_transferred (enum: Received, Transferred)
  - quantity, units
```

### Allocation Agreements

**TFRS Table:** `exclusion_agreement_record`
**LCFS Table:** `allocation_agreement`

**Key Fields:**
```sql
allocation_agreement:
  - allocation_agreement_id (PK)
  - compliance_report_id (FK)
  - group_uuid, version, action_type
  - transaction_partner, postal_address
  - transaction_partner_email, transaction_partner_phone
  - ci_of_fuel, quantity, units
  - fuel_type_id, fuel_category_id, provision_of_the_act_id
```

---

## Status Mapping

### TFRS Workflow to LCFS Status

```python
def map_status(fuel_status, analyst_status, manager_status, director_status):
    # Priority order (highest to lowest):

    # 1. Director decisions (final)
    if director_status == "rejected":
        return "Rejected"
    if director_status == "accepted":
        return "Assessed"

    # 2. Supplemental requested (any level)
    if "requested supplemental" in any_status:
        return "Supplemental_requested"

    # 3. Manager recommendation
    if manager_status == "recommended":
        return "Recommended_by_manager"
    if manager_status == "not recommended":
        return "Not_recommended_by_manager"

    # 4. Analyst recommendation
    if analyst_status == "recommended":
        return "Recommended_by_analyst"
    if analyst_status == "not recommended":
        return "Not_recommended_by_analyst"

    # 5. Supplier status
    if fuel_status == "submitted":
        return "Submitted"
    if fuel_status == "draft":
        return "Draft"

    # Skip deleted reports
    if fuel_status == "deleted":
        return None  # Don't migrate
```

### Status ID Reference (LCFS)

| Status | ID |
|--------|-----|
| Draft | 1 |
| Submitted | 2 |
| Recommended_by_analyst | 3 |
| Recommended_by_manager | 4 |
| Assessed | 5 |
| Rejected | 7 |
| Not_recommended_by_analyst | 8 |
| Not_recommended_by_manager | 9 |
| Analyst_adjustment | 10 |
| Supplemental_requested | 11 |

---

## Version and Group UUID System

### Concept

In LCFS, compliance reports and their schedule data use a **versioned record system**:

1. **`compliance_report_group_uuid`**: Links all reports in the same chain (original + supplementals)
2. **`version`**: Indicates position in chain (0 = original, 1 = supp 1, etc.)
3. **`group_uuid`** (on schedule tables): Links records that represent the same logical item across versions
4. **`action_type`**: Indicates what happened to the record (CREATE, UPDATE, DELETE)

### Display Logic

When viewing a report at version N, the application shows:
- All records where `version <= N`
- Excluding records that have a DELETE action at or before version N
- Taking the latest version of each `group_uuid`

### Example Chain

```
Report Chain (compliance_report_group_uuid: abc-123):
├── Version 0 (Original): fuel_supply records with version=0, action_type=CREATE
├── Version 1 (Supp 1):
│   ├── Existing records copied with version=1
│   ├── Modified records with version=1, action_type=UPDATE
│   └── Deleted records with version=1, action_type=DELETE (same group_uuid)
└── Version 2 (Supp 2): Similar pattern
```

### GHGenius Records (Special Case)

For approved fuel pathways (GHGenius), records are created with:
- `version = 0` (on the ORIGINAL report, not the report that created them)
- `action_type = CREATE`

This ensures GHGenius-calculated carbon intensity values are visible across ALL versions in the chain.

### DELETE Record Pattern

When a record is deleted in a supplemental:
1. A new record is created with the **same `group_uuid`** as the original
2. `action_type = DELETE`
3. `version` = the supplemental's version

This ensures the display logic can hide the record when viewing that version or later.

---

## Migration Scripts Overview

### Execution Order

```
1. DataCleanupMigrator          - Pre-migration cleanup
2. OrphanedComplianceReportMigrator - Create missing compliance_report records
3. ComplianceSummaryMigrator    - Migrate summary data
4. ComplianceSummaryUpdater     - Update calculated fields
5. ComplianceReportHistoryMigrator - Migrate status history
6. AllocationAgreementMigrator  - Schedule D (allocation agreements)
7. OtherUsesMigrator            - Schedule C (other uses)
8. NotionalTransferMigrator     - Schedule A (notional transfers)
9. FuelSupplyMigrator           - Schedule B (fuel supply)
10. GHGeniusMigrator            - Fix CI values for approved fuels
11. OrphanedAllocationAgreementMigrator - Handle standalone exclusion reports
12. TimestampRestoreMigrator    - Restore original timestamps
```

### Key Migration Scripts

#### `migrate_orphaned_compliance_reports.py`
- **Purpose**: Create compliance_report records that were missed in initial migration
- **Issue Solved**: Reports with certain workflow states (e.g., "Recommended by analyst") were skipped due to status key mismatch
- **Key Features**:
  - Disables audit triggers during insert
  - Finds existing `group_uuid` from sibling reports in chain
  - Creates minimal `compliance_report_summary` records

#### `migrate_fuel_supply.py`
- **Purpose**: Migrate Schedule B fuel supply data
- **Key Features**:
  - Groups by `compliance_report_group_uuid` for proper versioning
  - Handles GHGenius lookups for approved fuel pathways
  - Tracks `had_snapshot_data` to determine if report had pre-existing data
  - Creates DELETE records for items removed in supplementals

#### `migrate_ghgenius_fuel_supply.py`
- **Purpose**: Fix carbon intensity values for approved fuel pathways
- **Key Features**:
  - Creates records on ORIGINAL report (version 0) for chain-wide visibility
  - Uses `find_original_report_id()` to locate the root report
  - Handles both fuel_code and approved_fuel lookups

#### `migrate_allocation_agreements.py`
- **Purpose**: Migrate exclusion agreement data
- **Key Features**:
  - Handles orphaned exclusion reports (no main compliance report)
  - Falls back to finding exclusion data by org/period when no direct link exists

---

## Common Issues and Solutions

### 1. Audit Trigger Failures

**Symptom**: `null values cannot be formatted as an SQL identifier`

**Cause**: The audit trigger on `compliance_report` expects a primary key but can't find it via `information_schema`.

**Solution**: Disable audit triggers before insert, re-enable after:
```python
lcfs_cursor.execute("""
    ALTER TABLE compliance_report
    DISABLE TRIGGER audit_compliance_report_insert_update_delete
""")
# ... do inserts ...
lcfs_cursor.execute("""
    ALTER TABLE compliance_report
    ENABLE TRIGGER audit_compliance_report_insert_update_delete
""")
```

### 2. Version Number Inflation

**Symptom**: Records showing version numbers like 539 instead of 1-8

**Cause**: Variable name collision in fuel code lookup:
```python
# BUG: 'version' parameter gets overwritten
base_code, version, minor = tfrs_fuel_result

# FIX: Use different variable name
base_code, fc_version, minor = tfrs_fuel_result
```

### 3. Mismatched Group UUIDs

**Symptom**: Reports in same chain have different `compliance_report_group_uuid`

**Cause**: New reports created without checking for existing chain UUID

**Solution**: Look up existing UUID from sibling reports:
```python
def find_existing_group_uuid(lcfs_cursor, tfrs_cursor, tfrs_id, root_id):
    # Find siblings in TFRS chain
    tfrs_cursor.execute("""
        SELECT id FROM compliance_report
        WHERE root_report_id = %s AND id != %s
    """, [root_id, tfrs_id])
    sibling_ids = [row[0] for row in tfrs_cursor.fetchall()]

    # Check if any exist in LCFS
    lcfs_cursor.execute("""
        SELECT compliance_report_group_uuid
        FROM compliance_report
        WHERE legacy_id IN (%s)
        LIMIT 1
    """, sibling_ids)
    return result[0] if result else None
```

### 4. DELETE Records Not Hiding Items

**Symptom**: Deleted items still appear in supplemental reports

**Cause**: DELETE record has different `group_uuid` than the CREATE record

**Solution**: DELETE records MUST share the same `group_uuid` as their CREATE counterpart:
```python
# Find the group_uuid of the record being deleted
existing = get_existing_record(org_id, period_id, fuel_type, quantity, ...)
delete_record.group_uuid = existing.group_uuid  # Must match!
delete_record.action_type = 'DELETE'
delete_record.version = current_supplemental_version
```

### 5. NOT NULL Constraint Violations on Summary

**Symptom**: `null value in column "line_2_..." violates not-null constraint`

**Cause**: `compliance_report_summary` has NOT NULL constraints on many numeric fields

**Solution**: Insert with all required fields defaulted to 0:
```sql
INSERT INTO compliance_report_summary (
    compliance_report_id, is_locked,
    line_1_fossil_derived_base_fuel_gasoline,  -- 0
    line_2_eligible_renewable_fuel_supplied_gasoline,  -- 0
    -- ... all other numeric fields with 0
)
```

---

## Key SQL Patterns

### Find Report Chain in TFRS
```sql
SELECT
    cr.id,
    cr.root_report_id,
    cr.traversal,
    cr.supplements_id,
    cws.fuel_supplier_status_id,
    cws.analyst_status_id,
    cws.manager_status_id,
    cws.director_status_id
FROM compliance_report cr
JOIN compliance_report_workflow_state cws ON cr.status_id = cws.id
WHERE cr.root_report_id = :root_id
ORDER BY cr.traversal;
```

### Find Report Chain in LCFS
```sql
SELECT
    cr.compliance_report_id,
    cr.legacy_id,
    cr.version,
    cr.nickname,
    crs.status,
    cr.compliance_report_group_uuid
FROM compliance_report cr
JOIN compliance_report_status crs ON cr.current_status_id = crs.compliance_report_status_id
WHERE cr.compliance_report_group_uuid = :group_uuid
ORDER BY cr.version;
```

### Check Fuel Supply Records for a Report
```sql
SELECT
    fs.fuel_supply_id,
    fs.group_uuid,
    fs.version,
    fs.action_type,
    ft.fuel_type,
    fc.category,
    fs.quantity,
    fs.ci_of_fuel,
    fs.compliance_units
FROM fuel_supply fs
JOIN fuel_type ft ON fs.fuel_type_id = ft.fuel_type_id
JOIN fuel_category fc ON fs.fuel_category_id = fc.fuel_category_id
WHERE fs.compliance_report_id = :report_id
ORDER BY fs.group_uuid, fs.version;
```

### Verify Chain UUID Consistency
```sql
WITH chain_check AS (
    SELECT
        o.name AS organization,
        cp.description AS period,
        COUNT(DISTINCT cr.compliance_report_group_uuid) AS distinct_uuids,
        COUNT(*) AS reports_in_chain
    FROM compliance_report cr
    JOIN compliance_period cp ON cr.compliance_period_id = cp.compliance_period_id
    JOIN organization o ON cr.organization_id = o.organization_id
    WHERE cr.legacy_id IS NOT NULL
    GROUP BY o.name, cp.description
)
SELECT * FROM chain_check
WHERE distinct_uuids > 1  -- Multiple chains in same org/period is valid
ORDER BY organization, period;
```

### Find Missing Reports (TFRS vs LCFS)
```sql
-- Reports in TFRS not in LCFS
SELECT cr.id AS missing_tfrs_id
FROM tfrs.compliance_report cr
WHERE cr.type_id = 1
  AND NOT EXISTS (
      SELECT 1 FROM lcfs.compliance_report lcfs_cr
      WHERE lcfs_cr.legacy_id = cr.id
  );
```

---

## Compliance Period Mapping

TFRS and LCFS have different compliance_period_id values:

```python
COMPLIANCE_PERIOD_MAPPING = {
    # TFRS ID: LCFS ID
    1: 1,   # 2010
    2: 2,   # 2011
    3: 3,   # 2012
    4: 5,   # 2013-14 -> 2014
    5: 6,   # 2015
    6: 7,   # 2016
    7: 8,   # 2017
    8: 9,   # 2018
    9: 10,  # 2019
    10: 11, # 2020
    11: 12, # 2021
    12: 13, # 2022
    13: 14, # 2023
    # ... continues
}
```

---

## File Locations

```
etl/python_migration/
├── core/
│   ├── database.py          # Database connections
│   └── utils.py              # Utility functions
├── migrations/
│   ├── run_all_migrations.py # Main entry point
│   ├── migrate_data_cleanup.py
│   ├── migrate_orphaned_compliance_reports.py
│   ├── migrate_compliance_summaries.py
│   ├── migrate_compliance_summary_updates.py
│   ├── migrate_compliance_report_history.py
│   ├── migrate_allocation_agreements.py
│   ├── migrate_other_uses.py
│   ├── migrate_notional_transfers.py
│   ├── migrate_fuel_supply.py
│   ├── migrate_ghgenius_fuel_supply.py
│   ├── migrate_orphaned_allocation_agreements.py
│   └── migrate_restore_timestamps.py
├── setup/
│   ├── migration_orchestrator.py
│   ├── database_manager.py
│   └── docker_manager.py
├── validation/
│   └── validation_runner.py
├── Makefile                  # make migrate, make reset-lcfs, etc.
└── docker-compose.yml        # TFRS container setup
```

---

## Running Migrations

### Full Migration
```bash
cd etl/python_migration
make reset-lcfs    # Reset LCFS database from dump
make migrate       # Run all migrations
make validate      # Run validation checks
```

### Individual Migration
```bash
cd etl/python_migration
python3 -c "
from migrations.migrate_fuel_supply import FuelSupplyMigrator
migrator = FuelSupplyMigrator()
result = migrator.migrate()
print(result)
"
```

### Check Database Status
```bash
# TFRS
docker exec tfrs-migration psql -U tfrs -d tfrs -c "SELECT COUNT(*) FROM compliance_report WHERE type_id = 1;"

# LCFS
docker exec db psql -U lcfs -d lcfs -c "SELECT COUNT(*) FROM compliance_report WHERE legacy_id IS NOT NULL;"
```

---

## Testing Checklist

When verifying migration results:

1. **Report Chain Integrity**
   - All reports in chain have same `compliance_report_group_uuid`
   - Versions are sequential (0, 1, 2, ...)
   - Legacy IDs map correctly to TFRS IDs

2. **Schedule Data**
   - Records have correct `group_uuid` for tracking
   - DELETE records share `group_uuid` with their CREATE counterpart
   - Version numbers don't exceed max report version in chain
   - GHGenius records appear on version 0 (original report)

3. **Status Mapping**
   - Assessed reports have correct transaction_id
   - Recommended statuses map to correct LCFS status
   - Rejected/Deleted reports handled appropriately

4. **Data Integrity**
   - Quantities, CI values, compliance units match TFRS
   - Fuel types/categories map correctly
   - Organization and period IDs aligned

---

*Last Updated: December 2024*
*Context Version: 1.0*
