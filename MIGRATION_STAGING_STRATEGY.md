# TFRS Migration PR Staging Strategy

## Executive Summary

This document provides a comprehensive strategy for splitting the massive TFRS migration branch (`feat/alex-tfrs-shutdown-migrations-250702`) into staged, reviewable PRs that can be safely merged into `develop` without disrupting existing environments.

**Branch Status**: Currently merged with develop, resolved conflicts, ready for staging analysis

---

## Current Branch Analysis

### Total Changes from Develop
- **21 Alembic migrations** (schema changes)
- **10 Python ETL migration scripts** (~5,300 lines)
- **Model changes**: 2 modified models (ComplianceReportSummary, Role)
- **Backend changes**: Multiple service/API updates
- **Frontend changes**: UI updates for new fields

###

 Risk Assessment

| Category | Count | Risk Level | Can Stage First? |
|----------|-------|------------|------------------|
| Schema migrations (migrations only) | 15 | 🟡 MEDIUM | ⚠️ **PARTIAL** |
| TFRS historical data migrations | 5 | 🟡 MEDIUM | ❌ **NO** - Require ETL |
| Model changes | 2 | 🟢 LOW | ✅ **YES** - With migrations |
| Backend API changes | TBD | 🟡 MEDIUM | ⚠️ **CONDITIONAL** |
| Frontend UI changes | TBD | 🟡 MEDIUM | ⚠️ **CONDITIONAL** |
| ETL Python scripts | 10 | 🔴 HIGH | ❌ **NO** - Final stage |

---

## Staging Strategy: 4-Phase Approach

### Phase 1: Safe Foundation (Schema + Models Only)
**Goal**: Prepare database schema for future data migration without breaking existing functionality

**Can be merged immediately** ✅

#### What to Include:

**✅ Safe Migrations (10 migrations)**:
1. `c25619ad20df` - Revert transfer update date/user (corrective, low risk)
2. `f1a2b3c4d5e6` - Fix credit ledger materialized view triggers (bug fix)
3. `3ac464e21203` - Add company overview fields to organization (nullable columns)
4. `63c126dcbecc` - Create penalty_log table (new table, no data)
5. `995ba109ca8d` - Create charging_equipment_intended_user_association (new table)
6. `1909a3e5fafd` - Update prefix for Canadian fuel (data correction)
7. `5c3de27f158b` - Add BETA_TESTER role (enum addition)
8. `67c82d9397dd` - Metabase views creation (analytics only)
9. `a1b2c3d4e5f7` - Organization early issuance by year (new table + reference data)
10. `c3d4e5f6g7h8` - Update metabase views (analytics update)

**✅ Safe Model Changes**:
- `Role.py` - Add BETA_TESTER enum value (matches migration 5c3de27f158b)

#### What to **EXCLUDE**:
- ❌ TFRS historical migrations (a3290902296b through 8e530edb155f)
- ❌ ComplianceReportSummary model changes (breaking change without ETL)
- ❌ Charging infrastructure data migrations (c19276038926, 13529e573c05, adee8bc4a278, 1f3ce398db1c)
- ❌ All ETL Python scripts
- ❌ Backend/frontend code depending on TFRS data

#### Risk Assessment:
- **Database Impact**: LOW - Adds tables/columns, doesn't modify existing data
- **Backward Compatibility**: HIGH - All changes are additive
- **Rollback**: EASY - All migrations have downgrade paths
- **Testing**: Minimal - No business logic changes

#### PR Title:
```
feat: Foundation schema changes for TFRS migration (Phase 1/4)
```

#### PR Description Template:
```markdown
## Overview
Prepares LCFS database schema for TFRS data migration without disrupting existing functionality.

## Changes
- 10 database migrations (schema only, no data changes)
- 1 model update (BETA_TESTER role addition)
- No breaking changes to existing functionality

## Migrations Included
- Bug fixes: Credit ledger triggers, transfer metadata correction
- New tables: penalty_log, charging_equipment_intended_user_association, organization_early_issuance_by_year
- Schema additions: Company overview fields, BETA_TESTER role
- Analytics: Metabase view creation/updates

## Testing
- [x] All migrations run successfully on clean database
- [x] All migrations have downgrade paths
- [x] No existing functionality affected
- [x] Dev/test environments validated

## Follow-up PRs
- Phase 2: Charging infrastructure migration
- Phase 3: TFRS historical data preparation
- Phase 4: ETL data migration execution
```

