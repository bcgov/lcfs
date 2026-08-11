# Shared Test Utilities

The frontend test fixtures provide lazy, explicit test capabilities. Import
`test` from `@/tests/utils/fixtures` and request only the providers a test uses.

```jsx
import { screen } from '@testing-library/react'
import { test } from '@/tests/utils/fixtures'

test('renders a routed component', ({ render, router, theme }) => {
  render(<Component />, [router, theme])

  expect(screen.getByRole('heading')).toBeInTheDocument()
})
```

Available fixtures include `render`, `renderHook`, `query`, `router`, `theme`,
`localization`, `i18n`, and `server`. Fixtures are initialized lazily: a
provider is not loaded unless the test callback requests it. The `app` fixture
loads the complete provider set and should be reserved for tests that genuinely
need all application providers.

## Cold-Start Performance Baseline

The following results are the durable local baseline captured on August 10,
2026 after the native fixture migration. Use them for comparisons only when the
suite, dependencies, hardware, and benchmark protocol remain materially
equivalent.

### Environment

- macOS host with 10 logical CPUs
- Vitest 4.1.8 using the `threads` pool
- Default per-file isolation enabled
- 362 test files
- 5,905 tests: 5,887 passed, 11 skipped, 7 todo
- Coverage disabled for timing
- No concurrent test processes

### Protocol

Before every run, wait for host load to settle and clear only Vitest's optimized
dependency cache:

```sh
setopt null_glob
for deps in node_modules/.vite/vitest/*/deps; do
  test -d "$deps" && rm -rf "$deps"
done
```

Run the complete suite from `frontend`:

```sh
/usr/bin/time -p npm run test:run -- --coverage.enabled=false --reporter=dot
```

Do not run multiple Vitest commands concurrently. Record the pre-run load,
Vitest duration, `real`/`user`/`sys` values, file count, and test count. Use the
median of three cold runs rather than a single result.

### Six Workers

Configuration:

```ts
pool: 'threads'
minWorkers: 6
maxWorkers: 6
```

| Run |  Vitest |    Real |     User |     Sys |
| --- | ------: | ------: | -------: | ------: |
| 1   | 456.07s | 456.60s | 2617.19s | 183.61s |
| 2   | 476.73s | 477.37s | 2726.26s | 183.69s |
| 3   | 428.87s | 429.32s | 2471.78s | 173.83s |

- Median real time: 456.60s
- Mean real time: 454.43s
- Range: 48.05s
- Population standard deviation: approximately 19.68s

### Eight Workers

Configuration:

```ts
pool: 'threads'
minWorkers: 8
maxWorkers: 8
```

| Run |  Vitest |    Real |     User |     Sys |
| --- | ------: | ------: | -------: | ------: |
| 1   | 441.14s | 441.76s | 3231.72s | 210.44s |
| 2   | 428.88s | 429.33s | 3191.63s | 196.15s |
| 3   | 436.98s | 437.44s | 3256.15s | 192.17s |

- Median real time: 437.44s
- Mean real time: 436.18s
- Range: 12.43s
- Population standard deviation: approximately 5.15s

Eight workers were approximately 4.2% faster by median and substantially more
stable than six workers. The current reproducible baseline should therefore use
eight fixed workers. A reasonable next optimization target is a cold median at
or below 400 seconds with no confirmation run above 420 seconds.

These measurements came from a dirty development worktree containing the
fixture migration. They are performance references, not evidence for a clean
historical Git baseline. Re-run the protocol after material suite, dependency,
Vitest, Node, or hardware changes.

## Experiment Log

### 2026-08-10: Import profiling

- Hypothesis: import-duration ranking will identify high-fan-out test/support
  barrels suitable for direct-entry imports.
- Diff/config: no file changes; baseline `threads`, eight workers, default
  isolation and both existing `node`/`jsdom` projects were unchanged. The
  diagnostic enabled Vitest 4.1.8 `experimental.importDurations` with limit
  100 and the supported `default` reporter.
