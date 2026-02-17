# Phase 1: Foundation Schema - File Checklist

This document lists every file that should be included in Phase 1 PR. Use this as a cherry-pick guide.

---

## Migration Files (10 files)

### ✅ Include These Migrations

| File | Revision ID | Purpose | Risk |
|------|-------------|---------|------|
| `backend/lcfs/db/migrations/versions/2025-08-29-02-51_c25619ad20df.py` | `c25619ad20df` | Revert transfer update date/user | LOW |
| `backend/lcfs/db/migrations/versions/2025-09-05-16-30_f1a2b3c4d5e6.py` | `f1a2b3c4d5e6` | Fix credit ledger MV triggers | LOW |
| `backend/lcfs/db/migrations/versions/2025-09-30-17-05_3ac464e21203.py` | `3ac464e21203` | Add company overview fields | LOW |
| `backend/lcfs/db/migrations/versions/2025-10-08-12-42_63c126dcbecc.py` | `63c126dcbecc` | Create penalty_log table | LOW |
| `backend/lcfs/db/migrations/versions/2025-10-16-14-00_995ba109ca8d.py` | `995ba109ca8d` | Charging equipment intended user assoc | LOW |
| `backend/lcfs/db/migrations/versions/2025-10-29-13-11_1909a3e5fafd.py` | `1909a3e5fafd` | Update Canadian fuel prefix | LOW |
| `backend/lcfs/db/migrations/versions/2025-10-29-13-14_5c3de27f158b.py` | `5c3de27f158b` | Add BETA_TESTER role | LOW |
| `backend/lcfs/db/migrations/versions/2025-06-02-09-36_67c82d9397dd.py` | `67c82d9397dd` | Metabase views creation | LOW |
| `backend/lcfs/db/migrations/versions/2025-07-10-10-10_a1b2c3d4e5f7.py` | `a1b2c3d4e5f7` | Organization early issuance by year | LOW |
| `backend/lcfs/db/migrations/versions/2025-07-24-10-12_c3d4e5f6g7h8.py` | `c3d4e5f6g7h8` | Update metabase views | LOW |

### ❌ Exclude These Migrations (for later phases)

| File | Revision ID | Purpose | Phase |
|------|-------------|---------|-------|
| `backend/lcfs/db/migrations/versions/2025-10-29-13-12_a3290902296b.py` | `a3290902296b` | Add renewable diesel fuel type | Phase 3 |
| `backend/lcfs/db/migrations/versions/2025-10-29-13-13_54d55e878dad.py` | `54d55e878dad` | Compliance summary historical update | Phase 3 |
| `backend/lcfs/db/migrations/versions/2025-10-29-13-15_87592f5136b3.py` | `87592f5136b3` | Historical target carbon intensities | Phase 3 |
| `backend/lcfs/db/migrations/versions/2025-10-29-13-16_8e530edb155f.py` | `8e530edb155f` | Populate organization snapshots | Phase 4 |
| `backend/lcfs/db/migrations/versions/2025-09-03-02-13_c19276038926.py` | `c19276038926` | Migrate FSE to charging infrastructure | Phase 2 |
| `backend/lcfs/db/migrations/versions/2025-09-29-17-52_13529e573c05.py` | `13529e573c05` | FSE compliance reporting table | Phase 2 |
| `backend/lcfs/db/migrations/versions/2025-10-23-00-00_adee8bc4a278.py` | `adee8bc4a278` | Move allocating org to site | Phase 2 |
| `backend/lcfs/db/migrations/versions/2025-10-28-06-48_1f3ce398db1c.py` | `1f3ce398db1c` | Fix charging equipment compliance assoc | Phase 2 |

---

## Model Files

### ✅ Include These Models

**File**: `backend/lcfs/db/models/user/Role.py`
- **Change**: Add `BETA_TESTER` enum value
- **Lines**: Add to `RoleEnum` class
- **Dependencies**: Migration `5c3de27f158b`
- **Risk**: LOW

```python
# Add this line to RoleEnum
BETA_TESTER = "Beta Tester"
```