---

### Phase 2: Charging Infrastructure Migration
**Goal**: Migrate FSE (Final Supply Equipment) to new charging infrastructure schema

**Can be merged after Phase 1** ✅

#### What to Include:

**Migrations (4)**:
1. `c19276038926` - Migrate FSE to charging infrastructure (HIGH RISK - data migration)
2. `13529e573c05` - Create fse_compliance_reporting table + data migration
3. `adee8bc4a278` - Move allocating organization to charging_site
4. `1f3ce398db1c` - Fix charging equipment compliance association

**Related Migrations (if not in Phase 1)**:
- `995ba109ca8d` - Charging equipment intended user association table

**Backend Services**:
- `backend/lcfs/web/api/charging_equipment/` - New API endpoints
- `backend/lcfs/web/api/charging_site/` - New API endpoints
- `backend/lcfs/web/api/final_supply_equipment/` - Updates for new schema

**Frontend Components**:
- `frontend/src/views/ChargingEquipment/` - New UI components
- `frontend/src/views/ChargingSite/` - New UI components
- `frontend/src/views/FinalSupplyEquipments/` - Updates for new schema
- `frontend/src/hooks/useChargingEquipment.js` - New
- `frontend/src/hooks/useChargingSite.js` - New

#### Dependencies:
- ✅ Phase 1 must be merged first
- ⚠️ Requires thorough testing with production-like FSE data
- ⚠️ Date correction logic needs validation

#### Risk Assessment:
- **Database Impact**: HIGH - Major data migration from FSE to new tables
- **Backward Compatibility**: MEDIUM - Changes FSE data structure
- **Rollback**: COMPLEX - Data migration rollback is difficult
- **Testing**: CRITICAL - Requires extensive validation

#### Testing Requirements:
1. **Data Migration Validation**:
   - Verify all FSE records migrated correctly
   - Validate charging_site grouping logic (by org + address)
   - Confirm intended user/use associations preserved
   - Check date correction logic (migration 13529e573c05 and 1f3ce398db1c)

2. **API Testing**:
   - All CRUD operations on charging_equipment
   - All CRUD operations on charging_site
   - FSE compatibility endpoints still work

3. **UI Testing**:
   - Charging equipment list/detail pages
   - Charging site list/detail/map pages
   - FSE pages work with new backend

#### PR Title:
```
feat: Charging infrastructure migration from FSE (Phase 2/4)
```

---

### Phase 3: TFRS Historical Data Schema Preparation
**Goal**: Add schema support for TFRS historical data without actually migrating data

**Can be merged after Phase 2** ⚠️

#### What to Include:

**Model Changes**:
- `ComplianceReportSummary.py`:
  - Add `historical_snapshot` JSONB column
  - **⚠️ DO NOT remove `credits_offset_a/b/c` yet**

**Migrations (Modified)**:
1. `54d55e878dad` - **MODIFIED VERSION**:
   ```python
   # ADD historical_snapshot column
   op.add_column(
       "compliance_report_summary",
       sa.Column("historical_snapshot", postgresql.JSONB(), nullable=True)
   )

   # DO NOT DROP credits_offset columns yet
   # These will be removed in Phase 4 after ETL migration
   ```

2. `a3290902296b` - Add renewable diesel fuel type (reference data only)
3. `87592f5136b3` - Historical target carbon intensities (reference data only)

**Backend Service Updates**:
- Add readonly access to `historical_snapshot` field
- **⚠️ Keep `credits_offset_a/b/c` accessor methods**

**Frontend Updates (if any)**:
- Display logic for historical data (if safe)

#### What to **EXCLUDE**:
- ❌ Migration `8e530edb155f` (organization snapshot population - needs ETL)
- ❌ Dropping `credits_offset_a/b/c` columns
- ❌ Any code that assumes TFRS data is populated