- Commands: `npm run test:run -- src/tests/utils/__tests__/fixtures.lazy.test.ts
--coverage.enabled=false --reporter=default --experimental.importDurations
--experimental.importDurations.limit 100`; then the full diagnostic command
  `npm run test:run -- --coverage.enabled=false --reporter=default
--experimental.importDurations --experimental.importDurations.limit 100`.
  A preliminary full invocation using `--experimental.importDurations.print=true`
  was also green but printed no breakdown because Vitest's CLI parser retained
  the value as a string; the supported boolean form above was used for the
  captured profile.
- Conditions: no Vitest/npm test process was present; only
  `node_modules/.vite/vitest/*/deps` was cleared before the full diagnostic.
  Pre-run load was `2.05 4.59 4.67`, settling to `2.20 4.53 4.65` after 10s.
- Focused result: 1 file, 1 passed; import breakdown printed successfully,
  with 9 imports and 129ms total import time.
- Full result: 362 files; 5,887 passed, 11 skipped, 7 todo. Vitest duration
  502.61s; transform 54.49s, setup 23.78s, import 3691.04s, tests 99.31s,
  environment 66.81s. Import profile: 15,600 imports, 686.62s self /
  16,482.82s total, slowest total 37.61s.
- Evidence: highest test-file totals included `ReleaseNotes.test.tsx`
  37.61s, `ApplicationSummary.test.jsx` 37.23s,
  `Crumb.test.tsx` 36.98s, `ImportDialog.test.jsx` 36.86s,
  `GovernmentNotificationsCard.test.jsx` 36.83s,
  `CreditCalculator.test.jsx` 36.82s, and `AddressAutocomplete.test.jsx`
  36.80s. Repeated high-fan-out imports included
  `@mui/icons-material/esm/index.js` at approximately 35.5-35.7s total in
  those files, `src/components/BCDataGrid/components/index.js`, and
  `src/components/BCForm/index.js`. These are production entry points and are
  not eligible for this matrix; test/support direct-entry candidates will be
  evaluated next.
- Decision: retained as diagnostic evidence only; no optimization decision was
  made from this non-acceptance run.

### 2026-08-10: Targeted import mocks

- Hypothesis: test-local mocks for presentation-only icons in the profiled
  high-total files would avoid repeated icon-module imports without changing
  production imports or asserted behavior.
- Diff: temporarily added test-local mocks for `@mui/icons-material` or its
  `Close` subpath in `ReleaseNotes.test.tsx`, `Crumb.test.tsx`,
  `ImportDialog.test.jsx`, `AddressAutocomplete.test.jsx`, and
  `GovernmentNotificationsCard.test.jsx`. An initial `ApplicationSummary`
  mock was removed after its transitive BCDataGrid barrel required additional
  icon exports. All experiment edits were reverted after benchmarking.
- Focused commands/results: the six-file focused command covering those files
  plus `ApplicationSummary.test.jsx` first failed 1 suite because the broad
  ApplicationSummary mock omitted `CheckBoxOutlineBlank`; after removing that
  mock, the same command passed 6 files and 118 tests. The command was
  `npm run test:run -- <six profiled paths> --coverage.enabled=false
--reporter=dot`.
- Cold command: `/usr/bin/time -p npm run test:run --
--coverage.enabled=false --reporter=dot`.
- Conditions: no test process was present; only
  `node_modules/.vite/vitest/*/deps` was cleared. Pre-run load was
  `2.26 3.67 5.18`, settling to `2.78 3.73 5.18` after 10s. No concurrent
  test command was run.
- Full result: 362 files; 5,887 passed, 11 skipped, 7 todo. Vitest duration
  499.67s; transform 54.97s, setup 24.06s, import 3701.49s, tests 101.91s,
  environment 67.45s; `/usr/bin/time -p`: real 500.07s, user 3694.38s,
  sys 205.59s.
- Decision: rejected and reverted. The suite was green and selection counts
  were unchanged, but real time was 62.63s slower than the 437.44s baseline
  median and therefore not a meaningful optimization.

