# Cypress and Playwright local comparison

The Cypress setup retains the existing suite and has a local comparison path
for the same public-login Gherkin scenarios used by the Playwright pilot. A
larger local benchmark also selects nine public calculator/reference-data cases
and two authenticated admin cases from both runners.

| Area                  | Cypress                                                                                                                      | Playwright                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Gherkin               | Existing Cucumber preprocessor generates Cypress tests from `.feature` files; `PublicLogin.feature` is shared scenario text. | Playwright-BDD generates native Playwright tests from the pilot feature.                     |
| Browser selection     | One browser per `cypress run`; the comparison feature has separate Chrome, Firefox, and WebKit commands.                     | Projects run Chrome, Firefox, and WebKit in one Playwright invocation.                       |
| WebKit                | Cypress's `experimentalWebKitSupport` is enabled. Its WebKit browser package is installed locally; support is experimental.  | WebKit is a standard Playwright project.                                                     |
| Parallel execution    | Cypress's built-in `--parallel` scheduler requires recorded Cypress Cloud runs; separate local browser runs are available.   | `fullyParallel: true` runs independent tests across local workers.                           |
| Interactive runner    | `cypress:open` offers the local app, browser selector, Command Log, and time-travel debugging.                               | `playwright:ui` offers a local UI runner.                                                    |
| Retries               | One retry in CI run mode; no retries in local run or open mode.                                                              | One retry in CI; none in local runs.                                                         |
| Isolation             | Legacy flows retain `testIsolation: false`; the calculator/admin benchmark suites explicitly use `testIsolation: true`.      | A fresh browser context is used per test.                                                    |
| Timeouts and viewport | 20-second command timeout, 60-second page-load timeout, 1280×720 viewport.                                                   | 20-second action/expect timeout, 60-second navigation timeout, 1280×720 viewport.            |
| Failure artifacts     | Screenshots on failure and video; comparison outputs are separated by browser under `cypress/`.                              | Screenshots on failure, videos, and traces under `playwright/`.                              |
| Reports               | Existing Mochawesome JSON plus local Cucumber HTML report. Comparison reports use a separate folder per browser.             | Local list, HTML, JSON, JUnit, and Cucumber HTML reports.                                    |
| Base URL              | `CYPRESS_BASE_URL`, defaulting to `http://localhost:3000`.                                                                   | `PLAYWRIGHT_BASE_URL`, defaulting to a local Vite server at `http://localhost:3000`.         |
| Node tasks            | `log`, `table`, and the explicit `clearComplianceReports` task remain available. The pilot does not clear database data.     | Matching local task helpers exist; `clearComplianceReports` is never called by the pilot.    |
| Shared support        | Existing exception filters, accessibility helpers, and Cypress custom commands remain configured.                            | The pilot has matching exception filters, `axe-core` helpers, and data-test locator support. |

## Local comparison commands

`npm run cypress:run` still runs the complete Cypress suite in Chrome.
`npm run cypress:run:comparison:chrome`,
`npm run cypress:run:comparison:firefox`, and
`npm run cypress:run:comparison:webkit` each run
`cypress/e2e/Pages/User/PublicLogin.feature` in one browser, with local
artifacts separated by browser. Cypress runs one browser per invocation; start
each command separately to compare the same scenarios across browsers.

The matched benchmark runs the same 11 unique public calculator and admin cases
in each runner. Cypress runs Chrome, then Firefox. Playwright's sequential,
four-worker, and six-worker runs select the native Test projects; equivalent
Gherkin scenarios remain available in the `*-bdd` projects. WebKit runs
separately for documentation and is excluded from the comparison. Detailed
timings are in [the benchmark results](BENCHMARK_RESULTS.md).

`npm run benchmark:e2e` runs the full normalized matrix three times with local
workers 1, 2, 3, 4, and 6, plus the separate WebKit measurement. Both runners
use fresh sessions, the same credential pair, equivalent assertions and
readiness checks, and no explicit logout or fixed login delay. Benchmark
commands enable videos, failure screenshots, JSON reporting, and zero retries;
Playwright tracing and its extra reporters remain available outside benchmarks.

Authenticated admin cases need the IDIR test account used by the Cypress
suite. Playwright reads the same credential keys from `cypress.env.json`, or
`PLAYWRIGHT_IDIR_TEST_USER` and `PLAYWRIGHT_IDIR_TEST_PASS` from `.env`; those
cases skip if neither source has them. Cypress does not start the app server,
so start `npm run dev` before its benchmark command.

Cypress cannot schedule tests across local workers using its built-in parallel
runner. Its `--parallel` option requires Cypress Cloud recording; this setup
does not enable recording, use a Cloud key, or connect to a hosted test service.
The comparison commands therefore use Cypress's built-in browser selector in
separate local runs.

The WebKit project uses Cypress's experimental support and the matching local
`playwright-webkit` browser package. Cypress documents limitations for this
experiment, including `cy.origin()` support. See the
[Cypress browser support guide](https://docs.cypress.io/app/references/launching-browsers)
and [Cypress parallelization guide](https://docs.cypress.io/cloud/features/smart-orchestration/parallelization)
for current details.

## Configuration notes

- `supportFile`, `setupNodeEvents`, log/table tasks, exception filters, and
  accessibility helpers are configured in Cypress and remain available in
  the Playwright fixture/helper files.
- Cypress's `testIsolation: false` is retained for existing scenarios that
  share state. Playwright creates a new browser context for every test.
- Cypress excludes `*.skip.feature`; the Playwright pilot uses an explicit
  feature glob and contains only its selected scenarios.
- Both runners keep browser artifacts and reports in ignored local folders.
- `clearComplianceReports` truncates database data. Neither comparison feature
  invokes it.
- Cypress's existing remote `cypress:dev` command is not used by the local
  comparison flow. The default base URL is localhost.
