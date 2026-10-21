# Frontend test optimization compatibility with Vite+

Tracking issue: [#5100](https://github.com/bcgov/lcfs/issues/5100).
The optimization work remains owned by #5089 and #5090–#5093.

## Comparison revisions

- Optimized pre-migration baseline: `33aa45709`.
- Vite+ candidate: `415f2dd5094b4d73839df7482f50dde4c77b276e`, the
  `kevin/issue-5099` tip verified against origin before testing.
- Compatibility follow-up changes explicitly pin CI blob output to
  `.vitest-reports`, use Vite+ for report merging and diagnostics, and reject
  incomplete report sets. They do not alter test assertions or product code.

## Reproduce the timing comparison

Install each revision's own lockfile with `npm ci` in separate worktrees, using
the same exact Node version. Cypress installation can be skipped for unit tests
with `CYPRESS_INSTALL_BINARY=0`.

From the candidate repository root, derive the shared test scope without any
repository benchmark tooling:

```sh
python3 - <<'PYTHON'
from pathlib import Path
import re
import subprocess

def files(revision):
    paths = subprocess.check_output(
        ['git', 'ls-tree', '-r', '--name-only', revision, '--', 'frontend/src'],
        text=True
    ).splitlines()
    return {path.removeprefix('frontend/') for path in paths
            if re.search(r'\.(test|spec)\.(js|jsx|ts|tsx)$', path)}

common = sorted(files('33aa45709') & files('415f2dd50'))
assert len(common) == 424
Path('/tmp/lcfs-5100-common-tests.txt').write_text('\n'.join(common) + '\n')
PYTHON
```

Run the following in Bash from each checkout's `frontend/` directory. This is
the measured command with the explicit shared file filters; `/usr/bin/time -p`
provides elapsed time for manual reproduction:

```bash
test_files=()
while IFS= read -r test_file; do
  test_files+=("$test_file")
done < /tmp/lcfs-5100-common-tests.txt
rm -rf node_modules/.vite node_modules/.vitest
env -u FORCE_COLOR -u NODE_OPTIONS -u VITEST_POOL_THREADS \
  -u SHARD_INDEX -u SHARD_TOTAL -u ENFORCE_COVERAGE_THRESHOLDS \
  CI=true TZ=UTC NO_COLOR=1 /usr/bin/time -p \
  npm run test:run -- --coverage.enabled=false --reporter=dot \
  --pool=forks --maxWorkers=8 "${test_files[@]}"
```

Run one process at a time, in baseline/candidate, candidate/baseline,
baseline/candidate order, clearing the two cache directories before each run.
Record commit hashes, frontend diffs, lockfile checksums, tool versions, commands,
exit statuses, and raw logs. The recorded benchmark used monotonic elapsed time
around each subprocess. This is a tool-cache-cold comparison; operating-system
filesystem caches are not flushed. Node's compile cache and other machine
activity can still affect timing.

Both revisions use `CI=true`, `TZ=UTC`, `NO_COLOR=1`, coverage disabled, the dot
reporter, the forks pool, and a maximum of eight workers. Vitest 5 no longer
offers `minWorkers`; this comparison standardizes maximum concurrency rather
than claiming eight permanently allocated workers. The base command is:

```sh
npm run test:run -- --coverage.enabled=false --reporter=dot --pool=forks --maxWorkers=8
```

The comparison passes the sorted shared test file list as positive file filters to
both runners. The candidate adds
`src/views/OtherUses/__tests__/_schema.test.jsx`; exclude that file from the
controlled comparison, but include it in full compatibility/coverage runs.
There are 424 common test files, including 50 Node test files. A CLI exclusion
was insufficient because inline project configuration overrode it; that first
pair is diagnostic evidence only. Actual executed
test totals must also match before interpreting the medians.

Stop the comparison if any run fails or test totals differ. Failed or incomplete runs are diagnostic
evidence, not valid performance comparisons. Historical results from #5076
(362 files, 5,887 passing tests, approximately 48 seconds) describe a smaller,
older suite and are not a threshold for this comparison.

## Compatibility verification

After timing runs, verify both projects, fixture laziness and cleanup, the full
coverage-enabled suite, and the CI blob/JUnit path. Run coverage jobs sequentially
to avoid competing for the same coverage directory. Check aggregate thresholds
with `ENFORCE_COVERAGE_THRESHOLDS=true` only after all shards are merged.
Keep `clearMocks: false` and `sharedViteServer: false` until their removal is
independently verified; removing them is not required for this issue.

The existing CI matrix still has 32 shards. Its merge step expects one blob per
configured shard and lets the installed Vite+ validate blob contents and version.
JUnit output lives outside the blob input directory. Missing, malformed, or
incompatible reports must fail rather than produce an empty successful report.

## Optimization rollout follow-up

#5093 is closed, but this candidate does not configure a fixed worker allocation
or four CI shards, and repository searches did not find the promised benchmark
documentation. Reconcile those gaps with #5093 separately. Reducing sharding or
changing default concurrency requires resource and coverage evidence; this
compatibility change preserves the current matrix. Rejected experiments from
#5076 remain documented in that PR and should not be reintroduced without new
measurements.

## Results

Measured on 2026-10-21 with Node `v24.21.0`, npm `11.19.0`, an Apple M3 Pro
(12 logical CPUs, 36 GiB memory), and macOS arm64. The baseline uses Vitest
`4.1.11`; the candidate uses Vite+ `1.3.0` and Vitest `5.0.5`.

All six shared-scope runs passed: 424 files, 6,733 passing tests, and 11 skipped
tests. Execution order was baseline/candidate, candidate/baseline,
baseline/candidate.

| Run | Baseline elapsed | Vite+ elapsed | Baseline Vitest duration | Vite+ Vitest duration |
| --- | ---: | ---: | ---: | ---: |
| 1 | 69.386 s | 69.285 s | 68.78 s | 68.62 s |
| 2 | 69.099 s | 69.217 s | 68.45 s | 68.55 s |
| 3 | 69.203 s | 69.773 s | 68.56 s | 69.12 s |
| Median | 69.203 s | 69.285 s | 68.56 s | 68.62 s |

The median elapsed difference is +0.118%, smaller than observed run-to-run
variation. This comparison found no material timing regression. It measures
the complete migration stack with a shared test scope, rather than isolating
only the effect of a Vitest version change.

The preliminary full candidate run also passed all 425 files and 6,738 tests,
with 11 skipped tests. That run is excluded from the timing comparison because
it includes the additional five tests absent from the baseline.

Raw timing logs, exact commands and file filters, revision diffs, and lockfile
checksums are retained locally in
`.paseo/benchmarks/issue-5100/timing/results.json` and the adjacent log files.
This directory is ignored by Git; retain it with any shared benchmark evidence.

### Coverage and report validation

Four sequential local shards covered the full candidate suite, including the
additional file. Each shard used:

```sh
CI=true TZ=UTC NO_COLOR=1 ENFORCE_COVERAGE_THRESHOLDS=true \
  SHARD_INDEX=N SHARD_TOTAL=4 npm run test:ci:memory -- \
  --pool=forks --maxWorkers=8 \
  --coverage.reporter=text-summary --coverage.reporter=json-summary
```

All four shards passed, wrote the explicitly configured blob paths, and did not
enforce global thresholds against partial coverage. The merge command was:

```sh
CI=true TZ=UTC NO_COLOR=1 ENFORCE_COVERAGE_THRESHOLDS=true \
  ./node_modules/.bin/vp test --merge-reports=.vitest-reports \
  --reporter=junit --outputFile.junit=/tmp/lcfs-5100-report-validation/merged.xml \
  --coverage.reporter=text-summary --coverage.reporter=json-summary
```

The merged JUnit contains 425 suites and 6,749 cases: 6,738 passed, 11 skipped,
zero failures or errors. Both fixture-specific suites passed (one Node laziness
test and ten DOM/provider fixture tests).

| Coverage metric | Measured | Required floor |
| --- | ---: | ---: |
| Statements | 67.09% | 60% |
| Branches | 58.31% | 50% |
| Functions | 59.84% | 52% |
| Lines | 67.80% | 60% |

Empty and malformed blob directories both caused merge exit code 1. Repeating
the valid merge with `--coverage.thresholds.lines=100` also exited 1 with
`Coverage for lines (67.8%) does not meet global threshold (100%)`, confirming
that aggregate enforcement remains active.

`npm run check` passed: all 1,139 files were formatted correctly, and 1,097 files
had no warnings, lint errors, or type errors. Workflow YAML, frontend workflow
shell syntax and `git diff --check` also passed.

Raw validation logs, merged JUnit, coverage summary, and the local validation
driver are retained in `.paseo/benchmarks/issue-5100/`. These checks validate
local four-shard aggregation; the actual 32-shard GitHub Actions workflow and
its hosted-runner resource usage have not been run as part of this task.

#5100 should remain open until the migration and compatibility follow-up land
and the hosted CI path passes. Reconcile #5093's worker/shard rollout separately
with measurements on hosted runners before changing the matrix.

### Lint and TypeScript comparison

Follow-up measurements used the same revisions, machine, and Node version, with
three sequential runs of each command and alternating revision order. Unlike
the test benchmark, caches were not cleared. These medians describe repeated
local execution, not controlled cold-start comparisons. First-run lint elapsed
times were 51.067 s for ESLint and 14.424 s for Vite+; later runs were much faster.

| Command | Pre-Vite+ median | Vite+ median | Exit status |
| --- | ---: | ---: | --- |
| `npm run lint` | 13.537 s | 2.620 s | Both fail, on different diagnostics |
| Type check (`type-check` / `typecheck`) | 5.955 s | 2.548 s | Both pass |
| `npm run check` | No corresponding script | 2.909 s | Passes |

The old type-check command is `tsc --noEmit`; the new command is
`vp lint --type-aware --type-check`. Vite+'s configuration enables type-aware
linting and type checking globally, so its lint and type-check commands overlap.
Do not add their durations together as separate required work. `vp check` also
checks formatting. The TypeScript-command median decreased about 57%, despite
the new command also running linting; the tools and rule implementations differ.

The existing pre-migration ESLint failure is `react/display-name` in
`src/hooks/__tests__/useMentionableUsers.test.jsx:21`; the migration names that
wrapper. Vite+'s `npm run lint` instead fails on an unused
`react/exhaustive-deps` suppression at
`src/components/BCDataGrid/components/StatusBar/BCPaginationActions.tsx:1`.
`npm run check` and `npm run typecheck` do not request
`--report-unused-disable-directives`, so both passed at the time. This revealed
a gate consistency gap, corrected in the aligned comparison below. These first
lint timings are diagnostic measurements, not a comparison of equally passing
checks. No source or gate configuration was changed during that first
follow-up measurement.

Logs, exact commands, exit statuses, timings, and the measurement driver are
retained locally under `.paseo/benchmarks/issue-5100/quality/`.

### Aligned passing quality gates

The follow-up makes unused-suppression reporting part of
`lint.options.reportUnusedDisableDirectives` in `vite.config.ts`, with
`maxWarnings: 0`. Consequently, `vp check`, `vp lint`, and the type-check script
use the same policy. Before removing the stale suppression in
`BCPaginationActions.tsx`, `npm run check` was verified to exit 1 on that warning.
The obsolete suppression was then removed; no lint rule was disabled.

The isolated legacy benchmark checkout required these repairs:

- Name the React Query test wrapper to satisfy the existing display-name rule.
- Apply the existing Prettier formatter (413 files initially failed its check).
- Move the existing `locationService.ts` suppression to the line containing the
  `any` assertion after formatting wrapped that statement. The assertion and
  lint rule remain unchanged.

Those legacy changes stay in the isolated baseline worktree, not in the Vite+
implementation. Benchmark evidence includes the exact tracked frontend patches
for both revisions. These are comparisons of passing project quality gates
with equivalent responsibilities; ESLint/Prettier and Oxlint/Oxfmt retain their
different rule implementations and supported file formats.

The quality comparison measures each complete command sequence directly, excludes
one warm-up for each revision/scenario, then runs three measurements with
alternating revision order. Caches are retained to measure repeated local use.

| Scenario | Pre-Vite+ commands, sequential | Vite+ command |
| --- | --- | --- |
| Lint and types | `npm run lint`, `npm run type-check` | `npm run check -- --no-fmt` |
| Formatting, lint, and types | `npm run prettier`, `npm run lint`, `npm run type-check` | `npm run check` |

Reproduce in each checkout's `frontend/` directory after applying the baseline
repairs above. Time each complete sequence rather than adding standalone
medians:

```sh
# Baseline: lint and TypeScript
/usr/bin/time -p sh -c 'npm run lint && npm run type-check'
# Candidate: lint and TypeScript
/usr/bin/time -p npm run check -- --no-fmt

# Baseline: formatting, lint, and TypeScript
/usr/bin/time -p sh -c 'npm run prettier && npm run lint && npm run type-check'
# Candidate: formatting, lint, and TypeScript
/usr/bin/time -p npm run check
```

Set `CI=true`, `TZ=UTC`, and `NO_COLOR=1`, and unset `FORCE_COLOR` and
`NODE_OPTIONS` for each sequence. For each scenario, run one excluded warm-up
per revision, followed by three measurements alternating baseline/candidate
order. Preserve caches between these quality checks. Stop if any command fails.

All warm-ups and measured command sequences passed with zero warnings/errors.
Measured end-to-end elapsed times were:

| Scenario | Pre-Vite+ runs (s) | Vite+ runs (s) | Pre-Vite+ median | Vite+ median | Speedup |
| --- | --- | --- | ---: | ---: | ---: |
| Lint and types | 19.010, 19.483, 18.991 | 2.644, 2.637, 2.647 | 19.010 s | 2.644 s | 7.19× |
| Formatting, lint, and types | 25.125, 24.895, 24.901 | 2.827, 2.891, 2.903 | 24.901 s | 2.891 s | 8.61× |

The full passing quality gate used 88.39% less elapsed time in this warmed
local comparison. The lint/type-only gate used 86.09% less time. These results
supersede the earlier estimate obtained by adding standalone medians and the
earlier timings of failing lint commands.

The aligned results, raw logs, baseline and candidate patches, and gate failure
probes are retained in `.paseo/benchmarks/issue-5100/quality-equivalent/`.
An intentional `TS2322` assignment error was also verified to fail
`npm run check -- --no-fmt`; the temporary probe file was removed immediately.
The standalone `npm run lint` passed after the suppression repair.