### 2026-08-10: Scoped non-isolation

- Hypothesis: a separate `node-shared` project with `isolate: false` for pure
  Node utility/schema/store tests would remove per-file VM setup without
  risking the jsdom suite.
- Diff: temporarily added a 28-file `sharedNodeTests` list, excluded those
  paths from the isolated `node` project, and added the `node-shared` project
  with no setup files and `isolate: false`. The project/config changes were
  reverted after the benchmark; the original isolated `node` and `jsdom`
  projects remain.
- Focused commands/results: `npm run test:run -- --project=node-shared
--coverage.enabled=false --reporter=dot` passed 28 files and 345 tests in
  17.03s. Repeated with
  `--sequence.shuffle=true --sequence.seed=20260810`, it passed the same 28
  files and 345 tests in 17.10s. No order-sensitive failure appeared.
- Cold command: `/usr/bin/time -p npm run test:run --
--coverage.enabled=false --reporter=dot`.
- Conditions: no test process was present; only
  `node_modules/.vite/vitest/*/deps` was cleared. Pre-run load was
  `2.23 3.41 5.21`, settling to `2.42 3.41 5.19` after 10s. No concurrent
  test command was run.
- Full result: 362 files; 5,887 passed, 11 skipped, 7 todo. Vitest duration
  516.60s; transform 55.73s, setup 25.30s, import 3788.14s, tests 104.31s,
  environment 71.00s; `/usr/bin/time -p`: real 517.06s, user 3648.59s,
  sys 223.30s.
- Decision: rejected and reverted. Selection and correctness were preserved,
  but real time was 79.62s slower than the 437.44s baseline median.

### 2026-08-10: vmThreads A/B

- Hypothesis: Vitest `vmThreads` with eight workers and a fixed memory limit
  would reduce module/process overhead while preserving the current project
  isolation semantics.
- Diff: temporarily changed `frontend/vite.config.ts` from `pool: 'threads'`
  to `pool: 'vmThreads'` and added `vmMemoryLimit: '1GB'` (about 8GB across
  eight workers on this 10-CPU host). The candidate was reverted after the
  focused gate failed; eight workers and default isolation were otherwise
  unchanged.
- Focused command: `npm run test:run --
src/tests/utils/__tests__/fixtures.lazy.test.ts
src/tests/utils/__tests__/fixtures.test.tsx
src/routes/__tests__/navigation.test.jsx
src/routes/__tests__/routeGuards.test.jsx
src/layouts/MainLayout/components/__tests__/Crumb.test.tsx
src/hooks/__tests__/useAuth.test.jsx src/utils/__tests__/keycloak.test.js
src/utils/__tests__/fileValidation.node.test.js
src/views/ChargingSite/__tests__/components/utils.node.test.js
--coverage.enabled=false --reporter=dot`.
- Focused result: 9 files ran; 6 passed. Three suites failed: both router
  suites hit `SyntaxError: Unexpected token 'export'` in the shipped
  `@react-leaflet/core` ESM nested under `react-leaflet-cluster`, and
  `keycloak.test.js` had 3 failed tests because VM jsdom made `window.location`
  non-redefinable. The remaining failures were not test assertion regressions,
  but they demonstrate vmThreads ESM and global-mocking incompatibilities.
- Full result: not run. The focused correctness gate was red, so the candidate
  was rejected before an unnecessary cold acceptance benchmark.
- Decision: rejected and reverted. Keep `threads`; do not add a VM memory
  setting. Risks recorded are ESM/CJS package handling and VM-global property
  semantics.

### 2026-08-10: Global setup

- Hypothesis: moving the two safe global stubs from a per-file `beforeAll` hook
  to setup-file top level would preserve behavior while removing repeated hook
  registration from the jsdom setup path.
- Diff: temporarily changed `frontend/testSetup.js` so
  `vi.stubGlobal('lcfs_config', config)` and `vi.stubGlobal('scrollTo', vi.fn())`
  ran at top level; all mocks, `configure({ testIdAttribute: 'data-test' })`,
  and fixture cleanup were unchanged. The edit was reverted after the screen.
