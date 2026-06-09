-- LCFS issue #4364 — historical penalty inflation fix
--
-- Bug: ETL migrate_compliance_summary_updates.py multiplied TFRS snapshot Line 28
-- (already a dollar amount) by the per-unit rate (200 for <=2022, 600 for >=2023),
-- inflating line_21_non_compliance_penalty_payable by 200x or 600x and inflating
-- total_non_compliance_penalty_payable by the same component.
--
-- Fix: recover the correct value from compliance_report_summary.historical_snapshot
-- (the JSON snapshot the ETL stored alongside the row) and rewrite L21, the legacy
-- L21-ratio column the ETL also wrote to, and the rolled-up total.
--
-- Safety:
--   * Only touches rows still bearing the ETL signature (update_user = 'ETL_COMPLIANCE_SUMMARY').
--   * Only touches rows whose current L21 matches snapshot_L28 * rate exactly,
--     so any post-migration manual edit/override is left alone.
--   * Wrapped in a transaction; verify SELECTs run before COMMIT.
--
-- Expected impact (local + reproduced from prod-equivalent dataset): 39 rows.

\set ON_ERROR_STOP on

BEGIN;

-- 1. Preview the rows that will change.
SELECT cr.compliance_report_id,
       cp.description AS year,
       o.name,
       crs.line_21_non_compliance_penalty_payable AS l21_before,
       (crs.historical_snapshot->'summary'->'lines'->>'28')::numeric AS l21_after,
       crs.total_non_compliance_penalty_payable AS total_before,
       COALESCE(crs.line_11_non_compliance_penalty_gasoline,0)
         + COALESCE(crs.line_11_non_compliance_penalty_diesel,0)
         + COALESCE(crs.line_11_non_compliance_penalty_jet_fuel,0)
         + (crs.historical_snapshot->'summary'->'lines'->>'28')::numeric AS total_after
  FROM compliance_report_summary crs
  JOIN compliance_report cr  ON cr.compliance_report_id = crs.compliance_report_id
  JOIN compliance_period cp  ON cp.compliance_period_id = cr.compliance_period_id
  JOIN organization o        ON o.organization_id       = cr.organization_id
 WHERE crs.historical_snapshot IS NOT NULL
   AND crs.update_user = 'ETL_COMPLIANCE_SUMMARY'
   AND crs.line_21_non_compliance_penalty_payable > 0
   AND (crs.historical_snapshot->'summary'->'lines'->>'28') IS NOT NULL
   AND (crs.historical_snapshot->'summary'->'lines'->>'28')::numeric > 0
   AND ABS(crs.line_21_non_compliance_penalty_payable
           - (crs.historical_snapshot->'summary'->'lines'->>'28')::numeric
             * CASE WHEN cp.description::int <= 2022 THEN 200 ELSE 600 END
          ) < 0.01
 ORDER BY cp.description::int, cr.compliance_report_id;

-- 2. Apply the patch.
WITH target AS (
  SELECT crs.summary_id,
         (crs.historical_snapshot->'summary'->'lines'->>'28')::numeric AS snap_l28,
         COALESCE(crs.line_11_non_compliance_penalty_gasoline,0)
           + COALESCE(crs.line_11_non_compliance_penalty_diesel,0)
           + COALESCE(crs.line_11_non_compliance_penalty_jet_fuel,0) AS l11_total
    FROM compliance_report_summary crs
    JOIN compliance_report cr ON cr.compliance_report_id = crs.compliance_report_id
    JOIN compliance_period cp ON cp.compliance_period_id = cr.compliance_period_id
   WHERE crs.historical_snapshot IS NOT NULL
     AND crs.update_user = 'ETL_COMPLIANCE_SUMMARY'
     AND crs.line_21_non_compliance_penalty_payable > 0
     AND (crs.historical_snapshot->'summary'->'lines'->>'28') IS NOT NULL
     AND (crs.historical_snapshot->'summary'->'lines'->>'28')::numeric > 0
     AND ABS(crs.line_21_non_compliance_penalty_payable
             - (crs.historical_snapshot->'summary'->'lines'->>'28')::numeric
               * CASE WHEN cp.description::int <= 2022 THEN 200 ELSE 600 END
            ) < 0.01
)
UPDATE compliance_report_summary crs
   SET line_21_non_compliance_penalty_payable = t.snap_l28,
       line_21_surplus_deficit_ratio          = t.snap_l28,
       total_non_compliance_penalty_payable   = t.l11_total + t.snap_l28,
       update_user                            = 'DATA_PATCH_4364',
       update_date                            = now()
  FROM target t
 WHERE crs.summary_id = t.summary_id;

-- 3. Verify: should print 39 rows patched (or whatever the preview showed).
SELECT COUNT(*) AS rows_patched
  FROM compliance_report_summary
 WHERE update_user = 'DATA_PATCH_4364';

-- 4. Sanity check: every patched row's new L21 equals snapshot Line 28.
SELECT cr.compliance_report_id, cp.description AS year,
       crs.line_21_non_compliance_penalty_payable AS l21,
       (crs.historical_snapshot->'summary'->'lines'->>'28')::numeric AS snap_l28
  FROM compliance_report_summary crs
  JOIN compliance_report cr ON cr.compliance_report_id = crs.compliance_report_id
  JOIN compliance_period cp ON cp.compliance_period_id = cr.compliance_period_id
 WHERE crs.update_user = 'DATA_PATCH_4364'
   AND ABS(crs.line_21_non_compliance_penalty_payable
           - (crs.historical_snapshot->'summary'->'lines'->>'28')::numeric) > 0.01;
-- ^ expected: 0 rows.

-- 5. Inspect the previewed numbers above. If they match expectations, COMMIT;
--    otherwise ROLLBACK.
COMMIT;
-- ROLLBACK;
