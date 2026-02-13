# TFRS to LCFS Migration Review

## Overview
Based on the clarification that TFRS data will be migrated into existing LCFS models and displayed using existing LCFS views (NOT custom legacy views), this document reviews the migration approach and identifies unnecessary code.

---

## ✅ Migration Schema - CORRECT APPROACH

### Database Migrations (PR #1)

**Migration 54d55e878dad** - Modifies existing `compliance_report_summary` table:
- ✅ Adds `historical_snapshot` JSONB column for full TFRS data preservation
- ✅ Removes `credits_offset_a/b/c` columns (TFRS-specific, unused in LCFS)
- ✅ Recreates metabase views

**Migration 87592f5136b3** - Populates reference data:
- ✅ Inserts historical `target_carbon_intensity` values (2013-2023)
- ✅ Adds `fuel_instance` records for legacy fuel types (21, 22, 23)
- ✅ Adds `energy_effectiveness_ratio` records for legacy fuels

**Migration a3290902296b** - Adds renewable diesel fuel type

**Migration 5c3de27f158b** - Adds BETA_TESTER role enum

**Migration 8e530edb155f** - Backfills organization snapshots

### ETL Scripts (PR #2) - Target Existing LCFS Tables ✅

All ETL scripts correctly insert into **existing LCFS tables**:

1. **migrate_compliance_summaries.py**
   - Target: `compliance_report_summary` (existing LCFS table)
   - Maps TFRS fields to LCFS fields where possible
   - Leaves unmapped fields as NULL

2. **migrate_compliance_summary_updates.py**
   - Target: Updates `compliance_report_summary`
   - Populates `historical_snapshot` with full TFRS JSON snapshot
   - Recalculates all summary lines using LCFS logic

3. **migrate_fuel_supply.py**
   - Target: `fuel_supply` (existing LCFS table)
   - Maps TFRS fuel supply records to LCFS schema

4. **migrate_allocation_agreements.py**
   - Target: `allocation_agreement` (existing LCFS table)

5. **migrate_notional_transfers.py**
   - Target: `notional_transfer` (existing LCFS table)

6. **migrate_other_uses.py**
   - Target: `other_uses` (existing LCFS table)

**Conclusion**: ✅ Migrations and ETL scripts are correctly designed to use existing LCFS tables. Data will display in existing LCFS compliance report views.

---

## ⚠️ PR #3 Code Review - Unnecessary Legacy UI Components

Since TFRS data will be displayed using **existing LCFS views**, the following files in PR #3 are **UNNECESSARY and should be removed**:

### Frontend - Remove These Files (17 files)

#### Legacy View Components (Not Needed)
```
frontend/src/views/ComplianceReports/legacy-deprecated/ExclusionAgreementSummary.jsx
frontend/src/views/ComplianceReports/legacy-deprecated/LegacyReportDetails.jsx
frontend/src/views/ComplianceReports/legacy-deprecated/LegacyReportSummary.jsx
frontend/src/views/ComplianceReports/legacy-deprecated/ScheduleASummary.jsx
frontend/src/views/ComplianceReports/legacy-deprecated/ScheduleBSummary.jsx
frontend/src/views/ComplianceReports/legacy-deprecated/ScheduleCSummary.jsx
frontend/src/views/ComplianceReports/legacy-deprecated/_schema.jsx
```

#### Legacy View Tests (Not Needed)
```
frontend/src/views/ComplianceReports/legacy-deprecated/__test__/LegacyReportSummary.test.jsx
frontend/src/views/ComplianceReports/legacy-deprecated/__test__/ScheduleASummary.test.jsx
frontend/src/views/ComplianceReports/legacy-deprecated/__test__/ScheduleBSummary.test.jsx
frontend/src/views/ComplianceReports/legacy-deprecated/__test__/ScheduleCSummary.test.jsx
```

#### Legacy-Specific Views (Probably Not Needed)
```
frontend/src/views/ComplianceReports/ViewLegacyComplianceReport.jsx
frontend/src/views/ComplianceReports/__tests__/ViewLegacyComplianceReport.test.jsx
frontend/src/views/ComplianceReports/components/LegacyAssessmentCard.jsx
```

#### Legacy Schemas (May Not Be Needed)
```
frontend/src/views/FuelSupplies/_legacySchema.jsx
frontend/src/assets/locales/en/legacy.json
```

### Backend - Review These Files

#### Probably Remove
```
backend/lcfs/web/api/fuel_supply/legacy_repo.py
```