- Focused command: `npm run test:run --
src/tests/utils/__tests__/fixtures.test.tsx
src/tests/utils/__tests__/fixtures.lazy.test.ts
src/components/BCForm/__tests__/BCFormCheckbox.test.jsx
src/components/BCForm/__tests__/BCFormRadio.test.jsx
src/components/__tests__/Role.test.jsx src/components/__tests__/ApiDocs.test.jsx
src/routes/__tests__/specialRoutes.test.jsx
src/layouts/MainLayout/__tests__/MainLayout.test.tsx
--coverage.enabled=false --reporter=dot`.
- Focused result: 8 files; 119 tests passed in 25.77s. Existing expected jsdom
  console errors and the existing nested `swagger-ui-react` mock warning were
  still emitted; no new failure occurred.
- Cold command: `/usr/bin/time -p npm run test:run --
--coverage.enabled=false --reporter=dot`.
- Conditions: no test process was present; only
  `node_modules/.vite/vitest/*/deps` was cleared. Pre-run load was
  `3.38 5.09 6.24`, settling to `3.50 5.05 6.22` after 10s. No concurrent
  test command was run.
- Full result: 362 files; 5,887 passed, 11 skipped, 7 todo. Vitest duration
  550.48s; transform 60.66s, setup 26.63s, import 4042.40s, tests 106.38s,
  environment 72.92s; `/usr/bin/time -p`: real 550.92s, user 3903.89s,
  sys 225.91s.
- Decision: rejected and reverted. Counts and focused correctness were green,
  but the real time was 113.48s slower than the 437.44s baseline median.

### 2026-08-10: Environment specialization

- Hypothesis: additional DOM-light tests could move to the faster official
  `happy-dom` environment, while pure Node candidates could be separated from
  the jsdom setup without changing semantics.
- Node review: the existing 42 `.node.test` files were inspected. The pure
  utility/schema/store candidates were the same 28-file set exercised in the
  scoped non-isolation experiment; the remaining Node files contain mocks,
  global mutation, or environment-sensitive setup. No additional high-
  confidence Node move was retained.
- Dependency/config diff: `happy-dom` was temporarily installed with
  `npm install --save-dev happy-dom` because it was absent. A `happy-dom`
  project initially selected six files with no setup, then the clipboard file
  was removed after its read-only `navigator.clipboard` property failed and
  the remaining five files were run with the required `./testSetup.js`.
  The project and dependency were reverted with `npm uninstall --save-dev
happy-dom`; no package or config change remains.
- Focused commands/results: initial `npm run test:run -- --project=happy-dom
--coverage.enabled=false --reporter=dot` ran 6 files with 15 passed and 14
  failed (clipboard property mutation and setup-dependent `data-test` queries).
  The narrowed command, identical otherwise, passed 5 files and 30 tests in
  18.02s with setup 445ms, import 18.02s, tests 88ms, environment 727ms.
- Cold command: `/usr/bin/time -p npm run test:run --
--coverage.enabled=false --reporter=dot`.
- Conditions: no test process was present; only
  `node_modules/.vite/vitest/*/deps` was cleared. Pre-run load was
  `4.03 5.87 7.21`, settling to `3.65 5.73 7.15` after 10s. No concurrent
  test command was run.
- Full result: 362 files; 5,887 passed, 11 skipped, 7 todo. Vitest duration
  492.91s; transform 67.99s, setup 24.56s, import 3602.94s, tests 101.63s,
  environment 69.15s; `/usr/bin/time -p`: real 493.32s, user 3542.75s,
  sys 212.41s.
- Decision: rejected and reverted. The final happy-dom focused subset was
  green, but the cold suite was 55.88s slower than the 437.44s baseline
  median; the environment also exposed incompatible clipboard property
  semantics. No dependency is retained.

### 2026-08-10: Final verification