#### Risk Assessment:
- **Database Impact**: LOW - Adds column, doesn't modify existing data
- **Backward Compatibility**: HIGH - Additive changes only
- **Rollback**: EASY - Just added nullable column
- **Testing**: MODERATE - Ensure no breaking changes

#### PR Title:
```
feat: Add TFRS historical data schema support (Phase 3/4)
```

#### PR Description Template:
```markdown
## Overview
Adds database schema support for TFRS historical data migration without performing the actual data migration.

## Changes
- Add `historical_snapshot` JSONB column to ComplianceReportSummary
- Add renewable diesel fuel type (reference data)
- Add historical target carbon intensities (2013-2023)
- **Preserves** existing `credits_offset_a/b/c` columns for backward compatibility

## Important Notes
- ⚠️ This PR does NOT migrate any TFRS data
- ⚠️ Credits offset columns remain until Phase 4 (ETL migration)
- ⚠️ `historical_snapshot` will be null until ETL runs

## Testing
- [x] Schema changes applied successfully
- [x] Existing functionality unaffected
- [x] Reference data inserted correctly

## Follow-up
- Phase 4 will populate historical data and remove legacy columns
```

---

### Phase 4: TFRS Data Migration Execution (ETL)
**Goal**: Execute complete TFRS to LCFS data migration and finalize schema cleanup

**Can be merged after Phase 3** ⚠️ **REQUIRES MAINTENANCE WINDOW**

#### What to Include:

**ETL Python Scripts (All 10)**:
1. `migrate_data_cleanup.py`
2. `migrate_compliance_summaries.py`
3. `migrate_compliance_summary_updates.py`
4. `migrate_compliance_report_history.py`
5. `migrate_allocation_agreements.py`
6. `migrate_orphaned_allocation_agreements.py`
7. `migrate_other_uses.py`
8. `migrate_notional_transfers.py`
9. `migrate_fuel_supply.py`
10. `run_all_migrations.py` (orchestrator)

**ETL Infrastructure**:
- `etl/python_migration/core/` - Config, database, utils
- `etl/python_migration/setup/` - Orchestration tools
- `etl/python_migration/validation/` - Validation suite
- All supporting files (Makefile, docker-compose.yml, etc.)

**Final Migrations**:
1. `8e530edb155f` - Populate missing organization snapshots
2. `54d55e878dad` - **FINAL VERSION** (drop credits_offset columns):
   ```python
   # NOW safe to drop legacy columns after ETL migration
   op.drop_column("compliance_report_summary", "credits_offset_b")
   op.drop_column("compliance_report_summary", "credits_offset_c")
   op.drop_column("compliance_report_summary", "credits_offset_a")
   ```

**Backend Service Updates**:
- Remove `credits_offset_a/b/c` references
- Add `historical_snapshot` JSON query logic
- TFRS data display endpoints

**Frontend Updates**:
- Historical compliance report display
- TFRS data viewing components
- Report comparison tools

#### Pre-Execution Requirements:
1. **TFRS Database Access**: Read-only snapshot available
2. **Maintenance Window**: Scheduled downtime for production
3. **Backup**: Full database backup before migration
4. **Validation**: ETL tested on production-like data
5. **Rollback Plan**: Documented and tested

#### Execution Steps:
```bash
# 1. Create TFRS snapshot
oc rsync <tfrs-pod>:/var/lib/pgsql/data/backup.sql ./

# 2. Setup ETL environment
cd etl/python_migration
make setup-prod

# 3. Run complete migration
make quick-start

# 4. Run validation suite
make validate

# 5. Deploy schema cleanup migration (drop credits_offset columns)
alembic upgrade head

# 6. Deploy backend/frontend changes
# Normal deployment process
```

#### Risk Assessment:
- **Database Impact**: HIGH - Major data migration + schema cleanup
- **Backward Compatibility**: BREAKING - Removes legacy columns
- **Rollback**: DIFFICULT - Requires restore from backup
- **Testing**: CRITICAL - Must validate on production-like data