### ❌ Exclude These Models (for later phases)

**File**: `backend/lcfs/db/models/compliance/ComplianceReportSummary.py`
- **Phase**: 3 (schema prep) and 4 (data migration)
- **Reason**: Breaking change, requires ETL completion

---

## Backend Service Files (Phase 1 - Minimal/None)

Phase 1 should ideally have **NO** backend service changes, only schema. However, if there are any service files that ONLY relate to the 10 migrations above, they could be included.

### Check These Files:
- `backend/lcfs/web/api/organizations/` - Check for company overview field usage
- `backend/lcfs/web/api/penalty/` - Check for penalty_log usage (if exists)

**Recommendation**: If these service files reference Phase 2/3/4 features, exclude them from Phase 1.

---

## Frontend Files (Phase 1 - None)

**No frontend files should be included in Phase 1.**

All UI changes depend on either:
- Charging infrastructure (Phase 2)
- TFRS historical data (Phase 3/4)

---

## Test Files (Phase 1 - Conditional)

### ✅ Include if exist and are self-contained:
- Tests for company overview fields (if simple)
- Tests for penalty_log CRUD (if exist)
- Tests for BETA_TESTER role

### ❌ Exclude:
- Any tests referencing TFRS data
- Any tests referencing charging equipment/sites
- Any tests requiring ETL data

---

## Configuration/Infrastructure Files (Phase 1 - Minimal)

### Check These Files:

**Database Seeder Files**:
- `backend/lcfs/db/seeders/` - Check if any new seed data for:
  - penalty_log examples
  - BETA_TESTER role
  - charging equipment intended users

**Schema Files**:
- `backend/lcfs/web/api/*/schema.py` - Check for new schema definitions matching Phase 1 tables

---

## Cherry-Pick Commands by Migration

### Migration 1: c25619ad20df (Revert Transfer Metadata)

```bash
# Find commit with this migration
git log --all --source --full-history -- backend/lcfs/db/migrations/versions/2025-08-29-02-51_c25619ad20df.py

# Cherry-pick that commit (or create patch)
git cherry-pick <COMMIT_SHA>
```

### Migration 2: f1a2b3c4d5e6 (Fix Credit Ledger Triggers)

```bash
git log --all --source --full-history -- backend/lcfs/db/migrations/versions/2025-09-05-16-30_f1a2b3c4d5e6.py
git cherry-pick <COMMIT_SHA>
```

### Migration 3: 3ac464e21203 (Company Overview Fields)

```bash
git log --all --source --full-history -- backend/lcfs/db/migrations/versions/2025-09-30-17-05_3ac464e21203.py
git cherry-pick <COMMIT_SHA>

# Also check for related files:
git log --all --source --full-history -- backend/lcfs/db/models/organization/Organization.py
# If Organization.py has these fields added, include them
```

### Migration 4: 63c126dcbecc (Penalty Log Table)

```bash
git log --all --source --full-history -- backend/lcfs/db/migrations/versions/2025-10-08-12-42_63c126dcbecc.py
git cherry-pick <COMMIT_SHA>

# Check for model file (likely new)
git log --all --source --full-history -- backend/lcfs/db/models/organization/PenaltyLog.py
# Note: PenaltyLog.py exists in develop, so no need to include if unchanged
```

### Migration 5: 995ba109ca8d (Charging Equipment Intended User)

```bash
git log --all --source --full-history -- backend/lcfs/db/migrations/versions/2025-10-16-14-00_995ba109ca8d.py
git cherry-pick <COMMIT_SHA>
```

### Migration 6: 1909a3e5fafd (Canadian Fuel Prefix)

```bash
git log --all --source --full-history -- backend/lcfs/db/migrations/versions/2025-10-29-13-11_1909a3e5fafd.py
git cherry-pick <COMMIT_SHA>
```

### Migration 7: 5c3de27f158b (BETA_TESTER Role)