- Selected state: original `pool: 'threads'`, `minWorkers: 8`,
  `maxWorkers: 8`, default isolation, isolated `node` and `jsdom` projects,
  and no happy-dom dependency. No experiment code/config changes remain.
- Checks: `git diff --check` passed. Targeted Prettier initially flagged only
  this README; `npx prettier --write src/tests/utils/README.md` was run, and
  the targeted check `npx prettier --check vite.config.ts testSetup.js
src/tests/utils/README.md` was then clean. Final focused commands passed:
  the setup-sensitive 8-file command passed 119 tests in 24.61s, and
  `npm run test:run -- --project=node --coverage.enabled=false --reporter=dot`
  passed 42 files and 600 tests in 18.39s.
- Cold protocol: before each confirmation, `pgrep -af 'vitest|npm run test|npm
exec vitest'` showed no test process, only
  `node_modules/.vite/vitest/*/deps` was cleared, and pre-run load was
  recorded. Confirmation 1 settled at `1.92 5.56 8.74`; confirmation 2 at
  `3.93 7.61 8.84`; confirmation 3 at `3.31 7.20 8.43`. The first run waited
  for a busy host to settle before starting; no test commands overlapped.
- Canonical command for all three: `/usr/bin/time -p npm run test:run --
--coverage.enabled=false --reporter=dot`.
- Confirmation results, each 362 files and 5,887 passed, 11 skipped, 7 todo:
  1. Vitest 485.33s; transform 60.33s, setup 25.44s, import 3532.05s,
     tests 104.99s, environment 71.39s; real 486.51s, user 3490.89s,
     sys 211.47s.
  2. Vitest 488.92s; transform 55.83s, setup 24.33s, import 3567.01s,
     tests 101.59s, environment 68.94s; real 489.38s, user 3525.26s,
     sys 207.15s.
  3. Vitest 489.08s; transform 56.17s, setup 24.42s, import 3562.55s,
     tests 101.55s, environment 70.17s; real 489.56s, user 3506.38s,
     sys 210.87s.
- Final real-time median: 489.38s; range 3.05s. Compared with the accepted
  437.44s baseline median, the selected final confirmations were 51.94s
  slower (approximately 11.9%). This is a stable green baseline confirmation,
  not evidence to retain any rejected method; host load was materially higher
  than the original baseline capture.
- Decision: retain the original threads configuration and document the
  negative optimization results. No production code, production i18n,
  workflow, package manifest, or lockfile changes are retained.

### 2026-08-10: MUI direct-entry sample A/B

- Hypothesis: replacing top-level `@mui/material` and
  `@mui/icons-material` imports with direct package entries, and narrowing the
  `CreditCalculator` BCForm import/mock, will reduce cold import work without
  changing the selected tests.
- Candidate files: `src/components/BCForm/AddressAutocomplete.tsx`,
  `src/components/ImportDialog.jsx`, `src/layouts/MainLayout/components/Crumb.tsx`,
  `src/views/CarbonIntensity/components/ApplicationSummary.jsx`,
  `src/views/ComplianceReports/CreditCalculator.jsx`,
  `src/views/ComplianceReports/__tests__/CreditCalculator.test.jsx`,
  `src/views/Dashboard/components/cards/GovernmentNotificationsCard.jsx`,
  `src/views/ReleaseNotes/ReleaseNotes.tsx`.
- Candidate changes: direct `@mui/material/<entry>` imports and direct
  `@mui/icons-material/<icon>` imports in the seven production files; direct
  `@mui/material/Grid2` in `CreditCalculator`; and a direct
  `@/components/BCForm/BCFormRadio` import plus a direct mock in its test.
