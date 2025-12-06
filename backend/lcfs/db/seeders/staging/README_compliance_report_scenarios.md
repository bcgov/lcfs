# Staging Compliance Report Scenarios (LCFS1–LCFS10)

New seeds add dedicated compliance reports (IDs 101–110) with real transactions, summaries, and sub-records (fuel supply, notional transfers, allocation agreements, other uses). Existing seeds are untouched.

Compliance periods: 2024 → id 15, 2025 → id 16, baseline 2023 → id 14.

## Scenario map
- 101 LCFS Org 1 (user 7): Draft 2024, annual, tx: none, summary unlocked.  
  Fuel/other: fuel_supply_id 101, notional 101, allocation 101, other_uses 101.
- 102 LCFS Org 2 (user 8): Submitted 2024, Reserved tx 101, summary unlocked.  
  Fuel/other: fuel_supply_id 102, notional 102, allocation 102, other_uses 102.
- 103 LCFS Org 3 (user 9): Recommended-by-analyst 2024, Reserved tx 104, summary locked.  
  Fuel/other: fuel_supply_id 103, notional 103, allocation 103, other_uses 103.
- 104 LCFS Org 4 (user 10): Assessed 2024, Adjustment tx 102, summary locked.  
  Fuel/other: fuel_supply_id 104, notional 104, allocation 104, other_uses 104.
- 105 LCFS Org 5 (user 11): Analyst Adjustment (draft) 2025, Reserved tx 106, summary locked.  
  Fuel/other: fuel_supply_id 105, notional 105, allocation 105, other_uses 105.
- 106 LCFS Org 6 (user 12): Supplier Supplemental v1 2025 (draft), Adjustment tx 105, summary unlocked.  
  Fuel/other: fuel_supply_id 106, notional 106, allocation 106, other_uses 106.
- 107 LCFS Org 7 (user 13): Gov supplemental (draft) 2025, Reserved tx 107, summary unlocked.  
  Fuel/other: fuel_supply_id 107, notional 107, allocation 107, other_uses 107.
- 108 LCFS Org 8 (user 14): Early issuance quarterly draft 2025, no tx, summary unlocked.  
  Fuel/other: fuel_supply_id 108, notional 108, allocation 108, other_uses 108.
- 109 LCFS Org 9 (user 15): Assessed baseline 2023, Adjustment tx 103, summary locked.  
  Fuel/other: fuel_supply_id 109, notional 109, allocation 109, other_uses 109.
- 110 LCFS Org 10 (user 16): Draft 2025 with prior-year assessed baseline present (109), Reserved tx 110, summary unlocked.  
  Fuel/other: fuel_supply_id 110, notional 110, allocation 110, other_uses 110.
- 111 Org 2 (user 8): Submitted v0 2025, Reserved tx 111, summary unlocked.  
  Fuel/other: fuel_supply_id 111, notional 111, allocation 111, other_uses 111.
- 112 Org 2 (user 8): Assessed supplemental v1 2025, Adjustment tx 112, summary locked.  
  Fuel/other: fuel_supply_id 112, notional 112, allocation 112, other_uses 112.
- 113 Org 2 (user 8): Draft supplemental v2 2025, Reserved tx 113, summary unlocked.  
  Fuel/other: fuel_supply_id 113, notional 113, allocation 113, other_uses 113.

## Locking and lines
- Pre-2025 vs 2025+ covered (2023 baseline via 109 for prior-year assessed).
- Lines 6–9: locked behavior testable via 109→110 and 106/107 supplementals.
- Lines 12/13: driven by small fuel supply + notional transfers.

## Files touched
- `test_compliance_report_seeder.py` (reports 101–110, nicknames)
- `test_compliance_report_summary_seeder.py` (summaries 101–110, small values)
- `test_compliance_report_history_seeder.py` (status flows)
- `test_compliance_report_organization_snapshot_seeder.py` (snapshots)
- `test_transaction_seeder.py` (tx 101–113)
- `test_fuel_supply_seeder.py`, `test_notional_transfer_seeder.py`, `test_allocation_agreement_seeder.py`, `test_other_uses_seeder.py` (sub-records)
