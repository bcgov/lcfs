# Compliance Report State Matrix
Purpose: quickly explain how compliance report versions move through statuses, how summaries lock, and how transactions are created or released. Use it as a checklist for tests and when debugging compare-mode or balance issues.

## At a Glance
- **Chain identity**: `compliance_report_group_uuid` groups all versions; `version` starts at 0 and increments for each supplemental/reassessment in the same chain.
- **Who locks what**: Summary locks when recommendation or assessment occurs; locked summaries skip recalculation and hold captured line 17/deltas.
- **Transactions**: Submitting creates/updates a *Reserved* transaction from line 20. Assessment converts the reserved tx to an *Adjustment* (unless `is_non_assessment`). Opening a draft supplemental releases the superseded reserved tx.
- **Windows**: Transaction aggregation runs Jan 1→Mar 31 unless a previous-year assessed exists; then it shifts to Apr 1→Mar 31 of the compliance year.

## Status Lifecycle (who can trigger and what happens)

| Status                   | Triggered by                | Effects                                                                           |
|--------------------------|-----------------------------|------------------------------------------------------------------------------------|
| Draft                    | Supplier or analyst         | Summary recalculates on fetch; no locking; no transactions yet.                    |
| Submitted                | Supplier                    | `handle_submitted_status` makes/updates Reserved tx from line 20; summary still dynamic. |
| Recommended by analyst   | Analyst                     | Locks summary; preserves entered lines 6–8; stores line 17; reserved tx remains.    |
| Recommended by manager   | Manager                     | Same lock state as analyst recommendation.                                         |
| Assessed                 | Director                    | Converts reserved tx to Adjustment (unless non-assessment); summary stays locked.   |
| Analyst adjustment       | Government reassessment     | Draft-like state in same chain; releases prior reserved tx; recalculates until locked. |
| Supplemental requested   | Display-only                | No direct effects (historical).                                                    |
| Rejected/Not recommended | Historical display          | Not active in current flows.                                                       |

## Report Types Within a Chain
- **Original annual/early-issuance (v0)**: Starts Draft; recalculates until locked. Transaction window Jan 1→Mar 31 unless a prior assessed exists.
- **Supplier supplemental (v>0, `SUPPLIER_SUPPLEMENTAL`)**: Starts Draft from latest assessed; copies prior assessed lines 6–9; seeds line 17 with current available balance; releases superseded reserved tx.
- **Gov-initiated supplemental (v>0, `GOVERNMENT_INITIATED`)**: Analyst spawns from a Submitted report; copies submitted lines 6–9; releases the submitted reserved tx; supplier edits and resubmits.
- **Gov reassessment (v>0, `GOVERNMENT_REASSESSMENT`, status `Analyst adjustment`)**: Draft off Submitted/Assessed to re-assess; uses same chain; previous reserved tx released.

## What Locks and What Recalculates (Summary Lines)
- **Lines 1–5**: Calculated from schedules (Fuel Supply, Other Uses, Notional Transfers); diesel %, jet ramps follow policy by year.
- **Line 6 (retained)**: User-entered; persisted; preserved when locked.
- **Lines 7/9 (previously retained / obligation added)**:
  - If a prior-year assessed exists and year ≥ 2025: auto-populated from prior assessed line 6/8 and locked.
  - Otherwise: editable stored values; preserved when locked.
- **Line 8 (deferred)**: User-entered; preserved when locked.
- **Line 10**: Derived from lines 2, 5–9.
- **Lines 11/21**: Penalties (prescribed rates; $600/unit for low-carbon).
- **Lines 12–14**: Low-carbon transactions in period window (Jan 1→Mar 31, or Apr 1→Mar 31 if prior assessed).
- **Lines 15/16**: From last assessed for same period (`line_18_units_to_be_banked` / `line_19_units_to_be_exported`); default 0 if none.
- **Line 17**: Available balance end of period; locked supplementals reuse stored `line_17_non_banked_units_used`; otherwise recomputed via `TransactionRepository.calculate_line_17_available_balance_for_period`.
- **Lines 18/19**: Current-period issued units (fuel supply/export).  
- **Line 20**: `18 + 19 – 15 – 16`; drives reserved/adjustment tx and penalties.
- **Line 22**: `max(17 + 20, 0)` after assessment logic.

## Common State Scenarios (good test targets)
- First-ever report: Lines 7/9 editable zeros; 15/16 = 0; window Jan 1→Mar 31(+1).
- With previous-year assessed: Lines 7/9 auto-populated & locked (2025+); window shifts to Apr 1→Mar 31(+1); 15/16 from prior assessed lines 18/19.
- Submitted (pre-recommendation): Dynamic summary; reserved tx from current line 20; lines 6–9 editable.
- Recommended (analyst/manager): Summary locked; stored line 17; no further recalculation on fetch.
- Assessed: Adjustment persisted; any new draft supplemental/reassessment releases old reserved tx.
- Supplier supplemental after assessment: Unlocked initially; line 17 seeded from current balance; lines 6–9 copied from assessed snapshot.
- Gov-initiated supplemental on submitted: Unlocked with lines 6–9 from submitted snapshot; 15/16 = 0 unless a same-period assessed exists.
- Analyst adjustment on assessed/submitted: Same as gov supplemental but status `Analyst adjustment`; reuses previous summary values; releases/reserves appropriately.
- Early issuance (quarterly): Same rules; multiple submissions share chain; ensure tests cover 15/16 when no assessed baseline exists.
- Deletion edge: Only draft/analyst-adjustment deletable; deleting a superseding report reinstates previous reserved tx.

Use this matrix when adding summary unit tests, compare-mode checks, or diagnosing ledger/balance discrepancies.