- Exact sample files: `src/views/ReleaseNotes/__tests__/ReleaseNotes.test.tsx`,
  `src/views/CarbonIntensity/__tests__/ApplicationSummary.test.jsx`,
  `src/layouts/MainLayout/components/__tests__/Crumb.test.tsx`,
  `src/components/__tests__/ImportDialog.test.jsx`,
  `src/views/Dashboard/components/cards/__tests__/GovernmentNotificationsCard.test.jsx`,
  `src/views/ComplianceReports/__tests__/CreditCalculator.test.jsx`,
  `src/components/BCForm/__tests__/AddressAutocomplete.test.jsx`,
  `src/components/BCDataGrid/__tests__/BCGridEditor.test.jsx`,
  `src/components/BCForm/__tests__/BCFormRadio.test.jsx`,
  `src/routes/__tests__/navigation.test.jsx`.
- Commands, run sequentially in the visible named `mui-direct-import-ab`
  Paseo terminal from `frontend`:

  ```sh
  npm run test:run -- \
    src/views/ReleaseNotes/__tests__/ReleaseNotes.test.tsx \
    src/views/CarbonIntensity/__tests__/ApplicationSummary.test.jsx \
    src/layouts/MainLayout/components/__tests__/Crumb.test.tsx \
    src/components/__tests__/ImportDialog.test.jsx \
    src/views/Dashboard/components/cards/__tests__/GovernmentNotificationsCard.test.jsx \
    src/views/ComplianceReports/__tests__/CreditCalculator.test.jsx \
    src/components/BCForm/__tests__/AddressAutocomplete.test.jsx \
    src/components/BCDataGrid/__tests__/BCGridEditor.test.jsx \
    src/components/BCForm/__tests__/BCFormRadio.test.jsx \
    src/routes/__tests__/navigation.test.jsx \
    --coverage.enabled=false --reporter=dot
  ```

  ```sh
  setopt null_glob
  for deps in node_modules/.vite/vitest/*/deps; do
    test -d "$deps" && rm -rf "$deps"
  done
  /usr/bin/time -p npm run test:run -- \
    src/views/ReleaseNotes/__tests__/ReleaseNotes.test.tsx \
    src/views/CarbonIntensity/__tests__/ApplicationSummary.test.jsx \
    src/layouts/MainLayout/components/__tests__/Crumb.test.tsx \
    src/components/__tests__/ImportDialog.test.jsx \
    src/views/Dashboard/components/cards/__tests__/GovernmentNotificationsCard.test.jsx \
    src/views/ComplianceReports/__tests__/CreditCalculator.test.jsx \
    src/components/BCForm/__tests__/AddressAutocomplete.test.jsx \
    src/components/BCDataGrid/__tests__/BCGridEditor.test.jsx \
    src/components/BCForm/__tests__/BCFormRadio.test.jsx \
    src/routes/__tests__/navigation.test.jsx \
    --coverage.enabled=false --reporter=dot
  ```

- Focused correctness result: 10 files and 228 tests passed. Vitest duration
  26.82s; transform 12.07s, setup 1.21s, import 78.79s, tests 16.31s,
  environment 2.97s.
- Cold measurements: every run passed 10 files and 228 tests.

  | Run | State     | Settled load   | Vitest | Transform | Setup |  Import |  Tests | Environment |   Real |    User |    Sys |
  | --- | --------- | -------------- | -----: | --------: | ----: | ------: | -----: | ----------: | -----: | ------: | -----: |
  | 1   | baseline  | 2.98 2.81 2.61 | 40.87s |    24.90s | 1.34s | 241.35s | 16.24s |       2.84s | 41.38s | 228.44s | 16.98s |
  | 2   | baseline  | 3.63 3.29 2.82 | 39.88s |    24.38s | 1.25s | 234.15s | 16.28s |       3.07s | 40.39s | 223.96s | 16.27s |
  | 3   | baseline  | 4.30 3.67 3.00 | 40.84s |    24.67s | 1.21s | 239.88s | 16.44s |       2.88s | 41.35s | 228.43s | 16.12s |
  | 1   | candidate | 3.70 4.02 3.31 | 26.77s |    10.99s | 1.13s |  77.98s | 16.53s |       3.81s | 27.17s |  87.05s |  7.48s |
  | 2   | candidate | 5.47 4.83 3.69 | 26.14s |    10.87s | 1.07s |  76.41s | 16.52s |       2.50s | 26.52s |  85.54s |  7.55s |
  | 3   | candidate | 4.18 4.65 3.71 | 26.65s |    11.54s | 1.18s |  78.07s | 16.99s |       2.73s | 27.03s |  87.60s |  7.87s |