#### Success Criteria:
1. **Data Migration**:
   - All TFRS compliance reports migrated
   - All schedules (A, B, C) migrated with versioning
   - All allocation agreements migrated
   - Summary calculations match TFRS

2. **Validation Passing**:
   - Record counts match (TFRS vs LCFS)
   - Version chains intact
   - Sample records validated
   - No null values on required fields

3. **Functional Testing**:
   - Historical reports viewable in UI
   - All TFRS data accessible
   - No errors in logs
   - Performance acceptable

#### PR Title:
```
feat: TFRS to LCFS data migration execution (Phase 4/4) - REQUIRES MAINTENANCE
```

#### PR Description Template:
```markdown
## ⚠️ MAINTENANCE WINDOW REQUIRED ⚠️

## Overview
Executes complete TFRS to LCFS data migration and finalizes schema cleanup.

## Pre-Deployment Checklist
- [ ] TFRS database snapshot created
- [ ] Full LCFS database backup completed
- [ ] ETL tested on production-like data
- [ ] Validation suite passing on test data
- [ ] Rollback procedure documented and tested
- [ ] Maintenance window scheduled and announced

## Changes
- Complete ETL migration (10 scripts, ~5,300 lines)
- Populate `historical_snapshot` JSONB field
- Remove legacy `credits_offset_a/b/c` columns
- Enable TFRS historical data viewing

## Migration Duration
- Estimated: 2-4 hours (depends on data volume)
- Includes validation time

## Rollback Plan
1. Restore database from backup
2. Revert migrations to Phase 3 state
3. Redeploy Phase 3 backend/frontend

## Testing Completed
- [ ] Dev environment migration successful
- [ ] Test environment migration successful
- [ ] Validation suite passed on test data
- [ ] UAT completed by business stakeholders
- [ ] Performance testing completed

## Post-Deployment Validation
- [ ] All TFRS reports visible in UI
- [ ] Sample report data verified against TFRS
- [ ] No application errors
- [ ] Performance within acceptable range
```

---

## Implementation Timeline

### Recommended Schedule

**Week 1-2: Phase 1 (Safe Foundation)**
- Create cherry-pick branch
- PR review and approval
- Merge to develop
- Deploy to dev → test → prod (low risk)

**Week 3-4: Phase 2 (Charging Infrastructure)**
- PR review (requires thorough testing)
- Merge to develop
- Deploy with extended testing period

**Week 5-6: Phase 3 (TFRS Schema Prep)**
- Modified migration created
- PR review
- Merge to develop
- Deploy (low risk, additive only)

**Week 7-10: Phase 4 (ETL Migration)**
- ETL testing on production snapshot
- Validation suite completion
- UAT with business stakeholders
- Scheduled maintenance window
- Migration execution
- Post-migration validation

---

## Cherry-Pick Commands for Phase 1

### Step 1: Create Phase 1 Branch

```bash
# From your migration branch
git checkout feat/alex-tfrs-shutdown-migrations-250702

# Create Phase 1 branch from develop
git checkout develop
git pull origin develop
git checkout -b feat/phase1-foundation-schema
```

### Step 2: Cherry-Pick Safe Migrations

```bash
# Cherry-pick individual commits containing safe migrations
# (You'll need to identify the specific commit SHAs)

# Example structure:
git cherry-pick <commit-with-c25619ad20df-migration>
git cherry-pick <commit-with-f1a2b3c4d5e6-migration>
git cherry-pick <commit-with-3ac464e21203-migration>
# ... continue for all Phase 1 migrations

# Cherry-pick Role.py model change
git cherry-pick <commit-with-role-py-changes>
```

### Step 3: Manual File Selection (if commits are intertwined)

If migrations are mixed in commits with non-Phase-1 changes:

