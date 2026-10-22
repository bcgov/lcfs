# Python 3.13 upgrade plan

Branch: `experimental/python3.13`
Ticket: [LCFS #5294 — Backend Python 3.13 on Debian Trixie](https://github.com/bcgov/lcfs/issues/5294)

Status: the Python 3.11 baseline and initial hardening checkpoint are validated.
An additional focused hardening increment is implemented, but phase 2 coverage
remains incomplete. The application still targets Python 3.11, and Python 3.13
dependency upgrades have not started.

## Objective and boundaries

Upgrade the backend image, CI, and local development runtime to standard CPython
3.13 on Debian 13 (Trixie). Keep current API contracts and business behavior.
Use the normal GIL-enabled build; free threading and JIT tuning are separate work.

Target 3.13 directly on this branch. Python 3.12 may be used to investigate
compatibility failures, but is not a required production release. Treat a later
3.14 upgrade as a separate plan with its own dependency and validation gates. Do
not combine this upgrade with test database or sharding redesigns.

Ticket #5294 is the scope authority for this work. The standalone
`etl/python_migration` runtime is out of scope; its `.python-version` remains
`3.11.10` and can be upgraded separately.

### Ticket acceptance criteria

- [ ] `backend/Dockerfile.openshift` uses
  `artifacts.developer.gov.bc.ca/docker-remote/python:3.13-slim-trixie` and keeps
  a minor-version image tag.
- [ ] `backend/Dockerfile` uses `python:3.13-slim-trixie`, and local Compose still
  starts the backend.
- [ ] `backend/.python-version` is the backend version source; every
  `actions/setup-python` step reads it through `python-version-file`, and
  `backend/pyproject.toml` declares `python = "^3.13"`.
- [ ] Dockerfiles and CI install the same selected Poetry 2.x release that writes
  the regenerated lockfile.
- [ ] NumPy is upgraded to 2.x; other dependencies change only where Python 3.13
  support or a demonstrated compatibility issue requires it.
- [ ] `POST /forms/{form_slug}/export` renders PDFs in the OpenShift image, with
  pango and cairo installed explicitly there for WeasyPrint.
- [ ] Spreadsheet output matches the pre-upgrade output, and the tzdata build
  check passes in both images.
- [ ] The full backend pytest suite, `alembic upgrade heads`, and Cypress pass in
  CI on Python 3.13.
- [ ] A PR deployment to Dev starts the new image; login, compliance report
  views, and Excel downloads work.
- [ ] `Development-Environment-Setup.md` and
  `System-Requirements-and-Dependencies.md` in the wiki describe Python 3.13.

## 1. Establish a reproducible baseline

- Validate the existing Python version centralization changes on 3.11: sync
  check, helper tests, Poetry lock validation, Docker builds, and backend tests.
- Record test counts, failures, skips, and collection/setup/execution durations.
  Record CI wall time separately from summed runner time across the 45 shards.
- Save representative API/OpenAPI output and spreadsheet/PDF export fixtures.
- Record the baseline application image digest and migration head for rollback.
- Confirm scheduled-task tests under `lcfs/scripts/tests` remain included in
  default discovery and the CI shards alongside `lcfs/tests`.

Gate: identify pre-existing failures before attributing failures to the upgrade.
Keep a separate baseline commit for the centralization changes when committing.

### Hardening checkpoint (2026-10-22)

- Full default run on Python 3.11.10 / PostgreSQL 17: **3,384 passed, 1 skipped**
  in 323.63 seconds. All 3,385 collected test IDs matched JUnit execution exactly,
  including 34 scheduler/task tests, without missing or duplicate execution.
- Fixed two async session mocks so exception/not-found tests exercise the intended
  paths. Added scheduler tests to default discovery and CI cache inputs.
- Combined discovery exposed late task-model registration after ORM configuration.
  Registered task models with the shared model imports and removed their unused
  deprecated declarative base.
- Added seven real PostgreSQL transaction tests using the actual dependency:
  commits, HTTP/unexpected exception rollbacks, deferred commit failures, and
  streaming completion/error/disconnect cleanup. A temporary rollback-instead-of-
  commit mutation caused all three selected critical assertions to fail as expected.
- Added 18 validation/settings/warning-policy contract tests. Replaced the 33
  deprecated Pydantic schema declarations while preserving the full OpenAPI
  document and 491 loaded model schemas. Collection with warnings enabled is clean;
  schema declaration deprecations are now errors during collection and test bodies.
- At the checkpoint, the charging-site permission test was skipped because shared
  role fixtures automatically add SUPPLIER or GOVERNMENT. See the follow-up below.
- Legacy runtime Pydantic API deprecations remain separate work.

### Follow-up: lint and permission baseline (2026-10-22)

- Replaced the skipped charging-site search permission test with a focused
  unauthenticated-request test; it returns the expected 401 response. Targeted
  PostgreSQL run: 1 passed.
- Added setuptools `<82` to backend development dependencies and regenerated the
  lockfile using production's Poetry 1.6.1, which writes lock format 2.0. This
  pins the deprecated `pkg_resources` API that `flake8-commas` still imports.
  Flake8 and all configured plugins now load; the plugin continues to emit its
  upstream `pkg_resources` deprecation warning, so migrate or replace that plugin
  in the dependency/tooling upgrade phase.
- Isolated core Flake8 checks for the affected charging-site test file pass. The
  full configured Flake8 run now completes but exits 1 on thousands of repository
  style findings (primarily comma formatting, imports, line lengths, and
  docstrings). Treat that existing lint debt as separate cleanup work.
- After enabling the unauthenticated permission case, the full backend suite passed
  **3,385 tests with no skips or failures** in 316.52 seconds on Python 3.11.10 and
  PostgreSQL 17. The run includes the scheduler tests now in default discovery.

### Additional hardening increment (2026-10-22)

- Added XLS and XLSX read-back coverage for numeric cell types, NumPy scalar
  values, and computed totals. Normalized NumPy scalar values before writing XLS
  because `xlwt` rejects values such as `numpy.int64`.
- Expanded Redis lifecycle coverage for transient retries, retry exhaustion,
  unexpected errors, shutdown cleanup, and request dependency behavior. Failed
  startup clients now close before retrying.
- Added an API cache-hit test with decoded Redis string responses. Added a cache
  coder that supports the application's `decode_responses=True` Redis setting,
  which otherwise returned strings to a coder that expects bytes.
- Added service-free tests for standalone ETL helpers as separate test hardening.
  They also passed on the shell's Python 3.14.8; this work does not change the
  ETL tool's 3.11.10 interpreter target.
- Validation: 22 focused spreadsheet, Redis, and rate-limit tests passed on the
  backend Python 3.11.10 environment; all 6 ETL helper tests passed under Python
  3.14.8. The new cache coder passes its focused mypy check.
- The broader phase 2 gate remains open: Redis coverage still uses fakeredis
  rather than a live Redis integration.

## 2. Harden regression tests on Python 3.11

Complete this phase before changing Python or upgrade-related dependencies. Start
with a gap review of existing tests and add coverage for observable behavior,
rather than duplicating implementation details or chasing a coverage percentage.

- **Transactions:** use real PostgreSQL and the application's actual session
  dependency to prove successful requests commit, failed requests roll back, and
  commit failures cannot silently return success. Check persisted state from a
  separate session. Exercise streaming completion, failure, and disconnect paths,
  including transaction cleanup and connection release. Tests that override the
  session dependency alone do not validate its production commit timing.
- **API contracts:** assert representative validation errors, response fields,
  aliases, dates, decimals, enums, authentication, and permissions. Use stable
  contract assertions and reviewed OpenAPI fixtures where useful.
- **Exports:** read generated spreadsheets back and assert values, types, totals,
  dates, and missing data. Check representative PDF content and structure. Avoid
  exact binary comparisons that depend on timestamps or generated metadata.
- **Integrations and jobs:** complement mocked unit tests with real PostgreSQL
  and Redis integration tests for database behavior, caching, and rate limiting.
  Cover scheduled sync/async jobs and exception paths. The standalone ETL
  migration tool is outside ticket #5294.
- **Execution integrity:** explicitly include relevant scheduler tests outside
  default discovery. Compare the expected collected test IDs with the union of
  shard results, checking for missing or duplicate execution and unexpected skips.
  Make collection failures and unintentionally empty runs visible without
  redesigning sharding or database provisioning in this phase.
- **Prove test sensitivity:** for the critical new assertions, temporarily induce
  the corresponding fault in isolation (for example, omit a commit or alter an
  exported total), confirm the test fails, then revert the fault before committing.

Gate: the hardened suite passes on 3.11 with the baseline dependencies, meaningful
failure-detection checks are recorded, and all intended tests are accounted for.
Record unresolved pre-existing behavior as an explicit blocker or reviewed
exception; do not silently change expected results to obtain a green baseline.
Commit test hardening separately from the interpreter and dependency upgrade.

After dependency resolution, run the same behavioral assertions on 3.11 and 3.13.
Where supported, also run the upgraded dependency set on 3.11 to distinguish
dependency regressions from interpreter regressions. Use separate environments
and documented lockfiles or dependency snapshots; retain the ticket's `^3.13`
project constraint and do not change it just to enable comparisons.
Keep expected behavior consistent across versions unless a difference is reviewed
and accepted. Passing these tests supplements Docker and staging validation.

## 3. Resolve the Python 3.13 dependency set

Work in an isolated environment. Change `backend/.python-version` to `3.13`, run
`python3 scripts/sync-python-version.py --write`, select a 3.13 Poetry environment,
and resolve dependencies with the selected Poetry 2.x version. Update the version
sync helper to generate the ticket's `^3.13` constraint and Debian Trixie image tags.

The versions below are known support milestones, not a final selection. Select
maintained compatible releases, inspect their release notes, and record the exact
chosen versions in the lockfile. Avoid an indiscriminate dependency update.

| Area | Current declaration or lock | Required work |
| --- | --- | --- |
| NumPy | `^1.26.4`; locked 1.26.4 | Allow NumPy 2.x; NumPy 2.1.0 added Python 3.13 support. Select a maintained compatible 2.x version and review the NumPy 2 migration guide. |
| pandas | Locked 2.3.1 | pandas 2.2.3 added Python 3.13 support, so the locked 2.3.1 is past that milestone. Validate it with the selected NumPy 2.x version; keep pandas on 2.x. |
| PostgreSQL driver | `asyncpg ^0.30.0`; locked 0.30.0 | asyncpg 0.30.0 already supports Python 3.13. Confirm the selected platform artifacts install and test the configured PostgreSQL behavior; upgrade only if another issue requires it. |
| API validation | FastAPI 0.115.14; Pydantic 2.11.7; pydantic-core 2.33.2 | FastAPI 0.115.8 and Pydantic 2.8 added Python 3.13 support, so the locked versions already clear those milestones. Keep FastAPI/Starlette and Pydantic/core/settings constraints lock-consistent; update only for a demonstrated compatibility or maintenance need. |
| Native dependencies | uvloop 0.21.0, httptools 0.6.4, hiredis 3.2.1, and other compiled packages | Audit all locked wheels for the actual Linux production architecture and macOS development architectures. Refresh unsupported packages; test imports. |
| Development tools | Flake8 4.0.1, wemake-python-styleguide 0.17, mypy 1.17, coverage 7.9.2 | Select a mutually compatible toolchain; review lint rule changes separately from functional fixes. Check pytest and all its plugins together. |
| Build tooling | Poetry 1.6.1 in Docker and CI; current committed lock is format 2.0 | Upgrade Docker and all CI jobs to the same Poetry 2.x release, then regenerate and validate the lockfile with that release. |

Check native packages including NumPy, pandas, asyncpg, greenlet, pydantic-core,
uvloop, httptools, hiredis, multidict, yarl, PyYAML, cryptography, cffi, Pillow,
Lupa, ujson, mypy, and coverage. A missing wheel is a packaging risk, not proof
that a source build cannot work; document any intentional source builds and
their compiler/system-library requirements.

Gate: reproducible main and development installations on 3.13, reviewed lockfile
diff, and successful imports of all critical native modules. Confirm the private
Artifactory mirror provides the Trixie Python image and required package artifacts.

## 4. Preserve application behavior

Run the hardened regression suite from phase 2 against the upgraded stack before
adding targeted tests for any newly discovered incompatibilities.

- **Database transaction cleanup:** `backend/lcfs/db/dependencies.py` commits when
  its yielded session exits. FastAPI 0.118.0 changed default yield-dependency
  cleanup timing to after response transmission. Verify commit/rollback behavior,
  commit failures, streaming responses, and connection release. Decide explicitly
  whether the selected FastAPI version needs function-scoped dependencies or
  explicit transaction boundaries to preserve current behavior.
- **Database driver:** check migrations, sessions, auditing context, and queries
  with prepared-statement caching disabled. The application explicitly configures
  both `prepared_statement_cache_size=0` and `statement_cache_size=0`; exercise
  those settings with the selected driver version.
- **Validation and serialization:** test authentication, role checks, request
  validation errors, aliases, dates, decimals, enums, response schemas, and OpenAPI.
  Review changed annotations/forward-reference handling in the framework stack.
- **Exports and numeric behavior:** test spreadsheet construction, CSV seeders,
  missing values, dates, numeric dtypes, and representative XLSX/PDF output after
  the NumPy/pandas updates. Compare data and document structure rather than
  timestamps or other unstable binary metadata.
- **Image-specific exports:** verify forms PDF rendering in the OpenShift image
  after explicitly installing pango and cairo, and compare XLS/XLSX data and
  numeric types with baseline fixtures.
- **Background work:** explicitly run scheduler tests and representative sync and
  async jobs, including exceptions and thread-executor paths. Python 3.13 emits a
  `DeprecationWarning` when the default `get_event_loop()` policy creates a loop
  without a current loop. Scheduler calls run inside async functions, and the
  Alembic fallback is entered only when a loop is already running. Verify these
  paths with deprecations visible and replace low-level calls where appropriate.
- **External integrations:** exercise Redis caching/rate limiting, mocked
  Keycloak authentication, object storage, and email through existing test seams.
  Validate staging integrations using their normal non-production configuration.
Gate: functional changes have focused regression coverage and reviewed API and
export differences. Distinguish intended dependency changes from regressions.

## 5. Verify builds, CI, and performance

- Run the version sync check and its helper tests, Poetry validation, formatting,
  linting, type checks, and the complete backend suite including scheduled-task
  tests. Use separate task-test runs when diagnosing failures.
- Build both `backend/Dockerfile` and `backend/Dockerfile.openshift` using the
  actual deployment architecture. Verify native libraries for PDF generation,
  timezone checks, Alembic startup, health checks, and application startup.
- Verify the production image uses the Artifactory Trixie tag and includes its
  explicit PDF system libraries; verify the local image uses the matching Docker
  Hub Trixie tag.
- Exercise the Compose environment and frontend/backend Cypress flows.
- Run `alembic upgrade heads`, the full pytest suite, and Cypress in the Python
  3.13 CI runtime; complete a PR deployment smoke test in Dev.
- Confirm every CI Python setup reads `backend/.python-version`; keep caches
  isolated by Python version and reinstall virtual environments for 3.13.
- Verify shard collection still covers the complete suite: do not count shards
  returning pytest exit code 5 as evidence that all tests executed.
- Compare 3.11 and 3.13 on the same hardware, database setup, shard arrangement,
  and cache conditions over repeated runs. Separate setup, collection, and test
  execution. Document dependency differences so interpreter speed is not credited
  for unrelated package improvements. Do not promise a speedup before measuring.

Gate: all required CI checks pass, complete test execution is demonstrated, and
there is no unexplained material performance regression. Set acceptable runtime,
memory, error-rate, and database-connection limits from the baseline before rollout.

## 6. Roll out through dev and test

- Deploy the experimental image to a non-production environment and verify smoke
  tests, representative reporting workflows, streaming exports, and scheduled jobs.
- Observe request latency, memory, application errors, database connections,
  transaction failures, and scheduler outcomes over representative activity.
- Promote to production only after the normal release review and acceptance gates.
- Keep the previous 3.11 application image available. Roll back to that image if
  agreed regression limits are exceeded. The interpreter upgrade should require
  no database schema change; if one becomes necessary, define and validate its
  compatibility and rollback separately before promotion.
- Update the two wiki pages listed in ticket #5294 to use Python 3.13.

## Deliverables

- Shared Python version set to 3.13 with synchronized Docker/Poetry declarations.
- Reviewed dependency constraints, lockfile, and tool versions.
- Hardened regression suite with a passing 3.11 baseline, demonstrated failure
  detection, complete execution accounting, and comparison results on 3.13.
- Focused fixes and regression tests for discovered incompatibilities.
- Passing CI, Docker/OpenShift build evidence, and an upgrade validation summary.
- Baseline comparison, staging results, and a recorded rollback image digest.

## Compatibility references

- [Python 3.13 porting notes](https://docs.python.org/3.13/whatsnew/3.13.html#porting-to-python-3-13)
- [NumPy 2 migration guide](https://numpy.org/doc/2.0/numpy_2_0_migration_guide.html)
- [NumPy 2.1 Python 3.13 support](https://numpy.org/doc/2.1/release/2.1.0-notes.html)
- [pandas 2.2.3 Python 3.13 support](https://pandas.pydata.org/pandas-docs/version/2.2/whatsnew/v2.2.3.html)
- [asyncpg 0.30.0 Python 3.13 support](https://github.com/MagicStack/asyncpg/releases/tag/v0.30.0)
- [Pydantic 2.8 Python 3.13 support](https://pydantic.dev/articles/pydantic-v2-8-release)
- [FastAPI release notes](https://fastapi.tiangolo.com/release-notes/)
- [psycopg2 release notes](https://www.psycopg.org/docs/news.html)