- Median, range, and population CV statistics:

  | Metric          | Baseline median / range / CV | Candidate median / range / CV | Median change |
  | --------------- | ---------------------------: | ----------------------------: | ------------: |
  | Real            |       41.35s / 0.99s / 1.12% |        27.03s / 0.65s / 1.04% | 34.63% faster |
  | User            |      228.43s / 4.48s / 0.93% |        87.05s / 2.06s / 1.00% |  61.89% lower |
  | Sys             |       16.27s / 0.86s / 2.28% |         7.55s / 0.39s / 2.22% |  53.60% lower |
  | Vitest duration |       40.84s / 0.99s / 1.13% |        26.65s / 0.63s / 1.03% | 34.75% faster |
  | Transform       |       24.67s / 0.52s / 0.86% |        10.99s / 0.67s / 2.62% |  55.45% lower |
  | Setup           |        1.25s / 0.13s / 4.29% |         1.13s / 0.11s / 3.99% |   9.60% lower |
  | Import          |      239.88s / 7.20s / 1.30% |        77.98s / 1.66s / 0.98% |  67.49% lower |
  | Tests           |       16.28s / 0.20s / 0.53% |        16.53s / 0.47s / 1.31% |  1.54% higher |
  | Environment     |        2.88s / 0.23s / 3.42% |        2.73s / 1.31s / 18.95% |   5.21% lower |

- Per-run phase evidence: Vitest duration changed by `-14.10s`, `-13.74s`,
  `-14.19s`; transform by `-13.91s`, `-13.51s`, `-13.13s`; setup by
  `-0.21s`, `-0.18s`, `-0.03s`; import by `-163.37s`, `-157.74s`, `-161.81s`;
  tests by `+0.29s`, `+0.24s`, `+0.55s`; and environment by `+0.97s`,
  `-0.57s`, `-0.15s` for baseline runs 1-3 versus candidate runs 1-3.
- Conditions and caveats: no test process was present before the baseline and
  focused runs; only `node_modules/.vite/vitest/*/deps` was cleared before
  each cold sample; runs were sequential; baseline run 1 started immediately
  after the no-process check and later runs used a 10-second cool-down. Host
  load increased during the experiment, the sample is only 10 files, and no
  full-suite confirmation was run.
- Verification: targeted `npx prettier --check` initially flagged four owned
  files, so `npx prettier --write` was run on all eight candidate files. The
  final targeted Prettier check and owned-file `git diff --check` both passed.
  The formatter also normalized pre-existing formatting in four owned files;
  those non-import changes are part of this experiment worktree state.
- Decision: retained. All tests passed with identical counts, median real time
  improved by 34.63% (well above the required 8%), and the 67.49% import-phase
  reduction strongly corroborated the direct-entry hypothesis. No repository-
  wide import broadening was performed.

### 2026-08-10: Production direct-import rollout

- Objective: apply the direct-entry import strategy across the production
  frontend without changing public component barrels, test behavior, or Vitest
  worker/isolation configuration.
- Scope: MUI runtime imports were changed to package subpaths across components,
  layouts, hooks, utilities, routes, contexts, `main.tsx`, Storybook preview,
  and views. Internal direct imports were applied to BCDataGrid consumers,
  BCForm production consumers, ComplianceReporting, and Transfers
  `buttonConfigs`, with matching test mocks updated where needed.
- Mock repairs: `frontend/testSetup.js` now mocks the BCForm component
  subpaths directly. Component-own BCForm tests explicitly `vi.unmock` their
  implementation and import it through the matching alias path, avoiding the
  global mock while preserving the shared mock for consumers.