**Question**: Are there backend API endpoints specifically for serving legacy views? If so, those can be removed too.

---

## 🔍 Files to Keep and Review

### Files That May Still Be Useful

**ComplianceReportViewSelector.jsx** - REVIEW
- If this just routes between modern/legacy, might not be needed
- If it has logic for detecting TFRS-migrated reports, might be useful

**BETA_TESTER role changes** - KEEP
- If beta testers need early access to view migrated data

**Model changes** - ALREADY IN PR #1
- ComplianceReportSummary.py (historical_snapshot field) ✅
- Role.py (BETA_TESTER enum) ✅

---

## 📋 Recommended Next Steps

### 1. Review Migration Data Mapping

**Check that ETL scripts correctly map TFRS → LCFS fields:**

```bash
# Review key mapping files
cat etl/python_migration/migrations/migrate_compliance_summaries.py | grep -A 100 "def build_summary_record"
cat etl/python_migration/migrations/migrate_fuel_supply.py | grep -A 50 "INSERT INTO fuel_supply"
```

**Key questions:**
- Are TFRS fuel types correctly mapping to LCFS fuel types?
- Are TFRS compliance periods mapping to correct LCFS compliance periods?
- Are calculations (carbon intensity, credits, etc.) using LCFS formulas?

### 2. Test Data Display with Existing LCFS Views

**After migration, verify:**
- Historical reports (2013-2023) display correctly in standard LCFS compliance report view
- Summary calculations are accurate
- Fuel supply records render properly
- Allocation agreements and notional transfers display correctly

### 3. Clean Up PR #3

**Remove unnecessary legacy UI components:**
```bash
git checkout feat/tfrs-frontend-backend-integration

# Remove entire legacy-deprecated directory
git rm -r frontend/src/views/ComplianceReports/legacy-deprecated/

# Remove legacy-specific views if not needed
git rm frontend/src/views/ComplianceReports/ViewLegacyComplianceReport.jsx
git rm frontend/src/views/ComplianceReports/__tests__/ViewLegacyComplianceReport.test.jsx
git rm frontend/src/views/ComplianceReports/components/LegacyAssessmentCard.jsx

# Remove legacy schemas if not needed
git rm frontend/src/views/FuelSupplies/_legacySchema.jsx
git rm frontend/src/assets/locales/en/legacy.json

# Remove backend legacy repo if not needed
git rm backend/lcfs/web/api/fuel_supply/legacy_repo.py

# Commit cleanup
git commit -m "refactor: remove unnecessary legacy UI components

TFRS data is migrated into existing LCFS tables and displayed
using standard LCFS compliance report views. Custom legacy views
are not needed."
```

### 4. Review Backend Service Changes

**Check what backend changes in PR #3 are actually needed:**
- Do any services need updates to handle `historical_snapshot` JSONB field?
- Are there query optimizations needed for historical data?
- Do existing LCFS APIs already handle all the migrated data correctly?

---

## 🎯 Summary

### ✅ What's Working Well
1. Database migrations correctly modify existing tables
2. ETL scripts target existing LCFS tables
3. `historical_snapshot` JSONB preserves full TFRS data for audit
4. Reference data (fuel types, carbon intensities) properly populated

### ⚠️ What Needs Attention
1. PR #3 has ~17 unnecessary legacy UI component files
2. Backend legacy_repo.py may not be needed
3. Need to verify ETL data mapping is correct for LCFS display
4. May need minor backend changes to handle historical_snapshot if needed

### 🔧 Action Items
- [ ] Remove unnecessary legacy UI components from PR #3
- [ ] Review and test ETL data mapping for correct LCFS display
- [ ] Verify existing LCFS compliance report view handles migrated data
- [ ] Check if any backend service changes are needed for historical_snapshot
- [ ] Test with sample migrated data in dev environment

---

## Questions to Answer

1. **Do existing LCFS compliance report views handle NULL fields gracefully?**
   (Many TFRS records will have NULL values for newer LCFS fields like jet fuel)

2. **Is there any need to distinguish TFRS-migrated reports vs native LCFS reports in the UI?**
   (If not, ViewLegacyComplianceReport.jsx can be removed)

3. **Do any backend APIs need updates to query historical_snapshot?**
   (Or is it just for audit/archive purposes?)

4. **Are the ETL field mappings verified as correct?**
   (Especially for fuel types, compliance periods, and carbon intensity calculations)