```bash
git log --all --source --full-history -- backend/lcfs/db/migrations/versions/2025-10-29-13-14_5c3de27f158b.py
git cherry-pick <COMMIT_SHA>

# MUST include Role.py model change
git log --all --source --full-history -- backend/lcfs/db/models/user/Role.py
git cherry-pick <COMMIT_SHA>
```

### Migration 8: 67c82d9397dd (Metabase Views)

```bash
git log --all --source --full-history -- backend/lcfs/db/migrations/versions/2025-06-02-09-36_67c82d9397dd.py
git cherry-pick <COMMIT_SHA>
```

### Migration 9: a1b2c3d4e5f7 (Organization Early Issuance)

```bash
git log --all --source --full-history -- backend/lcfs/db/migrations/versions/2025-07-10-10-10_a1b2c3d4e5f7.py
git cherry-pick <COMMIT_SHA>
```

### Migration 10: c3d4e5f6g7h8 (Update Metabase Views)

```bash
git log --all --source --full-history -- backend/lcfs/db/migrations/versions/2025-07-24-10-12_c3d4e5f6g7h8.py
git cherry-pick <COMMIT_SHA>
```

---

## Verification Checklist

After cherry-picking all Phase 1 files:

### 1. File Count Check
```bash
git diff develop --name-only | wc -l
# Should be approximately 10-15 files (10 migrations + 1 model + maybe a few tests)
```

### 2. No Unwanted Files
```bash
git diff develop --name-only | grep -E "(ComplianceReportSummary|charging_equipment|charging_site|etl/)"
# Should return EMPTY (no matches)
```

### 3. Migration Chain Verification
```bash
# Check down_revision links
grep -A 1 "revision =" backend/lcfs/db/migrations/versions/2025-08-29-02-51_c25619ad20df.py
grep -A 1 "down_revision =" backend/lcfs/db/migrations/versions/2025-08-29-02-51_c25619ad20df.py

# Verify each migration's down_revision points to a migration in develop OR another Phase 1 migration
```

### 4. Test Migrations
```bash
# On a test database
alembic upgrade head
# Should complete without errors

alembic downgrade base
# Should complete without errors

alembic upgrade head
# Should complete without errors
```

### 5. Code References Check
```bash
# Ensure no references to Phase 2/3/4 features
grep -r "historical_snapshot" backend/lcfs/web/api/
# Should be empty

grep -r "charging_site" backend/lcfs/web/api/
# Should be empty (or only in commented code)
```

---

## Known Issues / Edge Cases

### Issue 1: Migration Dependencies

Some Phase 1 migrations may have `down_revision` pointing to migrations not in Phase 1.