- Additional repairs: remaining bare date-picker imports in `main.tsx`,
  `DateEditor`, `BCDateFloatingFilter`, `CommentLog`, and
  `ApplicationInformationStep` were narrowed to `LocalizationProvider` or
  `DatePicker` subpaths, including their test mocks. The Storybook preview now
  imports `CssBaseline` and `ThemeProvider` directly.
- Retained exceptions: `src/tests/utils/wrapper.jsx` has unused namespace
  imports kept as test wrapper compatibility fixtures; the
  `SvgIconComponent` import in
  `src/views/ComplianceReports/components/ComplianceReportPageNav.tsx` is
  type-only. Bare MUI mocks in `fixtures.lazy.test.ts` and
  `mocks/materialUi.jsx` intentionally exercise lazy/barrel behavior.
- Focused verification: Group A passed 41 files and 737 tests; Group B passed
  65 files and 1,158 tests with 11 skipped; Group C passed 24 files and 420
  tests; Group D passed 12 files and 266 tests. The retained high-cost sample
  passed 10 files and 228 tests. The direct-date repair rerun passed all four
  selected files.
- Build verification: `npm run build` passed in 9.30s and transformed 5,132
  modules. Only the existing dynamic-import and chunk-size warnings were
  emitted.
- Static verification: final residual searches found no internal production
  imports from the BCDataGrid, BCForm, ComplianceReporting, or Transfers
  barrels. Targeted Prettier checks passed and `git diff --check` was clean.
  The working tree contained 338 changed files before this documentation
  entry, with 7,497 additions and 5,509 deletions.
- Type verification: the TypeScript check still reports the existing baseline
  error set (approximately 189 lines); no new import-resolution errors were
  reported. The first targeted ESLint run was clean. A later run including the
  Storybook preview could not load `@typescript-eslint/recommended` from the
  repository ESLint configuration, so that result is recorded as an
  environment/configuration limitation rather than a rollout failure.
- Cold protocol: each final run used the canonical command below from
  `frontend`, with no concurrent test process, a 10-second load-settling wait,
  and only `node_modules/.vite/vitest/*/deps` cleared:

  ```sh
  /usr/bin/time -p npm run test:run -- --coverage.enabled=false --reporter=dot
  ```

- Final cold results: every run passed 362 files with 5,887 passed, 11
  skipped, and 7 todo tests.

  | Run | Load before     | Load settled / after cache clear | Vitest | Transform |  Setup |  Import |   Tests | Environment |   Real |    User |    Sys |
  | --- | --------------- | -------------------------------- | -----: | --------: | -----: | ------: | ------: | ----------: | -----: | ------: | -----: |
  | 1   | 2.64 3.56 4.23  | 2.61 3.53 4.20                   | 49.04s |    10.80s | 29.41s | 141.32s | 111.73s |      73.22s | 49.45s | 353.23s | 50.37s |
  | 2   | 6.75 5.07 4.75  | 7.46 5.26 4.83                   | 47.55s |    11.08s | 28.74s | 136.40s | 108.30s |      70.46s | 48.00s | 347.19s | 49.18s |
  | 3   | 10.30 7.04 5.56 | 10.54 7.18 5.63                  | 47.27s |    10.93s | 28.57s | 135.53s | 107.11s |      71.70s | 47.78s | 345.76s | 49.71s |

- Final statistics: real-time median 48.00s, range 1.67s, and population CV
  approximately 1.53%. Compared with the accepted 437.44s baseline median,
  the final rollout is approximately 89.03% faster. The under-420s target and
  near-400s stretch target were both met.
- Evidence: focused, build, and cold logs were retained under
  `/var/folders/69/94ynmxtn1bzcwj15b0w2hwh00000gn/T/opencode/`, including
  `final-cold-1.log`, `final-cold-2.log`, and `final-cold-3.log`.
- Decision: retain the production direct-entry imports and the associated
  direct test mocks. No Vitest configuration, package manifest, lockfile, or
  public barrel API changes were required.