```bash
# Use interactive staging
git checkout feat/alex-tfrs-shutdown-migrations-250702

# Create patch files for each Phase 1 migration
git diff develop -- backend/lcfs/db/migrations/versions/2025-08-29-02-51_c25619ad20df.py > phase1_migration_1.patch
git diff develop -- backend/lcfs/db/migrations/versions/2025-09-05-16-30_f1a2b3c4d5e6.py > phase1_migration_2.patch
# ... continue for all Phase 1 files

# Apply to Phase 1 branch
git checkout feat/phase1-foundation-schema
git apply phase1_migration_1.patch
git apply phase1_migration_2.patch
# ... continue

# Commit each migration
git add backend/lcfs/db/migrations/versions/2025-08-29-02-51_c25619ad20df.py
git commit -m "feat: revert transfer update date/user metadata (c25619ad20df)"

git add backend/lcfs/db/migrations/versions/2025-09-05-16-30_f1a2b3c4d5e6.py
git commit -m "feat: fix credit ledger materialized view triggers (f1a2b3c4d5e6)"
# ... continue
```

### Step 4: Verify Phase 1 Branch

```bash
# Ensure only Phase 1 files present
git diff develop --name-only

# Should only show:
# backend/lcfs/db/migrations/versions/<Phase 1 migrations>.py
# backend/lcfs/db/models/user/Role.py

# Test migrations
alembic upgrade head
alembic downgrade -1
alembic upgrade head
```

### Step 5: Push and Create PR

```bash
git push origin feat/phase1-foundation-schema

# Create PR targeting develop
# Use PR description template from Phase 1 section above
```

---

## Risk Mitigation Strategies

### For Each Phase

**1. Database Backups**
```sql
-- Before each phase deployment
pg_dump -Fc lcfs_db > lcfs_backup_phase<N>_$(date +%Y%m%d).dump
```

**2. Smoke Testing**
- Run existing test suite after each phase
- Manually verify critical user flows
- Check application logs for errors

**3. Feature Flags** (if available)
- Hide TFRS data UI until Phase 4 complete
- Enable gradually per organization for testing

**4. Monitoring**
- Database query performance
- Application error rates
- User-reported issues

**5. Rollback Procedures**
```bash
# Each phase should document:
# 1. How to revert migrations
# 2. How to restore data (if needed)
# 3. How to redeploy previous version
```

---

## Success Criteria by Phase

### Phase 1 Success
- ✅ All 10 migrations run without errors
- ✅ Existing functionality unchanged
- ✅ No production issues for 1 week

### Phase 2 Success
- ✅ All FSE data migrated correctly
- ✅ Charging equipment/site features functional
- ✅ No data loss from FSE migration

### Phase 3 Success
- ✅ Schema changes deployed
- ✅ No impact to existing reports
- ✅ `historical_snapshot` column accessible

### Phase 4 Success
- ✅ All TFRS data migrated
- ✅ Validation suite 100% passing
- ✅ Historical reports viewable in UI
- ✅ No performance degradation
- ✅ Legacy columns removed cleanly

---

## Stakeholder Communication

### Phase 1-3
**Audience**: Development team, QA
**Message**: "Preparing infrastructure for TFRS migration. No user-facing changes."

### Phase 4
**Audience**: All users, management, support team
**Message**:
```
Subject: SCHEDULED MAINTENANCE - TFRS Data Migration

Date: [DATE]
Time: [TIME] - [TIME] (Estimated 2-4 hours)
Impact: LCFS system unavailable during maintenance

What's Happening:
- Migrating historical compliance data from TFRS to LCFS
- After migration, all historical reports will be available in LCFS
- No data loss expected

What You Need to Do:
- Save any in-progress work before [START TIME]
- Avoid accessing system during maintenance window
- Report any issues immediately after system restored

Contact: [SUPPORT INFO]
```

---

## Conclusion

This 4-phase strategy provides:
1. **Safety**: Each phase independently testable and reversible
2. **Reviewability**: Smaller, focused PRs instead of one massive change
3. **Risk Management**: Progressive deployment with validation at each stage
4. **Flexibility**: Can pause between phases if issues arise

**Recommended Next Steps**:
1. Review and approve this staging strategy
2. Begin Phase 1 cherry-picking
3. Create Phase 1 PR
4. Iterate through phases with stakeholder sign-off at each stage