**Solution**: Ensure those dependencies exist in `develop` branch, OR include them in Phase 1 (if they're also safe).

**Check commands**:
```bash
# List all down_revisions in Phase 1 migrations
for file in backend/lcfs/db/migrations/versions/2025-{08,09,10}-*.py; do
  echo "File: $file"
  grep "down_revision =" "$file"
done

# Verify each down_revision exists in develop
alembic history | grep "<revision_id>"
```

### Issue 2: Metabase SQL File

Migrations `67c82d9397dd` and `c3d4e5f6g7h8` depend on `metabase.sql` file.

**Check**:
```bash
ls backend/lcfs/db/sql/metabase.sql
# Should exist in develop
```

If `metabase.sql` was modified in this branch:
- **Option A**: Include only the view creation sections needed for Phase 1
- **Option B**: Include entire `metabase.sql` update if low risk

### Issue 3: Enum Synchronization

Migration `5c3de27f158b` uses `alembic_postgresql_enum` to sync enum values.

**Verify**:
```bash
# Check if alembic_postgresql_enum is in requirements
grep "alembic.postgresql.enum" backend/pyproject.toml
# OR
grep "alembic.postgresql.enum" backend/requirements.txt
```

If missing, ensure it's in `develop`. If not, add to Phase 1 PR.

---

## Alternative: Patch-Based Approach

If cherry-picking is too complex due to intertwined commits:

### Create Patches for Each File

```bash
cd /Users/crux/dev/lcfs
git checkout feat/alex-tfrs-shutdown-migrations-250702

# Create patch for each Phase 1 migration
git diff develop -- backend/lcfs/db/migrations/versions/2025-08-29-02-51_c25619ad20df.py > /tmp/phase1_01_c25619ad20df.patch
git diff develop -- backend/lcfs/db/migrations/versions/2025-09-05-16-30_f1a2b3c4d5e6.py > /tmp/phase1_02_f1a2b3c4d5e6.patch
git diff develop -- backend/lcfs/db/migrations/versions/2025-09-30-17-05_3ac464e21203.py > /tmp/phase1_03_3ac464e21203.patch
git diff develop -- backend/lcfs/db/migrations/versions/2025-10-08-12-42_63c126dcbecc.py > /tmp/phase1_04_63c126dcbecc.patch
git diff develop -- backend/lcfs/db/migrations/versions/2025-10-16-14-00_995ba109ca8d.py > /tmp/phase1_05_995ba109ca8d.patch
git diff develop -- backend/lcfs/db/migrations/versions/2025-10-29-13-11_1909a3e5fafd.py > /tmp/phase1_06_1909a3e5fafd.patch
git diff develop -- backend/lcfs/db/migrations/versions/2025-10-29-13-14_5c3de27f158b.py > /tmp/phase1_07_5c3de27f158b.patch
git diff develop -- backend/lcfs/db/migrations/versions/2025-06-02-09-36_67c82d9397dd.py > /tmp/phase1_08_67c82d9397dd.patch
git diff develop -- backend/lcfs/db/migrations/versions/2025-07-10-10-10_a1b2c3d4e5f7.py > /tmp/phase1_09_a1b2c3d4e5f7.patch
git diff develop -- backend/lcfs/db/migrations/versions/2025-07-24-10-12_c3d4e5f6g7h8.py > /tmp/phase1_10_c3d4e5f6g7h8.patch

# Role model change
git diff develop -- backend/lcfs/db/models/user/Role.py > /tmp/phase1_11_role_model.patch
```

### Apply Patches to Phase 1 Branch

```bash
git checkout develop
git pull origin develop
git checkout -b feat/phase1-foundation-schema

# Apply each patch
git apply /tmp/phase1_01_c25619ad20df.patch
git add backend/lcfs/db/migrations/versions/2025-08-29-02-51_c25619ad20df.py
git commit -m "feat: revert transfer update date/user metadata

- Corrects metadata for backfilled transfers
- Sets proper update_user and update_date from history
- Migration: c25619ad20df"

git apply /tmp/phase1_02_f1a2b3c4d5e6.patch
git add backend/lcfs/db/migrations/versions/2025-09-05-16-30_f1a2b3c4d5e6.py
git commit -m "feat: restore credit ledger materialized view triggers

- Restores triggers accidentally dropped in BigInt migration
- Ensures mv_credit_ledger and mv_transaction_aggregate stay in sync
- Migration: f1a2b3c4d5e6"

# Continue for all patches...
```

---

## Success Criteria for Phase 1 PR

Before submitting Phase 1 PR, verify:

- [ ] Exactly 10 migration files included
- [ ] Role.py model change included
- [ ] No Phase 2/3/4 files included
- [ ] All migrations run successfully on clean database
- [ ] All migrations can downgrade successfully
- [ ] Migration chain links are correct
- [ ] No references to charging infrastructure
- [ ] No references to TFRS historical data
- [ ] No references to ComplianceReportSummary changes
- [ ] PR description clearly states Phase 1 scope
- [ ] Testing section completed in PR template

---

## Next Steps After Phase 1 Merged

1. **Monitor Production**: Watch for any issues for 1 week minimum
2. **Begin Phase 2 Prep**: Start preparing charging infrastructure PR
3. **Update Documentation**: Document Phase 1 completion date
4. **Stakeholder Communication**: Inform team Phase 1 complete, Phase 2 timeline

---

## Contact / Questions

For questions about:
- **Migration dependencies**: Check with database team
- **Risk assessment**: Review with QA/testing team
- **Deployment timeline**: Coordinate with DevOps
- **Business impact**: Confirm with product owners
