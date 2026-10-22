# Cypress and Playwright benchmark results

Normalized rerun measured October 21, 2026, on the local development machine.
These measurements supersede the earlier runs with unmatched login waits,
cleanup, and reporting settings.

## Scope and normalization

Each compared trial executes the same 11 unique cases in Chrome and Firefox:
nine public calculator/reference-data checks with stubbed API responses and
two authenticated admin checks. That is 22 executions per trial. The duplicate
Gherkin scenarios and two public-login cases are excluded from this benchmark.

Both implementations now use the following contract:

- A fresh session per test: Cypress explicitly enables `testIsolation: true`
  for these suites; Playwright creates a fresh browser context.
- The same IDIR credential pair and app URL, supplied to both runners by the
  benchmark harness. Credentials remain in local environment variables or the
  ignored `cypress.env.json`.
- A full sign-in for each authenticated case, a successful token response,
  and a visible navbar before continuing. There is no fixed login sleep or
  explicit logout step in either benchmark implementation.
- Equivalent route, visible-content, radio-selection, numeric-result,
  reference-column, description-order, responsive-layout, and accessibility
  assertions, using the same API response data and custom-CI request value.
- Explicit quantity entry and native keyboard replacement of formatted numeric
  fields, with zero per-character delay. Both runners verify cleared fields
  and initial results before entering reverse/custom calculations. This avoids
  depending on browser timing of default-value calculations and caret updates.
- The same narrow application-exception policy from `e2e/known-page-errors.js`.
  The benchmark no longer suppresses every exception in public Cypress tests.
- Videos, screenshots on failure, JSON reporting, and zero retries in both
  runners. Playwright tracing and its additional HTML/JUnit/Cucumber reporters
  remain enabled for ordinary pilot runs; the benchmark disables them.
- 20-second command/action/expect timeouts and 60-second navigation/readiness
  waits. Playwright also has an explicit 120-second total test timeout.

Cypress starts Chrome and Firefox in separate, sequential invocations.
Playwright uses one invocation selecting both native browser projects. One
worker executes them sequentially; with multiple workers the projects share
the global worker pool and can overlap. The harness runs each configuration
separately, using the runners' native execution capabilities.

## Environment and timing method

- macOS 27.0.1, Apple Silicon, 12 logical CPUs, 36 GiB RAM, Node.js 24.21.0.
- Cypress 16.2.0; Playwright Test 1.64.1.
- Chrome 155.0.8059.80 in both runners.
- Cypress Firefox 158.0; Playwright Firefox 157.0.
- Playwright WebKit 27.2.

Both runners and browsers execute locally without Cypress Cloud or another
hosted test runner. The same existing app is reached at `http://localhost:3000`
through the SSH port forward, with the API at `localhost:18000`. Authenticated
checks use the existing Gov BC test identity service.

Each configuration runs three times, with the configuration order rotated
between rounds. No two configurations run at the same time. Wall time covers
the complete npm command, including runner startup, native spec preparation,
video finalization, and JSON output. The already-running app startup is outside
the measurement. Native Playwright benchmark commands do not generate BDD tests.

The harness validates exit codes and structured reports for the full expected
pass count, with zero skipped or failed tests. All 429 executions in this final
matrix passed. Earlier diagnostic runs used to correct test behavior are
superseded by this complete run.

## Wall-clock timings

All times are seconds. The Chrome/Firefox rows each passed 66/66 executions
across three trials. WebKit passed 33/33, covering one browser and 11 cases
per trial; its timing is documentation only.

| Run                                   | Workers | Trial 1 | Trial 2 | Trial 3 | Median | Range       |
| ------------------------------------- | ------: | ------: | ------: | ------: | -----: | ----------- |
| Cypress sequential                    |       — |   97.70 |   84.58 |   83.74 |  84.58 | 83.74–97.70 |
| Playwright sequential                 |       1 |   63.28 |   64.04 |   64.52 |  64.04 | 63.28–64.52 |
| Playwright parallel                   |       2 |   40.96 |   42.40 |   41.88 |  41.88 | 40.96–42.40 |
| Playwright parallel                   |       3 |   35.51 |   35.38 |   36.32 |  35.51 | 35.38–36.32 |
| Playwright parallel                   |       4 |   36.40 |   36.48 |   35.19 |  36.40 | 35.19–36.48 |
| Playwright parallel                   |       6 |   39.44 |   37.71 |   38.12 |  38.12 | 37.71–39.44 |
| Playwright WebKit, documentation only |       1 |   50.39 |   50.44 |   50.44 |  50.44 | 50.39–50.44 |

## Worker scaling

| Playwright workers |  Median | Speedup versus one worker | Parallel efficiency |
| -----------------: | ------: | ------------------------: | ------------------: |
|                  1 | 64.04 s |                     1.00× |              100.0% |
|                  2 | 41.88 s |                     1.53× |               76.5% |
|                  3 | 35.51 s |                     1.80× |               60.1% |
|                  4 | 36.40 s |                     1.76× |               44.0% |
|                  6 | 38.12 s |                     1.68× |               28.0% |

The lowest observed median was 3 workers at 35.51 s. The three-
and four-worker ranges overlap, so their small difference should be interpreted
with the observed variation. Six workers were slower than both. This small
11-case-per-browser workload did not scale linearly; these measurements do not
identify a CPU, memory, app/API, or identity-service bottleneck.

Sequential Playwright was 20.54 s (24.3%) faster than the sequential
Cypress pair by median wall time. The 3-worker Playwright run was
49.06 s (58.0%) faster.

The runners use different Firefox builds, and the app/identity service and
machine are shared development resources. These are three-trial observations
of this subset rather than a general performance guarantee.

## Reproducing the runs

From `frontend/`, start the app at `http://localhost:3000` and configure a
complete IDIR credential pair in the existing ignored `cypress.env.json` or
the supported environment variables. The harness selects one complete pair
and passes it to both runners without printing it.

```sh
npm run benchmark:e2e -- --repetitions=3 --base-url=http://localhost:3000
```

The harness saves per-trial logs, structured reports, raw wall times, machine
metadata, and computed summaries under `playwright/reports/benchmark-*/`.
The checked-in tables include every trial time; the generated reports remain
local.

Individual commands remain available:

```sh
CYPRESS_BASE_URL=http://localhost:3000 npm run cypress:run:benchmark:sequential
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run playwright:run:benchmark:sequential
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run playwright:run:benchmark:2workers
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run playwright:run:benchmark:3workers
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run playwright:run:benchmark:4workers
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run playwright:run:benchmark:parallel
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run playwright:run:benchmark:webkit
```

These commands set `E2E_BENCHMARK=true` for the normalized reporting/retry
settings. The harness additionally enforces matched credentials, app URLs,
isolated report destinations, complete pass counts, and rotating trial order.

Cypress still prints a nonfatal macOS `spawn Unknown system error -86` during
artifact cleanup. All six Cypress browser invocations in the final matrix
passed and exited successfully.
